"use server"

import { verifierZone } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { getEffectiveFicheLayout } from "@/server/fiche-layout"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { formaterModification, formaterValeur, type ValeurAffichee } from "@/lib/historique"
import {
  createDocument,
  deleteDocument as deleteDocumentRepo,
  findTransactionFiche,
  saveFicheValuesAvecJournal,
  updateFicheStatutAvecJournal,
} from "@/repositories/fiche.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import {
  buildStorageEntries,
  resolveTypeTransaction,
  validateFiche,
  warningsFiche,
  withRecomputedIndicateurs,
} from "@/lib/fiche"
import { saveActePDF } from "@/lib/file-storage"
import { saveFicheSchema } from "@/validators/fiche.validator"

/** One blocking rule violation; `champ` is the codeMachine to display the message under, or null for a fiche-wide message. */
export type FicheFieldError = { code: string; message: string; champ: string | null }

export type FicheActionResult =
  | { ok: true }
  | { ok: false; error: string; errors?: FicheFieldError[]; avertissements?: FicheFieldError[] }

/** Forme comparable d'une valeur stockée : deux valeurs de même forme sont identiques. */
function signatureValeur(valeur: {
  valeurNombre: { toString(): string } | number | null
  valeurTexte: string | null
  valeurTexteMultiple: string[]
  valeurBooleen: boolean | null
  valeurDate: Date | null
}): string {
  return JSON.stringify([
    valeur.valeurNombre === null ? null : Number(valeur.valeurNombre),
    valeur.valeurTexte,
    valeur.valeurTexteMultiple,
    valeur.valeurBooleen,
    valeur.valeurDate ? valeur.valeurDate.toISOString().slice(0, 10) : null,
  ])
}

/** A stored row as a plain value for the history (the decimal becomes a number). */
function versValeurAffichee(valeur: {
  valeurNombre: { toString(): string } | number | null
  valeurTexte: string | null
  valeurTexteMultiple: string[]
  valeurBooleen: boolean | null
  valeurDate: Date | null
}): ValeurAffichee {
  return {
    nombre: valeur.valeurNombre === null ? null : Number(valeur.valeurNombre),
    texte: valeur.valeurTexte,
    multiple: valeur.valeurTexteMultiple,
    booleen: valeur.valeurBooleen,
    date: valeur.valeurDate,
  }
}

