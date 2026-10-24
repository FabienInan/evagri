"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findDossierById } from "@/repositories/dossier.repository"
import {
  createAnalyse as repoCreateAnalyse,
  deleteAnalyse as repoDeleteAnalyse,
  findAnalyseById,
  listAnalysesByDossier,
  listIndicateursForAnalyse,
  listTransactionsOfDossier,
  replaceIndicateurs,
  updateAnalyse as repoUpdateAnalyse,
  type AnalyseDossierData,
} from "@/repositories/analyse-dossier.repository"
import { computeIndicateursAjustesByTransaction, type AnalyseParams } from "@/lib/analyse-dossier"
import { serializeAnalyse, type SerializedAnalyse } from "@/serializers/analyse-dossier.serializer"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import {
  analyseDossierSchema,
  formatAnalyseDossierInputErrors,
  updateAnalyseDossierSchema,
  type AnalyseDossierInput,
} from "@/validators/analyse-dossier.validator"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** Passe du formulaire (pourcentage, montants) au format stocké (fraction pour le taux). */
type AnalyseFormInput = Omit<AnalyseDossierInput, "dossierId">

function toStoredData(input: AnalyseFormInput): AnalyseDossierData {
  return {
    dateEvaluation: new Date(`${input.dateEvaluation}T00:00:00.000Z`),
    tauxCroissance: Number((input.tauxCroissancePct / 100).toFixed(4)),
    tauxBoiseRef: input.tauxBoiseRef,
    tauxCultiveRef: input.tauxCultiveRef,
    valeurBatimentRef: input.valeurBatimentRef,
    valeurMaisonRef: input.valeurMaisonRef,
    valeurTerrainResidentielRef: input.valeurTerrainResidentielRef,
  }
}

/** Recalcule les indicateurs d'une analyse sur les transactions du dossier. */
async function computeAnalyse(organisationId: string, dossierId: string, analyseId: string, params: AnalyseParams) {
  const transactions = (await listTransactionsOfDossier(organisationId, dossierId)).map(serializeTransaction)
  await replaceIndicateurs(organisationId, analyseId, computeIndicateursAjustesByTransaction(params, transactions))
}

export async function listAnalysesForDossier(dossierId: string): Promise<SerializedAnalyse[]> {
  const organisationId = getCurrentOrganisationId()
  return (await listAnalysesByDossier(organisationId, dossierId)).map(serializeAnalyse)
}

export async function createAnalyseDossier(
  input: AnalyseDossierInput
): Promise<Result<{ id: string }>> {
  const organisationId = getCurrentOrganisationId()
  const parsed = analyseDossierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatAnalyseDossierInputErrors(parsed.error) }

  const dossier = await findDossierById(organisationId, parsed.data.dossierId)
  if (!dossier) return { ok: false, error: "Dossier introuvable." }

  const analyse = await repoCreateAnalyse(organisationId, parsed.data.dossierId, toStoredData(parsed.data))
  const serialized = serializeAnalyse(analyse)
  await computeAnalyse(organisationId, parsed.data.dossierId, analyse.id, serialized)
  revalidatePath(`/dossiers/${parsed.data.dossierId}`)
  return { ok: true, id: analyse.id }
}

export async function updateAnalyseDossier(input: AnalyseFormInput & { id: string }): Promise<Result> {
  const organisationId = getCurrentOrganisationId()
  const parsed = updateAnalyseDossierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatAnalyseDossierInputErrors(parsed.error) }

  const existing = await findAnalyseById(organisationId, parsed.data.id)
  if (!existing) return { ok: false, error: "Analyse introuvable." }

  const dossierId = existing.dossierId
  const analyse = await repoUpdateAnalyse(organisationId, parsed.data.id, toStoredData(parsed.data))
  await computeAnalyse(organisationId, dossierId, analyse.id, serializeAnalyse(analyse))
  revalidatePath(`/dossiers/${dossierId}`)
  return { ok: true }
}

export async function deleteAnalyseDossier(id: string): Promise<Result> {
  const organisationId = getCurrentOrganisationId()
  const existing = await findAnalyseById(organisationId, id)
  if (!existing) return { ok: false, error: "Analyse introuvable." }

  await repoDeleteAnalyse(organisationId, id)
  revalidatePath(`/dossiers/${existing.dossierId}`)
  return { ok: true }
}

/** Indicateurs ajustés d'une analyse pour les transactions demandées, indexés par identifiant de transaction. */
export async function getIndicateursAjustesForExport(
  analyseId: string,
  transactionIds: string[]
): Promise<Result<{ values: Record<string, Record<string, number | null>> }>> {
  const organisationId = getCurrentOrganisationId()
  const analyse = await findAnalyseById(organisationId, analyseId)
  if (!analyse) return { ok: false, error: "Analyse introuvable." }

  const rows = await listIndicateursForAnalyse(organisationId, analyseId, transactionIds)
  const values: Record<string, Record<string, number | null>> = {}
  for (const row of rows) {
    values[row.transactionId] = {
      prix_actualise: row.prixVenteAjuste?.toNumber() ?? null,
      taux_global_ajuste: row.tauxGlobalAjuste?.toNumber() ?? null,
      taux_residuel_cultive_ajuste: row.tauxResiduelCultiveAjuste?.toNumber() ?? null,
      taux_residuel_boise_ajuste: row.tauxResiduelBoiseAjuste?.toNumber() ?? null,
      taux_residuel_batiment_ajuste: row.tauxResiduelBatimentAjuste?.toNumber() ?? null,
      taux_par_entaille_ajuste: row.tauxParEntailleAjuste?.toNumber() ?? null,
    }
  }
  return { ok: true, values }
}
