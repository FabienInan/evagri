import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function findFiltersByOrganisation(
  organisationId: string,
  options: { includeChamp?: boolean } = {}
) {
  return prisma.filtreRecherche.findMany({
    where: { organisationId },
    orderBy: { ordreAffichage: "asc" },
    include: options.includeChamp ? { champEnrichissable: true } : undefined,
  })
}

export async function findChampsByOrganisation(organisationId: string) {
  return prisma.champEnrichissable.findMany({ where: { organisationId } })
}

export async function findFilterByChampEnrichissableId(
  organisationId: string,
  champEnrichissableId: string
) {
  return prisma.filtreRecherche.findFirst({
    where: { organisationId, champEnrichissableId },
  })
}

export async function findFilterByCodeMachine(
  organisationId: string,
  codeMachine: string
) {
  return prisma.filtreRecherche.findUnique({
    where: { organisationId_codeMachine: { organisationId, codeMachine } },
  })
}

export async function createFilter(
  data: Prisma.FiltreRechercheCreateInput
) {
  return prisma.filtreRecherche.create({ data })
}

export async function updateFilter(
  id: string,
  data: Prisma.FiltreRechercheUpdateInput
) {
  return prisma.filtreRecherche.update({ where: { id }, data })
}

export async function updateFiltersOrder(
  filters: { id: string; ordreAffichage: number; estActif: boolean }[]
) {
  for (const f of filters) {
    await prisma.filtreRecherche.update({
      where: { id: f.id },
      data: { ordreAffichage: f.ordreAffichage, estActif: f.estActif },
    })
  }
}

export async function deleteFilter(id: string) {
  return prisma.filtreRecherche.delete({ where: { id } })
}
