"use server"

import { utilisateurPourZone, verifierZone } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { geocodeLotsCadastraux, geocodeLotsDetail } from "@/lib/cadastre"
import {
  addTransactionsToPanier as repoAddTransactions,
  countEligibleTransactions,
  createDossier as repoCreateDossier,
  createPanier as repoCreatePanier,
  updatePanierTauxCroissance as repoUpdatePanierTaux,
  deletePanier as repoDeletePanier,
  findDossierById,
  findDossierByNumero,
  findPanierById,
  listDossiers as repoListDossiers,
  listPaniersByDossier,
  listTransactionIdsOfPanier,
  listTransactionsOfPanier,
  removeTransactionFromPanier as repoRemoveTransaction,
} from "@/repositories/dossier.repository"
import {
  serializeDossier,
  serializePanier,
  type SerializedDossier,
  type SerializedPanier,
} from "@/serializers/dossier.serializer"
import {
  serializeTransaction,
  type SerializedTransaction,
} from "@/serializers/transaction.serializer"
import {
  addTransactionsSchema,
  createDossierSchema,
  createPanierSchema,
  updatePanierTauxSchema,
  formatDossierInputErrors,
  previewLotsSchema,
} from "@/validators/dossier.validator"

// Each write records its journal entry inside the repository, in the same transaction as the change.

export async function listDossiers(): Promise<SerializedDossier[]> {
  // Sidebar data: empty for roles without the evaluation zone, rather than an error on every page.
  const utilisateur = await utilisateurPourZone("evaluation")
  if (!utilisateur) return []
  return (await repoListDossiers(utilisateur.organisationId)).map(serializeDossier)
}

export async function createDossier(input: {
  numeroDossier: string
  nom?: string
  dateEvaluation: string
  lotsCadastraux: string[]
  latitude?: number
  longitude?: number
}): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; coordonneesRequises?: boolean }
> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const parsed = createDossierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const existing = await findDossierByNumero(organisationId, parsed.data.numeroDossier)
  if (existing) return { ok: false, error: "Un dossier existe déjà avec ce numéro." }

  // Coordonnées : géocodage Demeter des lots (même méthode que l'import). Si aucun lot n'est trouvé,
  // les coordonnées saisies à la main sont requises.
  const lots = parsed.data.lotsCadastraux
  const geocoded = await geocodeLotsCadastraux(lots)
  const { numeroDossier, nom, dateEvaluation } = parsed.data
  let coords: { latitude: number; longitude: number }
  if (geocoded) {
    coords = geocoded
  } else if (parsed.data.latitude !== undefined && parsed.data.longitude !== undefined) {
    coords = { latitude: parsed.data.latitude, longitude: parsed.data.longitude }
  } else {
    return {
      ok: false,
      error: "Aucun lot trouvé au cadastre : saisissez la latitude et la longitude.",
      coordonneesRequises: true,
    }
  }

  // Le pré-contrôle ci-dessus couvre le cas séquentiel ; une course concurrente peut encore heurter la
  // contrainte unique @@unique([organisationId, numeroDossier]) — on la mappe en erreur lisible (jamais de 500).
  try {
    const dossier = await repoCreateDossier(
      organisationId,
      {
        numeroDossier,
        nom,
        dateEvaluation,
        lotsCadastraux: lots,
        ...coords,
      },
      {
        utilisateurId: utilisateur.id,
        tableCible: "dossier",
        action: "INSERT",
        diff: { numeroDossier: parsed.data.numeroDossier },
      }
    )
    revalidatePath("/dossiers")
    return { ok: true, id: dossier.id }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Un dossier existe déjà avec ce numéro." }
    }
    console.error("createDossier: échec d'enregistrement", error)
    return { ok: false, error: "Impossible d'enregistrer le dossier. Réessayez." }
  }
}

/** Coordonnées trouvées au cadastre pour des lots, avant création : lot par lot et moyenne des lots trouvés. */
export async function previewLotsCadastraux(input: { lotsCadastraux: string[] }): Promise<
  | {
      ok: true
      lots: { lot: string; latitude: number | null; longitude: number | null }[]
      moyenne: { latitude: number; longitude: number } | null
    }
  | { ok: false; error: string }
> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const parsed = previewLotsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const { parLot, moyenne } = await geocodeLotsDetail(parsed.data.lotsCadastraux)
  return {
    ok: true,
    lots: parLot.map((p) => ({
      lot: p.lot,
      latitude: p.coordonnees?.latitude ?? null,
      longitude: p.coordonnees?.longitude ?? null,
    })),
    moyenne,
  }
}

/** Localisation d'un dossier (numéro et coordonnées), pour afficher son pin sur la carte. Null si absent ou sans coordonnées. */
export async function getDossierLocalisation(
  dossierId: string
): Promise<{ numeroDossier: string; latitude: number; longitude: number } | null> {
  const utilisateur = await utilisateurPourZone("evaluation")
  if (!utilisateur) return null
  const organisationId = utilisateur.organisationId
  const dossier = await findDossierById(organisationId, dossierId)
  if (!dossier || dossier.latitude === null || dossier.longitude === null) return null
  return {
    numeroDossier: dossier.numeroDossier,
    latitude: Number(dossier.latitude),
    longitude: Number(dossier.longitude),
  }
}

