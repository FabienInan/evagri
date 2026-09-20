import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { FilterConfig } from "@/types/filter"
import { isSourceFieldCode, sourceColumnOf, SOURCE_FIELD_BY_CODE } from "@/lib/transaction-source-fields"

const LIST_TYPE_FILTRES = new Set(["LISTE", "MULTI_SELECT"])

function distinctNonEmpty(values: (string | null)[]): string[] {
  const unique = Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== "")))
  return unique.sort((a, b) => a.localeCompare(b))
}

async function findDistinctEnrichmentValues(champEnrichissableId: string): Promise<string[]> {
  const rows = await prisma.valeurEnrichissement.findMany({
    where: { champEnrichissableId, valeurTexte: { not: null } },
    select: { valeurTexte: true },
    distinct: ["valeurTexte"],
  })
  return distinctNonEmpty(rows.map((r) => r.valeurTexte))
}

/** Distinct non-empty values of a text source column, for a list-type filter's dropdown. */
async function findDistinctSourceValues(organisationId: string, code: string): Promise<string[]> {
  const descriptor = SOURCE_FIELD_BY_CODE[code]
  if (!descriptor || descriptor.array || descriptor.typeDonnees !== "TEXTE") return []
  const column = sourceColumnOf(code) as string
  const rows = await prisma.transactionSource.findMany({
    where: { organisationId, [column]: { not: "" } },
    select: { [column]: true },
    distinct: [column],
  } as Prisma.TransactionSourceFindManyArgs)
  return distinctNonEmpty((rows as Record<string, unknown>[]).map((r) => r[column] as string | null))
}

export async function findFiltersByOrganisation(
  organisationId: string,
  options: { includeChamp?: boolean } = {}
): Promise<FilterConfig[]> {
  const filters = await prisma.filtreRecherche.findMany({
    where: { organisationId },
    orderBy: { ordreAffichage: "asc" },
    include: options.includeChamp ? { champEnrichissable: true } : undefined,
  })

  const withOptions = await Promise.all(
    filters.map(async (f) => {
      const champ = (f as { champEnrichissable?: Prisma.ChampEnrichissableGetPayload<object> | null })
        .champEnrichissable

      // Distinct dropdown values: static champ options win, otherwise source column or enrichment values.
      let optionsListe: string[] | null = null
      if (champ) {
        const staticOptions = Array.isArray(champ.optionsListe) && champ.optionsListe.length > 0
        if (staticOptions) {
          optionsListe = champ.optionsListe as string[]
        } else if (LIST_TYPE_FILTRES.has(f.typeFiltre)) {
          optionsListe = await findDistinctEnrichmentValues(champ.id)
        }
      } else if (LIST_TYPE_FILTRES.has(f.typeFiltre) && isSourceFieldCode(f.codeMachine)) {
        optionsListe = await findDistinctSourceValues(organisationId, f.codeMachine as string)
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
  return prisma.champEnrichissable.findMany({
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

export type CreateFilterRepositoryInput = Prisma.FiltreRechercheCreateInput

export async function createFilter(
  data: CreateFilterRepositoryInput
) {
  return prisma.filtreRecherche.create({ data })
}

export async function updateFiltersOrder(
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
      prisma.filtreRecherche.update({
        where: { id: f.id },
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

export async function deleteFilter(id: string) {
  return prisma.filtreRecherche.delete({ where: { id } })
}
