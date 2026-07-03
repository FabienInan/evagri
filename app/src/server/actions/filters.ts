"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { FILTER_OPERATORS, FILTER_TYPES } from "@/types/filter"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

export async function listFilters() {
  const organisationId = getCurrentOrganisationId()
  return prisma.filtreRecherche.findMany({
    where: { organisationId },
    orderBy: { ordreAffichage: "asc" },
    include: { champEnrichissable: true },
  })
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
    const existing = await prisma.filtreRecherche.findFirst({
      where: { organisationId, champEnrichissableId: parsed.champEnrichissableId },
    })
    if (existing) {
      throw new Error("Un filtre existe déjà pour ce champ.")
    }
  }

  if (parsed.codeMachine) {
    const existing = await prisma.filtreRecherche.findUnique({
      where: { organisationId_codeMachine: { organisationId, codeMachine: parsed.codeMachine } },
    })
    if (existing) {
      throw new Error("Un filtre existe déjà pour ce code virtuel.")
    }
  }

  await prisma.filtreRecherche.create({
    data: {
      organisationId,
      nomFiltre: parsed.nomFiltre,
      typeFiltre: parsed.typeFiltre,
      champEnrichissableId: parsed.champEnrichissableId,
      codeMachine: parsed.codeMachine,
      operateursDisponibles: parsed.operateurs as Prisma.InputJsonValue,
      ordreAffichage: parsed.ordreAffichage,
    },
  })

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
  await prisma.filtreRecherche.update({ where: { id }, data })
  revalidatePath("/admin/filters")
}

export async function updateFilterOrder(
  filters: { id: string; ordreAffichage: number; estActif: boolean }[]
) {
  for (const f of filters) {
    await prisma.filtreRecherche.update({
      where: { id: f.id },
      data: { ordreAffichage: f.ordreAffichage, estActif: f.estActif },
    })
  }
  revalidatePath("/admin/filters")
}

export async function deleteFilter(id: string) {
  await prisma.filtreRecherche.delete({ where: { id } })
  revalidatePath("/admin/filters")
}
