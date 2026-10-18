"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { saveFicheLayout as saveFicheLayoutRepo } from "@/repositories/fiche-layout.repository"
import { getEffectiveFicheLayout } from "@/server/fiche-layout"
import { sectionsSchema, type SectionInput } from "@/validators/section.validator"

export async function getFicheLayout() {
  const organisationId = getCurrentOrganisationId()
  return getEffectiveFicheLayout(organisationId)
}

/** Returns a result instead of throwing: a thrown action error is masked in production, so the editor
 *  could not tell a failed save from a successful one. */
export type SectionsActionResult = { ok: true } | { ok: false; error: string }

export async function saveFicheLayout(
  sections: SectionInput[]
): Promise<SectionsActionResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = sectionsSchema.safeParse(sections)
  if (!parsed.success) {
    return { ok: false, error: "Disposition invalide : chaque section doit avoir un nom." }
  }

  try {
    await saveFicheLayoutRepo(organisationId, parsed.data)
  } catch {
    return { ok: false, error: "Échec de l'enregistrement de la disposition." }
  }

  revalidatePath("/admin/champs")
  return { ok: true }
}
