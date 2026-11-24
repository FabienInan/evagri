"use server"

import { utilisateurPourZone, verifierZone } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { saveFicheLayout as saveFicheLayoutRepo } from "@/repositories/fiche-layout.repository"
import { getEffectiveFicheLayout } from "@/server/fiche-layout"
import { sectionsSchema, type SectionInput } from "@/validators/section.validator"
import { journaliser } from "@/server/journal"

export async function getFicheLayout() {
  const utilisateur = await utilisateurPourZone("configuration")
  if (!utilisateur) return []
  return getEffectiveFicheLayout(utilisateur.organisationId)
}

/** Returns a result instead of throwing: a thrown action error is masked in production, so the editor
 *  could not tell a failed save from a successful one. */
export type SectionsActionResult = { ok: true } | { ok: false; error: string }

export async function saveFicheLayout(
  sections: SectionInput[]
): Promise<SectionsActionResult> {
  const acces = await verifierZone("configuration")
  if (!acces.ok) return acces
  const utilisateur = acces.utilisateur
  const organisationId = utilisateur.organisationId
  const parsed = sectionsSchema.safeParse(sections)
  if (!parsed.success) {
    return { ok: false, error: "Disposition invalide : chaque section doit avoir un nom." }
  }

  try {
    await saveFicheLayoutRepo(organisationId, parsed.data)
  } catch {
    return { ok: false, error: "Échec de l'enregistrement de la disposition." }
  }

  await journaliser(utilisateur, {

    tableCible: "disposition_fiche",

    enregistrementId: undefined,

    action: "UPDATE",

    diff: {},

  })

  revalidatePath("/admin/champs")
  return { ok: true }
}
