"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { getEffectiveFicheLayout } from "@/server/fiche-layout"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import {
  createDocument,
  deleteDocument as deleteDocumentRepo,
  findTransactionFiche,
  saveFicheValues,
  updateFicheStatut,
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

export async function saveFiche(input: unknown): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = saveFicheSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Données invalides." }

  const record = await findTransactionFiche(organisationId, parsed.data.id)
  if (!record) return { ok: false, error: "Transaction introuvable." }

  const [champs, sections] = await Promise.all([
    listChampsEnrichissablesByOrganisation(organisationId),
    getEffectiveFicheLayout(organisationId),
  ])
  const fields = serializeTransaction(record).fields
  const valeurs = parsed.data.valeurs

  const errors = validateFiche({
    champs,
    sections,
    valeurs,
    fields,
    typeCode: parsed.data.typeTransactionCode,
    dateVente: typeof fields.date_vente === "string" ? fields.date_vente : null,
  })
  if (errors.length > 0) return { ok: false, error: errors[0].message, errors }

  if (!parsed.data.forcerSauvegarde) {
    const avertissements = warningsFiche({
      champs,
      sections,
      valeurs,
      fields,
      typeCode: parsed.data.typeTransactionCode,
      dateVente: typeof fields.date_vente === "string" ? fields.date_vente : null,
    })
    if (avertissements.length > 0) {
      return { ok: false, error: avertissements[0].message, avertissements }
    }
  }

  await saveFicheValues(
    record.id,
    buildStorageEntries(champs, valeurs, parsed.data.typeTransactionCode)
  )

  revalidatePath(`/transactions/${record.id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

export async function setFicheStatut(id: string, statut: string): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
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
  }

  await updateFicheStatut(record.id, statut, statut === "ANALYSEE" ? new Date() : record.dateStatut ?? null)

  revalidatePath(`/transactions/${id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

export async function uploadDocument(
  transactionId: string,
  formData: FormData
): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
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
    await createDocument({
      transactionId,
      nomFichier: stored.nomFichier,
      cheminStockage: stored.cheminStockage,
    })
  } catch {
    return { ok: false, error: "Échec de l'enregistrement du document." }
  }

  revalidatePath(`/transactions/${transactionId}`)
  return { ok: true }
}

export async function deleteDocument(documentId: string): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
  const deleted = await deleteDocumentRepo(organisationId, documentId)
  if (!deleted) {
    return { ok: false, error: "Document introuvable." }
  }
  revalidatePath("/transactions")
  return { ok: true }
}
