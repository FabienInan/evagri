"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
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
import { deriveEstModifiable, formatChampInputErrors, normalizeChampInput, validateChampConfig } from "@/lib/champs"
import { SOURCE_FIELD_CODES } from "@/lib/transaction-source-fields"
import { NATURE_CHAMP, TYPE_DONNEES_CHAMP } from "@/types/champ"
import type { ChampEnrichissableInput } from "@/types/champ"

export async function listChamps() {
  const organisationId = getCurrentOrganisationId()
  return listChampsEnrichissablesByOrganisation(organisationId)
}

export async function listTypologies() {
  const organisationId = getCurrentOrganisationId()
  return listTypologiesByOrganisation(organisationId)
}

const champInputSchema = z.object({
  codeMachine: z.string().min(1),
  nomAffichage: z.string().min(1),
  typeDonnees: z.enum(TYPE_DONNEES_CHAMP),
  nature: z.enum(NATURE_CHAMP),
  unite: z.string(),
  plageMin: z.number().nullable(),
  plageMax: z.number().nullable(),
  optionsListe: z.array(z.string()).nullable(),
  regleCalcul: z.string().nullable(),
  applicableATypes: z.array(z.string()),
  ordreAffichage: z.number().int(),
  estAffiche: z.boolean(),
  estObligatoire: z.boolean(),
})

export type ChampInput = z.infer<typeof champInputSchema>

/**
 * Server actions return errors instead of throwing them: in production Next.js masks the message of a
 * thrown action error, so a validation message would reach the user as a generic error.
 */
export type ChampActionResult = { ok: true } | { ok: false; error: string }

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

/** Source field codes plus every other champ's codeMachine in the organisation, minus the field being saved (avoids self-reference). */
async function buildKnownFieldCodes(organisationId: string, excludeCodeMachine: string): Promise<Set<string>> {
  const champCodes = await listChampCodesByOrganisation(organisationId)
  const codes = new Set<string>([...SOURCE_FIELD_CODES, ...champCodes])
  codes.delete(excludeCodeMachine)
  return codes
}

export async function createChamp(input: ChampInput): Promise<ChampActionResult> {
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

  await createChampEnrichissable(organisationId, {
    ...normalized,
    estModifiable: deriveEstModifiable(normalized.nature),
  })

  revalidatePath("/admin/champs")
  return { ok: true }
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
    estModifiable: deriveEstModifiable(normalized.nature),
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
