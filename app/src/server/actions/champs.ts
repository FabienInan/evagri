"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  createChampEnrichissable,
  findChampByOrganisationAndCode,
  listChampCodesByOrganisation,
  listChampsEnrichissablesByOrganisation,
  setChampActif,
  updateChampEnrichissable,
} from "@/repositories/champs.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { deriveEstLectureSeule, formatChampInputErrors, normalizeChampInput, validateChampConfig } from "@/lib/champs"
import { IMPORTED_FIELD_BY_CODE } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig, ChampEnrichissableInput } from "@/types/champ"
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

/** Imported field codes plus every other champ's codeMachine in the organisation, minus the field being saved (avoids self-reference). */
async function buildKnownFieldCodes(organisationId: string, excludeCodeMachine: string): Promise<Set<string>> {
  const champCodes = await listChampCodesByOrganisation(organisationId)
  const codes = new Set<string>([...Object.keys(IMPORTED_FIELD_BY_CODE), ...champCodes])
  codes.delete(excludeCodeMachine)
  return codes
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
  const knownFieldCodes = await buildKnownFieldCodes(organisationId, parsed.data.codeMachine)
  const errors = validateChampConfig(normalized, knownFieldCodes)
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

  revalidatePath("/admin/champs")
  return { ok: true, champ }
}

export async function updateChamp(id: string, input: ChampInput): Promise<ChampActionResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = parseChampInput(input)
  if (!parsed.ok) return parsed

  const normalized = normalizeChampInput(parsed.data)
  const knownFieldCodes = await buildKnownFieldCodes(organisationId, parsed.data.codeMachine)
  const errors = validateChampConfig(normalized, knownFieldCodes)
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
