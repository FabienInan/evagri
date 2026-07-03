"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  createFilter as createFilterRepo,
  deleteFilter as deleteFilterRepo,
  findChampsByOrganisation,
  findFilterByChampEnrichissableId,
  findFilterByCodeMachine,
  findFiltersByOrganisation,
  updateFilter as updateFilterRepo,
  updateFiltersOrder,
} from "@/repositories/filters.repository"
import { FILTER_OPERATORS, FILTER_TYPES } from "@/types/filter"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

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

  const data: Prisma.FiltreRechercheCreateInput = {
    organisation: { connect: { id: organisationId } },
    nomFiltre: parsed.nomFiltre,
    typeFiltre: parsed.typeFiltre,
    champEnrichissable: parsed.champEnrichissableId
      ? { connect: { id: parsed.champEnrichissableId } }
      : undefined,
    codeMachine: parsed.codeMachine,
    operateursDisponibles: parsed.operateurs as Prisma.InputJsonValue,
    ordreAffichage: parsed.ordreAffichage,
  }

  await createFilterRepo(data)
  revalidatePath("/admin/filters")
}

const updateFilterSchema = z.object({
  nomFiltre: z.string().min(1).optional(),
  typeFiltre: z.enum(FILTER_TYPES).optional(),
  operateursDisponibles: z.array(z.enum(FILTER_OPERATORS)).optional(),
  ordreAffichage: z.number().int().optional(),
  estActif: z.boolean().optional(),
})

export type UpdateFilterInput = z.infer<typeof updateFilterSchema>

export async function updateFilter(id: string, input: UpdateFilterInput) {
  updateFilterSchema.parse(input)
  const data: Prisma.FiltreRechercheUpdateInput = {
    ...input,
    operateursDisponibles: input.operateursDisponibles as Prisma.InputJsonValue,
  }
  await updateFilterRepo(id, data)
  revalidatePath("/admin/filters")
}

export async function updateFilterOrder(
  filters: { id: string; ordreAffichage: number; estActif: boolean }[]
) {
  await updateFiltersOrder(filters)
  revalidatePath("/admin/filters")
}

export async function deleteFilter(id: string) {
  await deleteFilterRepo(id)
  revalidatePath("/admin/filters")
}
