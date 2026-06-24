"use server"

import { prisma } from "@/lib/prisma"
import { parseWorkbook, rowToSourceFields, extractNonEmptyEnrichmentHeaders, inferType } from "@/lib/excel-parser"
import { importTransactions } from "@/lib/transaction-import"
import { logAudit } from "@/lib/audit"

async function ensureEnrichmentChamps(
  organisationId: string,
  sheetRows: Record<string, unknown>[]
) {
  const candidates = extractNonEmptyEnrichmentHeaders(sheetRows)
  const result: { id: string; header: string; codeMachine: string; typeDonnees: string }[] = []

  for (const candidate of candidates) {
    const codeMachine = candidate.header
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")

    const existing = await prisma.champEnrichissable.findUnique({
      where: { organisationId_codeMachine: { organisationId, codeMachine } },
    })

    if (existing) {
      result.push({ id: existing.id, header: candidate.header, codeMachine, typeDonnees: existing.typeDonnees })
    } else {
      const created = await prisma.champEnrichissable.create({
        data: {
          organisationId,
          codeMachine,
          nomAffichage: candidate.header,
          typeDonnees: inferType(candidate.sample),
          nature: "SAISISSABLE",
          unite: "N/A",
          applicableATypes: [],
        },
      })
      result.push({ id: created.id, header: candidate.header, codeMachine, typeDonnees: created.typeDonnees })
    }
  }

  return result
}

export async function importExcel(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) throw new Error("No file provided")

  const buffer = Buffer.from(await file.arrayBuffer())
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const parsed = parseWorkbook(arrayBuffer)
  if (parsed.length === 0) throw new Error("Aucune feuille reconnue (Terre, Bois, Ventes erablière)")

  const org = await prisma.organisation.findFirst({ where: { id: process.env.DEFAULT_ORGANISATION_ID || "" } })
  if (!org) throw new Error("Organisation par défaut non initialisée")

  const importation = await prisma.importation.create({
    data: {
      organisationId: org.id,
      typeSource: "EXISTANT_EVAGRI",
      statut: "EN_COURS",
      lignesTotal: 0,
      lignesInserees: 0,
      lignesIgnorees: 0,
      lignesErreurs: 0,
    },
  })

  let totalRows = 0
  let totalInserted = 0
  let totalIgnored = 0
  const allErrors: { sheet: string; row: number; message: string }[] = []

  try {
    for (const sheet of parsed) {
      const typologie = await prisma.typologie.findUnique({
        where: { organisationId_code: { organisationId: org.id, code: sheet.typologieCode } },
      })
      if (!typologie) {
        allErrors.push({ sheet: sheet.sheet, row: 0, message: `Typologie ${sheet.typologieCode} inconnue` })
        continue
      }

      const enrichmentChamps = await ensureEnrichmentChamps(org.id, sheet.rows)
      const rows = sheet.rows.map((r) => rowToSourceFields(r) as any)
      totalRows += rows.length

      const { inserted, ignored, errors } = await importTransactions(
        org.id,
        rows,
        enrichmentChamps,
        sheet.rows,
        typologie.id,
        "EXISTANT_EVAGRI",
        importation.id
      )

      totalInserted += inserted
      totalIgnored += ignored
      allErrors.push(...errors.map((e) => ({ ...e, sheet: sheet.sheet })))
    }

    await prisma.importation.update({
      where: { id: importation.id },
      data: {
        statut: allErrors.length > 0 ? "TERMINE_AVEC_ERREURS" : "TERMINE",
        lignesTotal: totalRows,
        lignesInserees: totalInserted,
        lignesIgnorees: totalIgnored,
        lignesErreurs: allErrors.length,
        details: { errors: allErrors },
      },
    })
  } catch (e) {
    await prisma.importation.update({
      where: { id: importation.id },
      data: {
        statut: "EN_ECHEC",
        lignesErreurs: 1,
        details: { error: (e as Error).message },
      },
    })
    throw e
  }

  await logAudit({
    organisationId: org.id,
    tableCible: "importation",
    enregistrementId: importation.id,
    action: "INSERT",
    diff: { lignesTotal: totalRows, lignesInserees: totalInserted, typeSource: "EXISTANT_EVAGRI" },
  })

  return {
    importationId: importation.id,
    totalRows,
    inserted: totalInserted,
    ignored: totalIgnored,
    errors: allErrors,
  }
}

export async function listImports() {
  const org = await prisma.organisation.findFirst({ where: { id: process.env.DEFAULT_ORGANISATION_ID || "" } })
  if (!org) throw new Error("Organisation par défaut non initialisée")

  return prisma.importation.findMany({
    where: { organisationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

export async function retryImport(importationId: string) {
  const org = await prisma.organisation.findFirst({ where: { id: process.env.DEFAULT_ORGANISATION_ID || "" } })
  if (!org) throw new Error("Organisation par défaut non initialisée")

  const importation = await prisma.importation.findFirst({
    where: { id: importationId, organisationId: org.id },
  })
  if (!importation) throw new Error("Importation introuvable")
  if (importation.typeSource === "EXISTANT_EVAGRI") {
    throw new Error("Relance non disponible pour les imports Excel manuels. Veuillez ré-uploader le fichier.")
  }

  await prisma.importation.update({
    where: { id: importationId },
    data: { statut: "EN_COURS", lignesErreurs: 0, details: {} },
  })

  // JLR retry hook for RC phase
  return { success: true, message: "Importation marquée pour relance." }
}
