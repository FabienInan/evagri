"use server"

import { verifierZone } from "@/lib/session"
import { listHistoriqueEntite, type CibleHistorique, type EntreeHistorique } from "@/repositories/journal.repository"

export type HistoriqueResult =
  | { ok: true; entrees: (Omit<EntreeHistorique, "createdAt"> & { createdAt: string })[] }
  | { ok: false; error: string }

/** History of a transaction, panier or dossier, read from the audit journal of the caller's organisation. */
export async function listHistorique(cible: CibleHistorique): Promise<HistoriqueResult> {
  const acces = await verifierZone("evaluation")
  if (!acces.ok) return acces
  if (!["transaction", "panier", "dossier"].includes(cible.type) || typeof cible.id !== "string") {
    return { ok: false, error: "Cible d'historique invalide." }
  }
  try {
    const entrees = await listHistoriqueEntite(acces.utilisateur.organisationId, cible)
    return { ok: true, entrees: entrees.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })) }
  } catch (error) {
    console.error("listHistorique: échec de lecture", error)
    return { ok: false, error: "Impossible de charger l'historique. Réessayez." }
  }
}
