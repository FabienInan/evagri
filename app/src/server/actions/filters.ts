"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { FILTER_OPERATORS, FILTER_TYPES } from "@/types/filter"
import {
  createFilter as createFilterRepo,
  deleteFilter as deleteFilterRepo,
  findChampsByOrganisation,
  findFilterByChampEnrichissableId,
  findFilterByCodeMachine,
  findFiltersByOrganisation,
  updateFiltersOrder,
  type CreateFilterRepositoryInput,
} from "@/repositories/filters.repository"

export async function listFilters() {
  const organisationId = getCurrentOrganisationId()
  return findFiltersByOrganisation(organisationId, { includeChamp: true })
}

export async function listChamps() {
  const organisationId = getCurrentOrganisationId()
  return findChampsByOrganisation(organisationId)
}

const createFilterSchema = z.object({
  nomFiltre: z.string().min(1),
  typeFiltre: z.enum(FILTER_TYPES),
  champEnrichissableId: z.string().nullable(),
  codeMachine: z.string().nullable(),
  operateurs: z.array(z.enum(FILTER_OPERATORS)).nullable(),
  ordreAffichage: z.number().int(),
})

export type CreateFilterInput = z.infer<typeof createFilterSchema>

export async function createFilter(input: CreateFilterInput) {
  const organisationId = getCurrentOrganisationId()
  const parsed = createFilterSchema.parse(input)

  if (parsed.champEnrichissableId) {
    const existing = await findFilterByChampEnrichissableId(
      organisationId,
      parsed.champEnrichissableId
    )
    if (existing) {
      throw new Error("Un filtre existe déjà pour ce champ.")
    }
  }

  if (parsed.codeMachine) {
    const existing = await findFilterByCodeMachine(organisationId, parsed.codeMachine)
    if (existing) {
      throw new Error("Un filtre existe déjà pour ce code virtuel.")
    }
  }

  const data: CreateFilterRepositoryInput = {
    organisation: { connect: { id: organisationId } },
    nomFiltre: parsed.nomFiltre,
    typeFiltre: parsed.typeFiltre,
    champEnrichissable: parsed.champEnrichissableId
      ? { connect: { id: parsed.champEnrichissableId } }
      : undefined,
    codeMachine: parsed.codeMachine,
    operateursDisponibles: parsed.operateurs as CreateFilterRepositoryInput["operateursDisponibles"],
    ordreAffichage: parsed.ordreAffichage,
  }

  await createFilterRepo(data)
  revalidatePath("/admin/filters")
}

export async function publishFilters(
  filters: { id: string; ordreAffichage: number; estActif: boolean }[]
) {
  await updateFiltersOrder(filters)
  revalidatePath("/admin/filters")
}

export async function deleteFilter(id: string) {
  await deleteFilterRepo(id)
  revalidatePath("/admin/filters")
}
