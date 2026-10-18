"use server"

import { parseWorkbook, rowToSourceFields } from "@/parsers/excel.parser"
import { findDefaultOrganisation, getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { ensureEnrichmentChamps } from "@/repositories/enrichment.repository"
import {
  createImportation,
  findImportationById,
  incrementImportationCounters,
  listImports as listImportRecords,
  markImportationFailed,
  resetImportForRetry,
  updateImportationResults,
} from "@/repositories/import.repository"
import { importSheet } from "@/services/import.service"
import { createAuditLog } from "@/repositories/audit.repository"
import { findTypologieByCode } from "@/repositories/import.repository"
import type { ParsedRow } from "@/types/import"

export type ImportExcelResult =
  | { ok: true; totalRows: number; inserted: number; ignored: number; errors: { sheet: string; row: number; message: string }[] }
  | { ok: false; error: string }

/** Server actions return errors instead of throwing them: in production Next.js masks the message of a
 *  thrown action error, so a validation message would reach the user as a generic error. */
export async function importExcel(formData: FormData): Promise<ImportExcelResult> {
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "No file provided" }

  let parsed: ReturnType<typeof parseWorkbook>
  let organisationId: string
  let importation: Awaited<ReturnType<typeof createImportation>>

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    parsed = parseWorkbook(arrayBuffer)
    if (parsed.length === 0) {
      return { ok: false, error: "Aucune feuille reconnue (Terre, Bois, Ventes erablière)" }
    }

    organisationId = getCurrentOrganisationId()
    const org = await findDefaultOrganisation()
    if (!org) return { ok: false, error: "Organisation par défaut non initialisée" }

    importation = await createImportation(organisationId, "EXISTANT_EVAGRI")
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

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
      // Publish the total upfront so the UI shows progress against a known denominator.
      await incrementImportationCounters(importation.id, { lignesTotal: rows.length })

      const { inserted, ignored, errors } = await importSheet({
        organisationId,
        rows,
        rawRows: sheet.rows,
        enrichmentChamps,
        systemeSource: "EXISTANT_EVAGRI",
        importationId: importation.id,
        typologieNom: typologie.nom,
        typologieCode: sheet.typologieCode,
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
    return { ok: false, error: (e as Error).message }
  }

  await createAuditLog({
    organisationId,
    tableCible: "importation",
    enregistrementId: importation.id,
    action: "INSERT",
    diff: { lignesTotal: totalRows, lignesInserees: totalInserted, typeSource: "EXISTANT_EVAGRI" },
  })

  return {
    ok: true,
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

export type RetryImportResult = { ok: true; message: string } | { ok: false; error: string }

export async function retryImport(importationId: string): Promise<RetryImportResult> {
  const organisationId = getCurrentOrganisationId()
  const importation = await findImportationById(importationId, organisationId)
  if (!importation) return { ok: false, error: "Importation introuvable" }
  if (importation.typeSource === "EXISTANT_EVAGRI") {
    return {
      ok: false,
      error: "Relance non disponible pour les imports Excel manuels. Veuillez ré-uploader le fichier.",
    }
  }

  await resetImportForRetry(importationId)
  return { ok: true, message: "Importation marquée pour relance." }
}
