"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  addTransactionsToPanier as repoAddTransactions,
  countEligibleTransactions,
  createDossier as repoCreateDossier,
  createPanier as repoCreatePanier,
  findDossierById,
  findDossierByNumero,
  findPanierById,
  listDossiers as repoListDossiers,
  listPaniersByDossier,
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
} from "@/validators/dossier.validator"

export async function listDossiers(): Promise<SerializedDossier[]> {
  const organisationId = getCurrentOrganisationId()
  return (await repoListDossiers(organisationId)).map(serializeDossier)
}

export async function createDossier(input: {
  numeroDossier: string
  nom?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
  const parsed = createDossierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const existing = await findDossierByNumero(organisationId, parsed.data.numeroDossier)
  if (existing) return { ok: false, error: "Un dossier existe déjà avec ce numéro." }

  const dossier = await repoCreateDossier(organisationId, parsed.data)
  revalidatePath("/dossiers")
  return { ok: true, id: dossier.id }
}

export async function createPanier(input: {
  dossierId: string
  nom: string
  typeTransactionId?: string | null
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

  const added = await repoAddTransactions(parsed.data.panierId, ids)
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

  await repoRemoveTransaction(panierId, transactionId)
  revalidatePath(`/paniers/${panierId}`)
  return { ok: true }
}

export async function listPaniersForDossier(dossierId: string): Promise<SerializedPanier[]> {
  const organisationId = getCurrentOrganisationId()
  return (await listPaniersByDossier(organisationId, dossierId)).map(serializePanier)
}

export async function listTransactionsForPanier(panierId: string): Promise<SerializedTransaction[]> {
  const organisationId = getCurrentOrganisationId()
  // Le repository `listTransactionsOfPanier` ne prend que panierId : on vérifie l'appartenance à
  // l'organisation ici (garde-fou IDOR). Panier hors organisation → liste vide (action de lecture).
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return []
  return (await listTransactionsOfPanier(panierId)).map(serializeTransaction)
}
