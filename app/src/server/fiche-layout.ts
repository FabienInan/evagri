import type { FicheSection } from "@/types/champ"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { findSavedFicheLayout } from "@/repositories/fiche-layout.repository"
import { buildDefaultFicheLayout } from "@/lib/fiche-layout"

/**
 * Effective fiche layout: the saved one whenever it exists (even empty), otherwise a single default
 * section holding the priority enrichable fields. Keeping the "never saved" and "saved empty" cases
 * distinct means deleting every section is a durable choice, not something the default overwrites.
 */
export async function getEffectiveFicheLayout(organisationId: string): Promise<FicheSection[]> {
  const saved = await findSavedFicheLayout(organisationId)
  if (saved !== null) return saved

  const champs = await listChampsEnrichissablesByOrganisation(organisationId)
  const priorityChampIds = champs
    .filter((c) => c.nature === "SAISISSABLE" && c.actif && c.estAffiche && c.estObligatoire)
    .map((c) => c.id)

  return buildDefaultFicheLayout(priorityChampIds)
}
