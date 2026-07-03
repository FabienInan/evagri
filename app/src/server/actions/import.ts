"use server"

import { parseWorkbook, rowToSourceFields } from "@/parsers/excel.parser"
import { findDefaultOrganisation, getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { ensureEnrichmentChamps } from "@/repositories/enrichment.repository"
import {
  createImportation,
  findImportationById,
  listImports as listImportRecords,
  markImportationFailed,
  resetImportForRetry,
  updateImportationResults,
} from "@/repositories/import.repository"
import { importSheet } from "@/services/import.service"
import { createAuditLog } from "@/repositories/audit.repository"
import { findTypologieByCode } from "@/repositories/import.repository"
import type { ParsedRow } from "@/types/import"

export async function importExcel(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) throw new Error("No file provided")

  const buffer = Buffer.from(await file.arrayBuffer())
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const parsed = parseWorkbook(arrayBuffer)
  if (parsed.length === 0) throw new Error("Aucune feuille reconnue (Terre, Bois, Ventes erablière)")

  const organisationId = getCurrentOrganisationId()
  const org = await findDefaultOrganisation()
  if (!org) throw new Error("Organisation par défaut non initialisée")

  const importation = await createImportation(organisationId, "EXISTANT_EVAGRI")

  let totalRows = 0
  let totalInserted = 0
  let totalIgnored = 0
  const allErrors: { sheet: string; row: number; message: string }[] = []

  try {
    for (const sheet of parsed) {
      const typologie = await findTypologieByCode(organisationId, sheet.typologieCode)
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

  await createAuditLog({
    organisationId,
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
  const organisationId = getCurrentOrganisationId()
  return listImportRecords(organisationId)
}

export async function retryImport(importationId: string) {
  const organisationId = getCurrentOrganisationId()
  const importation = await findImportationById(importationId, organisationId)
  if (!importation) throw new Error("Importation introuvable")
  if (importation.typeSource === "EXISTANT_EVAGRI") {
    throw new Error("Relance non disponible pour les imports Excel manuels. Veuillez ré-uploader le fichier.")
  }

  await resetImportForRetry(importationId)
  return { success: true, message: "Importation marquée pour relance." }
}
