"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import {
  createDocument,
  deleteDocument as deleteDocumentRepo,
  findTransactionFiche,
  saveFicheValues,
  updateFicheStatut,
} from "@/repositories/fiche.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { buildSourceNumbers, buildStorageEntries, TYPE_TRANSACTION_CODE, validateFiche } from "@/lib/fiche"
import { saveActePDF } from "@/lib/file-storage"

export type FicheActionResult = { ok: true } | { ok: false; error: string }

const valeurSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const saveFicheSchema = z.object({
  id: z.string().min(1),
  typeTransactionCode: z.string().nullable(),
  valeurs: z.record(z.string(), valeurSchema),
})

export async function saveFiche(input: unknown): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = saveFicheSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Données invalides." }

  const record = await findTransactionFiche(organisationId, parsed.data.id)
  if (!record || !record.enrichie) return { ok: false, error: "Transaction introuvable." }

  const champs = await listChampsEnrichissablesByOrganisation(organisationId)
  const transaction = serializeTransaction(record)
  const valeurs = parsed.data.valeurs

  const errors = validateFiche({
    champs,
    valeurs,
    source: buildSourceNumbers(transaction),
    typeCode: parsed.data.typeTransactionCode,
    dateVente: transaction.dateVente,
  })
  if (errors.length > 0) return { ok: false, error: errors[0].message }

  await saveFicheValues(
    record.enrichie.id,
    buildStorageEntries(champs, valeurs, parsed.data.typeTransactionCode)
  )

  revalidatePath(`/transactions/${record.id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

export async function setFicheStatut(id: string, statut: string): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
  const record = await findTransactionFiche(organisationId, id)
  if (!record || !record.enrichie) return { ok: false, error: "Transaction introuvable." }

  if (statut === "Analysée") {
    const champs = await listChampsEnrichissablesByOrganisation(organisationId)
    const transaction = serializeTransaction(record)
    const valeurs = transaction.enrichment
    const typeChamp = champs.find((c) => c.codeMachine === TYPE_TRANSACTION_CODE)
    const storedType = typeChamp ? valeurs[typeChamp.codeMachine] : null

    const errors = validateFiche({
      champs,
      valeurs,
      source: buildSourceNumbers(transaction),
      typeCode: typeof storedType === "string" ? storedType : null,
      dateVente: transaction.dateVente,
    })
    if (errors.length > 0) return { ok: false, error: errors[0].message }
  }

  await updateFicheStatut(record.enrichie.id, statut, statut === "Analysée" ? new Date() : record.enrichie.dateStatut ?? null)

  revalidatePath(`/transactions/${id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

export async function uploadDocument(
  transactionSourceId: string,
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

  const stored = await saveActePDF(file, organisationId, transactionSourceId)
  await createDocument({
    transactionSourceId,
    nomFichier: stored.nomFichier,
    cheminStockage: stored.cheminStockage,
  })

  revalidatePath(`/transactions/${transactionSourceId}`)
  return { ok: true }
}

export async function deleteDocument(documentId: string): Promise<FicheActionResult> {
  await deleteDocumentRepo(documentId)
  revalidatePath("/transactions")
  return { ok: true }
}
