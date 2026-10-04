"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findFicheLayout, saveFicheLayout as saveFicheLayoutRepo } from "@/repositories/fiche-layout.repository"

export async function getFicheLayout() {
  const organisationId = getCurrentOrganisationId()
  return findFicheLayout(organisationId)
}

const sectionSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  ordre: z.number().int(),
  champs: z.array(z.string()),
})

const sectionsSchema = z.array(sectionSchema)

/** Returns a result instead of throwing: a thrown action error is masked in production, so the editor
 *  could not tell a failed save from a successful one. */
export type SectionsActionResult = { ok: true } | { ok: false; error: string }

export async function saveFicheLayout(
  sections: z.infer<typeof sectionsSchema>
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
