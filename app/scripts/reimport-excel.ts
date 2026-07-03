import { readFile } from "fs/promises"
import { prisma } from "../src/lib/prisma"
import { getCurrentOrganisationId } from "../src/repositories/organisation.repository"
import { parseWorkbook, rowToSourceFields } from "../src/parsers/excel.parser"
import { ensureEnrichmentChamps } from "../src/repositories/enrichment.repository"
import {
  createImportation,
  markImportationFailed,
  updateImportationResults,
} from "../src/repositories/import.repository"
import { importSheet } from "../src/services/import.service"
import type { ParsedRow } from "../src/types/import"

const FILE_PATH = "/Users/fabien/Documents/projets/Evagri/base_donnees_evagri.xlsx"

async function clearExistingImport(organisationId: string) {
  console.log("Clearing existing EXISTANT_EVAGRI transactions...")
  const txIds = await prisma.transactionSource.findMany({
    where: { organisationId, systemeSource: "EXISTANT_EVAGRI" },
    select: { id: true },
  })
  const ids = txIds.map((t) => t.id)
  if (ids.length === 0) {
    console.log("No existing EXISTANT_EVAGRI transactions to clear.")
    return
  }

  await prisma.valeurEnrichissement.deleteMany({
    where: { transactionEnrichie: { transactionSourceId: { in: ids } } },
  })
  await prisma.transactionEnrichie.deleteMany({
    where: { transactionSourceId: { in: ids } },
  })
  await prisma.documentActe.deleteMany({
    where: { transactionSourceId: { in: ids } },
  })
  await prisma.transactionSource.deleteMany({
    where: { id: { in: ids } },
  })
  console.log(`Cleared ${ids.length} existing transactions.`)
}

async function main() {
  const organisationId = getCurrentOrganisationId()

  const org = await prisma.organisation.findUnique({ where: { id: organisationId } })
  if (!org) throw new Error("Organisation par défaut non initialisée")

  const buffer = await readFile(FILE_PATH)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const parsed = parseWorkbook(arrayBuffer)
  if (parsed.length === 0) throw new Error("Aucune feuille reconnue")

  await clearExistingImport(organisationId)

  const importation = await createImportation(organisationId, "EXISTANT_EVAGRI")

  let totalRows = 0
  let totalInserted = 0
  let totalIgnored = 0
  const allErrors: { sheet: string; row: number; message: string }[] = []

  try {
    for (const sheet of parsed) {
      const typologie = await prisma.typologie.findUnique({
        where: { organisationId_code: { organisationId, code: sheet.typologieCode } },
      })
      if (!typologie) {
        allErrors.push({ sheet: sheet.sheet, row: 0, message: `Typologie ${sheet.typologieCode} inconnue` })
        continue
      }

      const enrichmentChamps = await ensureEnrichmentChamps(organisationId, sheet.rows)
      const rows = sheet.rows.map((r) => rowToSourceFields(r) as ParsedRow)
      totalRows += rows.length

      const { inserted, ignored, errors } = await importSheet({
        organisationId,
        rows,
        rawRows: sheet.rows,
        enrichmentChamps,
        systemeSource: "EXISTANT_EVAGRI",
        importationId: importation.id,
        typologieNom: typologie.nom,
      })

      totalInserted += inserted
      totalIgnored += ignored
      allErrors.push(...errors.map((e) => ({ ...e, sheet: sheet.sheet })))
    }

    await updateImportationResults(importation.id, {
      statut: allErrors.length > 0 ? "TERMINE_AVEC_ERREURS" : "TERMINE",
      lignesTotal: totalRows,
      lignesInserees: totalInserted,
      lignesIgnorees: totalIgnored,
      lignesErreurs: allErrors.length,
      details: { errors: allErrors },
    })
  } catch (e) {
    await markImportationFailed(importation.id, e as Error)
    throw e
  }

  console.log("Import complete:")
  console.log({ totalRows, totalInserted, totalIgnored, errors: allErrors.length })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
