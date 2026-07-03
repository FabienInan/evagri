"use server"

import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  createDocumentActe,
  findDocumentActeByFileName,
  findTransactionSourceByNumeroInscription,
  updateDocumentActePath,
} from "@/repositories/actes.repository"
import { saveActePDF } from "@/lib/file-storage"
import { logAudit } from "@/lib/audit"

function extractNumeroInscription(filename: string): string | null {
  const base = filename.replace(/\.pdf$/i, "")
  const match = base.match(/^(\d+)/)
  return match ? match[1] : null
}

export async function importActesPDF(formData: FormData) {
  const files = formData.getAll("files") as File[]
  if (files.length === 0) throw new Error("Aucun fichier PDF fourni")

  const organisationId = getCurrentOrganisationId()
  const matched: { filename: string; numeroInscription: string | null; transactionSourceId: string }[] = []
  const unmatched: string[] = []

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      unmatched.push(`${file.name} (format non PDF)`)
      continue
    }

    const numeroInscription = extractNumeroInscription(file.name)
    if (!numeroInscription) {
      unmatched.push(`${file.name} (impossible d'extraire le numéro d'inscription)`)
      continue
    }

    const transaction = await findTransactionSourceByNumeroInscription(
      organisationId,
      numeroInscription
    )
    if (!transaction) {
      unmatched.push(`${file.name} (aucune transaction pour ${numeroInscription})`)
      continue
    }

    const { nomFichier, cheminStockage } = await saveActePDF(
      file,
      organisationId,
      transaction.id
    )

    const existing = await findDocumentActeByFileName(transaction.id, nomFichier)
    if (existing) {
      await updateDocumentActePath(existing.id, cheminStockage)
    } else {
      await createDocumentActe(transaction.id, nomFichier, cheminStockage)
    }

    matched.push({
      filename: file.name,
      numeroInscription: transaction.numeroInscription ?? null,
      transactionSourceId: transaction.id,
    })
  }

  await logAudit({
    organisationId,
    tableCible: "document_acte",
    action: "INSERT",
    diff: { matched: matched.length, unmatched: unmatched.length },
  })

  return {
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    matched,
    unmatched,
  }
}
