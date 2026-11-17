"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { geocodeLotsCadastraux, geocodeLotsDetail } from "@/lib/cadastre"
import {
  addTransactionsToPanier as repoAddTransactions,
  countEligibleTransactions,
  createDossier as repoCreateDossier,
  createPanier as repoCreatePanier,
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
  formatDossierInputErrors,
  previewLotsSchema,
} from "@/validators/dossier.validator"

export async function listDossiers(): Promise<SerializedDossier[]> {
  const organisationId = getCurrentOrganisationId()
  return (await repoListDossiers(organisationId)).map(serializeDossier)
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
  const organisationId = getCurrentOrganisationId()
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
    const dossier = await repoCreateDossier(organisationId, {
      numeroDossier,
      nom,
      dateEvaluation,
      lotsCadastraux: lots,
      ...coords,
    })
    revalidatePath("/dossiers")
    return { ok: true, id: dossier.id }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Un dossier existe déjà avec ce numéro." }
    }
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
  const organisationId = getCurrentOrganisationId()
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
  const organisationId = getCurrentOrganisationId()
  const parsed = createPanierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const dossier = await findDossierById(organisationId, parsed.data.dossierId)
  if (!dossier) return { ok: false, error: "Dossier introuvable." }

  const panier = await repoCreatePanier(organisationId, parsed.data)
  revalidatePath(`/dossiers/${parsed.data.dossierId}`)
  return { ok: true, id: panier.id }
}

/** Supprime un panier sans toucher aux transactions qu'il regroupait. Renvoie le dossier pour la redirection. */
export async function deletePanier(
  panierId: string
): Promise<{ ok: true; dossierId: string } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return { ok: false, error: "Panier introuvable." }

  const dossierId = panier.dossierId
  const deleted = await repoDeletePanier(organisationId, panierId)
  if (!deleted) return { ok: false, error: "Panier introuvable." }

  revalidatePath(`/dossiers/${dossierId}`)
  revalidatePath(`/paniers/${panierId}`)
  return { ok: true, dossierId }
}

/** Transactions déjà dans le panier : la liste masque « Ajouter au panier » pour celles-ci. */
export async function getPanierTransactionIds(panierId: string): Promise<string[]> {
  const organisationId = getCurrentOrganisationId()
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return []
  return listTransactionIdsOfPanier(organisationId, panierId)
}

export async function addTransactionsToPanier(input: {
  panierId: string
  transactionIds: string[]
}): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
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

  const added = await repoAddTransactions(organisationId, parsed.data.panierId, ids)
  revalidatePath(`/paniers/${parsed.data.panierId}`)
  return { ok: true, added }
}

export async function removeTransactionFromPanier(
  panierId: string,
  transactionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return { ok: false, error: "Panier introuvable." }

  await repoRemoveTransaction(organisationId, panierId, transactionId)
  revalidatePath(`/paniers/${panierId}`)
  return { ok: true }
}

export async function listPaniersForDossier(dossierId: string): Promise<SerializedPanier[]> {
  const organisationId = getCurrentOrganisationId()
  return (await listPaniersByDossier(organisationId, dossierId)).map(serializePanier)
}

export async function listTransactionsForPanier(panierId: string): Promise<SerializedTransaction[]> {
  const organisationId = getCurrentOrganisationId()
  // Le repository scope lui-même la lecture par organisation ; le pré-contrôle conserve le 404 côté page.
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return []
  return (await listTransactionsOfPanier(organisationId, panierId)).map(serializeTransaction)
}
