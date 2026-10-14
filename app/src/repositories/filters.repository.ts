import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { FilterConfig } from "@/types/filter"

/** Filter types whose dropdown is fed by distinct values read from ValeurChamp. */
const OPTION_HYDRATING_FILTRES = new Set(["LISTE", "MULTI_SELECT", "NUMERO_LOT"])

/**
 * Distinct non-empty values of a champ across the organisation's transactions, for a list-type filter's
 * dropdown. Reads scalar text values and each element of the multi-valued column, scoped through the
 * transaction so values never leak across tenants.
 */
export async function findDistinctFieldValues(
  organisationId: string,
  codeMachine: string
): Promise<string[]> {
  const rows = await prisma.valeurChamp.findMany({
    where: { transaction: { organisationId }, champ: { codeMachine } },
    select: { valeurTexte: true, valeurTexteMultiple: true },
  })
  const values = new Set<string>()
  for (const r of rows) {
    if (r.valeurTexte && r.valeurTexte.trim() !== "") values.add(r.valeurTexte)
    for (const v of r.valeurTexteMultiple) values.add(v)
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"))
}

export async function findFiltersByOrganisation(
  organisationId: string
): Promise<FilterConfig[]> {
  const filters = await prisma.filtreRecherche.findMany({
    where: { organisationId },
    orderBy: { ordreAffichage: "asc" },
    include: { champ: true },
  })

  const withOptions = await Promise.all(
    filters.map(async (f) => {
      // Distinct dropdown values: a champ's static optionsListe wins, otherwise the values stored in
      // ValeurChamp. A virtual filter (no champ) falls back to its own codeMachine when it carries one.
      let optionsListe: string[] | null = null
      if (f.champ) {
        const staticOptions = Array.isArray(f.champ.optionsListe) && f.champ.optionsListe.length > 0
        if (staticOptions) {
          optionsListe = f.champ.optionsListe as string[]
        } else if (OPTION_HYDRATING_FILTRES.has(f.typeFiltre)) {
          optionsListe = await findDistinctFieldValues(organisationId, f.champ.codeMachine)
        }
      } else if (OPTION_HYDRATING_FILTRES.has(f.typeFiltre) && f.codeMachine) {
        optionsListe = await findDistinctFieldValues(organisationId, f.codeMachine)
      }

      return {
        ...f,
        typeFiltre: f.typeFiltre,
        operateursDisponibles: Array.isArray(f.operateursDisponibles)
          ? (f.operateursDisponibles as string[])
          : null,
        optionsListe: optionsListe && optionsListe.length > 0 ? optionsListe : null,
      }
    })
  )

  return withOptions as FilterConfig[]
}

export async function findChampsByOrganisation(organisationId: string) {
  return prisma.champ.findMany({
    where: { organisationId },
    select: {
      id: true,
      codeMachine: true,
      nomAffichage: true,
      typeDonnees: true,
      unite: true,
      typeFiltreRecommande: true,
    },
  })
}

export async function findFilterByChampId(
  organisationId: string,
  champId: string
) {
  return prisma.filtreRecherche.findFirst({
    where: { organisationId, champId },
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

export type CreateFilterRepositoryInput = Prisma.FiltreRechercheCreateInput

export async function createFilter(
  data: CreateFilterRepositoryInput
) {
  return prisma.filtreRecherche.create({ data })
}

/** Scoped by organisationId: updateMany skips ids from another tenant instead of updating them. */
export async function updateFiltersOrder(
  organisationId: string,
  filters: {
    id: string
    ordreAffichage: number
    estActif: boolean
    typeFiltre?: string
    operateursDisponibles?: string[] | null
  }[]
) {
  await prisma.$transaction(
    filters.map((f) =>
      prisma.filtreRecherche.updateMany({
        where: { id: f.id, organisationId },
        data: {
          ordreAffichage: f.ordreAffichage,
          estActif: f.estActif,
          ...(f.typeFiltre ? { typeFiltre: f.typeFiltre } : {}),
          ...(f.operateursDisponibles !== undefined
            ? { operateursDisponibles: f.operateursDisponibles ?? Prisma.JsonNull }
            : {}),
        },
      })
    )
  )
}

export async function deleteFilter(organisationId: string, id: string): Promise<boolean> {
  const result = await prisma.filtreRecherche.deleteMany({ where: { id, organisationId } })
  return result.count > 0
}