export async function createPanier(input: {
  dossierId: string
  nom: string
  typeTransactionId?: string | null
  tauxCroissancePct: number
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const parsed = createPanierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const dossier = await findDossierById(organisationId, parsed.data.dossierId)
  if (!dossier) return { ok: false, error: "Dossier introuvable." }

  try {
    const panier = await repoCreatePanier(organisationId, parsed.data, {
      utilisateurId: utilisateur.id,
      tableCible: "panier",
      action: "INSERT",
      diff: {},
    })
    revalidatePath(`/dossiers/${parsed.data.dossierId}`)
    return { ok: true, id: panier.id }
  } catch (error) {
    console.error("createPanier: échec d'enregistrement", error)
    return { ok: false, error: "Impossible d'enregistrer le panier. Réessayez." }
  }
}

/** Modifie le taux de croissance d'un panier existant : l'export des indicateurs ajustés en tient compte. */
export async function updatePanierTauxCroissance(input: {
  panierId: string
  tauxCroissancePct: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const parsed = updatePanierTauxSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  try {
    const updated = await repoUpdatePanierTaux(organisationId, parsed.data.panierId, parsed.data.tauxCroissancePct, {
      utilisateurId: utilisateur.id,
      tableCible: "panier",
      action: "UPDATE",
      diff: { tauxCroissancePct: parsed.data.tauxCroissancePct },
    })
    if (!updated) return { ok: false, error: "Panier introuvable." }
  } catch (error) {
    console.error("updatePanierTauxCroissance: échec d'enregistrement", error)
    return { ok: false, error: "Impossible de modifier le taux. Réessayez." }
  }

  revalidatePath(`/paniers/${parsed.data.panierId}`)
  return { ok: true }
}

/** Supprime un panier sans toucher aux transactions qu'il regroupait. Renvoie le dossier pour la redirection. */
export async function deletePanier(
  panierId: string
): Promise<{ ok: true; dossierId: string } | { ok: false; error: string }> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return { ok: false, error: "Panier introuvable." }

  const dossierId = panier.dossierId
  try {
    const deleted = await repoDeletePanier(organisationId, panierId, {
      utilisateurId: utilisateur.id,
      tableCible: "panier",
      action: "DELETE",
      diff: { dossierId },
    })
    if (!deleted) return { ok: false, error: "Panier introuvable." }
  } catch (error) {
    console.error("deletePanier: échec de suppression", error)
    return { ok: false, error: "Impossible de supprimer le panier. Réessayez." }
  }

  revalidatePath(`/dossiers/${dossierId}`)
  revalidatePath(`/paniers/${panierId}`)
  return { ok: true, dossierId }
}

/** Transactions déjà dans le panier : la liste masque « Ajouter au panier » pour celles-ci. */
export async function getPanierTransactionIds(panierId: string): Promise<string[]> {
  const utilisateur = await utilisateurPourZone("evaluation")
  if (!utilisateur) return []
  const organisationId = utilisateur.organisationId
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return []
  return listTransactionIdsOfPanier(organisationId, panierId)
}

export async function addTransactionsToPanier(input: {
  panierId: string
  transactionIds: string[]
}): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const parsed = addTransactionsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const panier = await findPanierById(organisationId, parsed.data.panierId)
  if (!panier) return { ok: false, error: "Panier introuvable." }

  // Déduplique l'entrée : un id répété ne doit pas faire échouer le contrôle d'éligibilité (count < length).
  const ids = Array.from(new Set(parsed.data.transactionIds))
  const eligible = await countEligibleTransactions(organisationId, ids)
  if (eligible !== ids.length) {
    return { ok: false, error: "Seules les transactions analysées peuvent être ajoutées." }
  }

  try {
    const added = await repoAddTransactions(organisationId, parsed.data.panierId, ids, {
      utilisateurId: utilisateur.id,
      tableCible: "panier_transaction",
      action: "INSERT",
    })
    revalidatePath(`/paniers/${parsed.data.panierId}`)
    return { ok: true, added }
  } catch (error) {
    console.error("addTransactionsToPanier: échec d'enregistrement", error)
    return { ok: false, error: "Impossible d'ajouter les transactions. Réessayez." }
  }
}

export async function removeTransactionFromPanier(
  panierId: string,
  transactionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return { ok: false, error: "Panier introuvable." }

  try {
    await repoRemoveTransaction(organisationId, panierId, transactionId, {
      utilisateurId: utilisateur.id,
      tableCible: "panier_transaction",
      action: "DELETE",
      diff: { transactionId },
    })
  } catch (error) {
    console.error("removeTransactionFromPanier: échec de retrait", error)
    return { ok: false, error: "Impossible de retirer la transaction. Réessayez." }
  }
  revalidatePath(`/paniers/${panierId}`)
  return { ok: true }
}

export async function listPaniersForDossier(dossierId: string): Promise<SerializedPanier[]> {
  const utilisateur = await utilisateurPourZone("evaluation")
  if (!utilisateur) return []
  return (await listPaniersByDossier(utilisateur.organisationId, dossierId)).map(serializePanier)
}

export async function listTransactionsForPanier(panierId: string): Promise<SerializedTransaction[]> {
  const utilisateur = await utilisateurPourZone("evaluation")
  if (!utilisateur) return []
  const organisationId = utilisateur.organisationId
  // Le repository scope lui-même la lecture par organisation ; le pré-contrôle conserve le 404 côté page.
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return []
  return (await listTransactionsOfPanier(organisationId, panierId)).map(serializeTransaction)
}
