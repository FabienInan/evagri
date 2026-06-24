"use server"

import fs from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ""

function extractNumeroInscription(filename: string): string | null {
  // Remove extension and common prefixes/suffixes
  const base = filename.replace(/\.pdf$/i, "")
  // Try to find a number-like inscription at the start or as the whole name
  const match = base.match(/^(\d+)/)
  return match ? match[1] : null
}

export async function importActesPDF(formData: FormData) {
  const files = formData.getAll("files") as File[]
  if (files.length === 0) throw new Error("Aucun fichier PDF fourni")

  const org = await prisma.organisation.findFirst({ where: { id: DEFAULT_ORG_ID } })
  if (!org) throw new Error("Organisation par défaut non initialisée")

  const matched: { filename: string; numeroInscription: string; transactionSourceId: string }[] = []
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

    const transaction = await prisma.transactionSource.findFirst({
      where: {
        organisationId: org.id,
        numeroInscription: { contains: numeroInscription, mode: "insensitive" },
      },
      orderBy: { dateVente: "desc" },
    })

    if (!transaction) {
      unmatched.push(`${file.name} (aucune transaction pour ${numeroInscription})`)
      continue
    }

    const nomFichier = path.basename(file.name)
    const cheminStockage = `uploads/actes/${org.id}/${transaction.id}/${nomFichier}`
    const dir = path.join(process.cwd(), "uploads", "actes", org.id, transaction.id)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, nomFichier), Buffer.from(await file.arrayBuffer()))

    const existing = await prisma.documentActe.findFirst({
      where: { transactionSourceId: transaction.id, nomFichier },
    })

    if (existing) {
      await prisma.documentActe.update({
        where: { id: existing.id },
        data: { cheminStockage },
      })
    } else {
      await prisma.documentActe.create({
        data: {
          transactionSourceId: transaction.id,
          nomFichier,
          cheminStockage,
        },
      })
    }

    matched.push({
      filename: file.name,
      numeroInscription: transaction.numeroInscription,
      transactionSourceId: transaction.id,
    })
  }

  await logAudit({
    organisationId: org.id,
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
