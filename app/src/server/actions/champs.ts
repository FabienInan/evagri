"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  createChampEnrichissable,
  findChampByOrganisationAndCode,
  listChampsEnrichissablesByOrganisation,
  setChampActif,
  updateChampEnrichissable,
} from "@/repositories/champs.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { deriveEstLectureSeule, formatChampInputErrors, normalizeChampInput, validateChampConfig } from "@/lib/champs"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { recalculerChampsCalcules } from "@/services/calcul.service"
import type { ChampEnrichissableConfig, ChampEnrichissableInput, TypeDonneesChamp } from "@/types/champ"
import { champInputSchema, type ChampInput } from "@/validators/champ.validator"

export type { ChampInput } from "@/validators/champ.validator"

export async function listChamps() {
  const organisationId = getCurrentOrganisationId()
  return listChampsEnrichissablesByOrganisation(organisationId)
}

export async function listTypologies() {
  const organisationId = getCurrentOrganisationId()
  return listTypologiesByOrganisation(organisationId)
}

/**
 * Server actions return errors instead of throwing them: in production Next.js masks the message of a
 * thrown action error, so a validation message would reach the user as a generic error.
 */
export type ChampActionResult = { ok: true } | { ok: false; error: string }

/** A creation returns the created champ so callers can update local state without reloading. */
export type CreateChampResult =
  | { ok: true; champ: ChampEnrichissableConfig }
  | { ok: false; error: string }

/** safeParse so a ZodError is never surfaced as raw JSON, and its issues become a readable sentence. */
function parseChampInput(
  input: ChampInput
): { ok: true; data: ChampEnrichissableInput } | { ok: false; error: string } {
  const result = champInputSchema.safeParse(input)
  if (!result.success) {
    return { ok: false, error: formatChampInputErrors(result.error) }
  }
  return { ok: true, data: result.data }
}

/**
 * Catalogue the validation of a champ needs: the type of every imported field and of every other champ of the
 * organisation, and the rules those other champs carry. The champ being saved (`selfId`, absent on creation) is
 * excluded; its stored version is returned as `previous`.
 */
async function loadChampCatalogue(organisationId: string, selfId?: string) {
  const champs = await listChampsEnrichissablesByOrganisation(organisationId)
  const previous = champs.find((champ) => champ.id === selfId)
  // A champ can carry the code of an imported field (its own row); that code is not a conflict for itself.
  const knownFields = new Map<string, TypeDonneesChamp>(
    IMPORTED_FIELDS.filter((f) => f.code !== previous?.codeMachine).map((f) => [f.code, f.typeDonnees])
  )
  const otherRules = new Map<string, string>()

  for (const champ of champs) {
    if (champ.id === selfId) continue
    knownFields.set(champ.codeMachine, champ.typeDonnees)
    if (champ.regleCalcul) otherRules.set(champ.codeMachine, champ.regleCalcul)
  }
  return { knownFields, otherRules, previous }
}

export async function createChamp(input: ChampInput): Promise<CreateChampResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = parseChampInput(input)
  if (!parsed.ok) return parsed

  const existing = await findChampByOrganisationAndCode(organisationId, parsed.data.codeMachine)
  if (existing) {
    return { ok: false, error: "Un champ existe déjà avec ce code machine." }
  }

  const normalized = normalizeChampInput(parsed.data)
  const { knownFields, otherRules } = await loadChampCatalogue(organisationId)
  const errors = validateChampConfig(normalized, knownFields, otherRules)
  if (errors.length > 0) {
    return { ok: false, error: errors[0].message }
  }

  let champ: ChampEnrichissableConfig
  try {
    champ = await createChampEnrichissable(organisationId, {
      ...normalized,
      // CALCULE is forced read-only regardless of the request (§6.5); other natures honor an explicit
      // value from the admin form and otherwise derive it from nature.
      estLectureSeule:
        normalized.nature === "CALCULE"
          ? true
          : parsed.data.estLectureSeule ?? deriveEstLectureSeule(normalized.nature),
    })
  } catch (error) {
    // A concurrent request can win the uniqueness race after the pre-check above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Un champ existe déjà avec ce code machine." }
    }
    throw error
  }

  if (normalized.regleCalcul) {
    await recalculerChampsCalcules(organisationId)
  }

  revalidatePath("/admin/champs")
  return { ok: true, champ }
}

export async function updateChamp(id: string, input: ChampInput): Promise<ChampActionResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = parseChampInput(input)
  if (!parsed.ok) return parsed

  const normalized = normalizeChampInput(parsed.data)
  const { knownFields, otherRules, previous } = await loadChampCatalogue(organisationId, id)
  const errors = validateChampConfig(normalized, knownFields, otherRules)
  if (errors.length > 0) {
    return { ok: false, error: errors[0].message }
  }

  const updated = await updateChampEnrichissable(organisationId, id, {
    ...normalized,
    // CALCULE is forced read-only regardless of the request (§6.5); other natures honor an explicit
    // value from the admin form and otherwise derive it from nature.
    estLectureSeule:
      normalized.nature === "CALCULE"
        ? true
        : parsed.data.estLectureSeule ?? deriveEstLectureSeule(normalized.nature),
  })
  if (!updated) {
    return { ok: false, error: "Champ introuvable." }
  }

  // Stored CALCULE values depend on the rules: recompute when the rule was set, changed or removed.
  if (normalized.regleCalcul || previous?.regleCalcul) {
    await recalculerChampsCalcules(organisationId)
  }

  revalidatePath("/admin/champs")
  return { ok: true }
}

export async function toggleChampActif(id: string, actif: boolean): Promise<ChampActionResult> {
  const organisationId = getCurrentOrganisationId()
  const updated = await setChampActif(organisationId, id, actif)
  if (!updated) {
    return { ok: false, error: "Champ introuvable." }
  }
  revalidatePath("/admin/champs")
  return { ok: true }
}