export async function saveFiche(input: unknown): Promise<FicheActionResult> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const parsed = saveFicheSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Données invalides." }

  const record = await findTransactionFiche(organisationId, parsed.data.id)
  if (!record) return { ok: false, error: "Transaction introuvable." }

  const champs = await listChampsEnrichissablesByOrganisation(organisationId)
  const entries = buildStorageEntries(champs, parsed.data.valeurs, parsed.data.typeTransactionCode)
  // Le journal garde les codes des champs modifiés, jamais leurs valeurs (données personnelles possibles).
  const anciennes = new Map(record.valeurs.map((v) => [v.champId, signatureValeur(v)]))
  const nouvelles = new Map(entries.map((e) => [e.champId, signatureValeur(e)]))
  const champsModifies = champs
    .filter((c) => anciennes.get(c.id) !== nouvelles.get(c.id))
    .map((c) => c.codeMachine)

  // Journal : pour chaque champ modifié, son nom, son ancienne valeur et sa nouvelle. Le type de transaction est
  // affiché par son nom de typologie, et non par son code.
  const typologies = await listTypologiesByOrganisation(organisationId)
  const libellesTypes = new Map(typologies.map((t) => [t.code, t.nom]))
  const anciennesValeurs = new Map(record.valeurs.map((v) => [v.champId, versValeurAffichee(v)]))
  const nouvellesValeurs = new Map(entries.map((e) => [e.champId, versValeurAffichee(e)]))
  const modifications = champs
    .filter((c) => anciennes.get(c.id) !== nouvelles.get(c.id))
    .map((c) =>
      formaterModification(
        c.nomAffichage,
        formaterValeur(anciennesValeurs.get(c.id) ?? null, libellesTypes),
        formaterValeur(nouvellesValeurs.get(c.id) ?? null, libellesTypes)
      )
    )

  try {
    await saveFicheValuesAvecJournal(organisationId, record.id, entries, {
      utilisateurId: utilisateur.id,
      tableCible: "transaction",
      enregistrementId: record.id,
      action: "SAVE_FICHE",
      diff: { champsModifies: champsModifies.join(", "), modifications },
    })
  } catch (error) {
    console.error("saveFiche: échec d'enregistrement", error)
    return { ok: false, error: "Impossible d'enregistrer la fiche. Réessayez." }
  }

  revalidatePath(`/transactions/${record.id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

/**
 * Changement de statut. Passer à « analysée » (Finaliser) applique les règles bloquantes, puis les avertissements
 * sauf si l'évaluateur les a confirmés (`forcerAvertissements`).
 */
export async function setFicheStatut(
  id: string,
  statut: string,
  options: { forcerAvertissements?: boolean } = {}
): Promise<FicheActionResult> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  if (statut !== "ANALYSEE" && statut !== "NON_ANALYSEE") return { ok: false, error: "Statut invalide." }
  const record = await findTransactionFiche(organisationId, id)
  if (!record) return { ok: false, error: "Transaction introuvable." }

  if (statut === "ANALYSEE") {
    const [champs, sections, typologies] = await Promise.all([
      listChampsEnrichissablesByOrganisation(organisationId),
      getEffectiveFicheLayout(organisationId),
      listTypologiesByOrganisation(organisationId),
    ])
    const fields = serializeTransaction(record).fields
    const valeurs = withRecomputedIndicateurs(champs, fields)
    const typeCode = resolveTypeTransaction(fields.typeTransaction ?? null, typologies)?.code ?? null

    const errors = validateFiche({
      champs,
      sections,
      valeurs,
      fields,
      typeCode,
      dateVente: typeof fields.date_vente === "string" ? fields.date_vente : null,
    })
    if (errors.length > 0) return { ok: false, error: errors[0].message, errors }

    if (!options.forcerAvertissements) {
      const avertissements = warningsFiche({
        champs,
        sections,
        valeurs,
        fields,
        typeCode,
        dateVente: typeof fields.date_vente === "string" ? fields.date_vente : null,
      })
      if (avertissements.length > 0) {
        return { ok: false, error: avertissements[0].message, avertissements }
      }
    }
  }

  // §7.5.5 : passer à « Analysée » enregistre l'évaluateur comme Contributeur. Un retour à « Non analysée »
  // ne le touche pas : le contributeur historique reste consultable.
  const analysee = statut === "ANALYSEE"
  try {
    await updateFicheStatutAvecJournal(
      organisationId,
      record.id,
      statut,
      analysee ? new Date() : record.dateStatut ?? null,
      analysee ? utilisateur.id : undefined,
      {
        utilisateurId: utilisateur.id,
        tableCible: "transaction",
        enregistrementId: record.id,
        action: "STATUT",
        diff: { statut, ...(analysee ? { contributeurId: utilisateur.id } : {}) },
      }
    )
  } catch (error) {
    console.error("setFicheStatut: échec d'enregistrement", error)
    return { ok: false, error: "Impossible de changer le statut. Réessayez." }
  }

  revalidatePath(`/transactions/${id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

export async function uploadDocument(
  transactionId: string,
  formData: FormData
): Promise<FicheActionResult> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier sélectionné." }
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Seuls les fichiers PDF sont acceptés." }
  }

  const record = await findTransactionFiche(organisationId, transactionId)
  if (!record) return { ok: false, error: "Transaction introuvable." }

  try {
    const stored = await saveActePDF(file, organisationId, transactionId)
    await createDocument(
      organisationId,
      {
        transactionId,
        nomFichier: stored.nomFichier,
        cheminStockage: stored.cheminStockage,
      },
      {
        utilisateurId: utilisateur.id,
        tableCible: "document_acte",
        action: "INSERT",
        diff: { nomFichier: file.name },
      }
    )
  } catch {
    return { ok: false, error: "Échec de l'enregistrement du document." }
  }

  revalidatePath(`/transactions/${transactionId}`)
  return { ok: true }
}

export async function deleteDocument(documentId: string): Promise<FicheActionResult> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  let deleted: boolean
  try {
    deleted = await deleteDocumentRepo(organisationId, documentId, {
      utilisateurId: utilisateur.id,
      tableCible: "document_acte",
      action: "DELETE",
      diff: {},
    })
  } catch (error) {
    console.error("deleteDocument: échec de suppression", error)
    return { ok: false, error: "Impossible de supprimer le document. Réessayez." }
  }
  if (!deleted) {
    return { ok: false, error: "Document introuvable." }
  }
  revalidatePath("/transactions")
  return { ok: true }
}
