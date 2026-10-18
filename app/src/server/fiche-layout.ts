import type { FicheSection } from "@/types/champ"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { findSavedFicheLayout } from "@/repositories/fiche-layout.repository"
import { buildDefaultFicheLayout } from "@/lib/fiche-layout"
import { TYPE_TRANSACTION_CODE } from "@/lib/fiche"

/**
 * Effective fiche layout: the saved one whenever it exists (even empty), otherwise the default layout
 * (imported champs plus a modifiable "Champs à enrichir" section). Keeping the "never saved" and "saved
 * empty" cases distinct means deleting every section is a durable choice, not something the default
 * overwrites.
 */
export async function getEffectiveFicheLayout(organisationId: string): Promise<FicheSection[]> {
  const saved = await findSavedFicheLayout(organisationId)
  if (saved !== null) return saved

  const champs = await listChampsEnrichissablesByOrganisation(organisationId)
  const importedChampIds = champs.filter((c) => c.nature === "IMPORTE").map((c) => c.id)

  // Le type de transaction est rendu dans l'en-tête de la fiche, pas dans une section : l'écarter ici
  // évite de le voir apparaître deux fois dans l'éditeur de disposition.
  const saisissables = champs.filter(
    (c) =>
      c.nature === "SAISISSABLE" &&
      c.actif &&
      c.estAffiche &&
      c.codeMachine !== TYPE_TRANSACTION_CODE
  )
  // Priorité aux obligatoires ; s'il n'y en a aucun, proposer tous les champs saisissables affichés
  // pour que la section par défaut ne soit jamais vide alors qu'il y a des champs à enrichir.
  const obligatoires = saisissables.filter((c) => c.estObligatoire)
  const enrichChampIds = (obligatoires.length > 0 ? obligatoires : saisissables).map((c) => c.id)

  return buildDefaultFicheLayout({ importedChampIds, enrichChampIds })
}
