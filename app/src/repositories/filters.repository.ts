import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { FilterConfig } from "@/types/filter"

const LIST_TYPE_FILTRES = new Set(["LISTE", "MULTI_SELECT"])

// Colonnes texte de TransactionSource pouvant alimenter un select de valeurs distinctes
const SOURCE_TEXT_FIELDS = new Set(["numeroInscription", "vendeur", "acheteur", "adresse", "municipalite", "mrc", "systemeSource"])

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

// Requête générique sur une colonne texte de TransactionSource (accès dynamique, hors typage strict Prisma)
async function findDistinctSourceValues(organisationId: string, field: string): Promise<string[]> {
  if (!SOURCE_TEXT_FIELDS.has(field)) return []
  const rows = await prisma.transactionSource.findMany({
    where: { organisationId, [field]: { not: "" } },
    select: { [field]: true },
    distinct: [field],
  } as Prisma.TransactionSourceFindManyArgs)
  return distinctNonEmpty((rows as Record<string, unknown>[]).map((r) => r[field] as string | null))
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
      const champ = (f as { champEnrichissable?: Prisma.ChampEnrichissableGetPayload<object> | null }).champEnrichissable
      const hasStaticOptions = Array.isArray(champ?.optionsListe) && champ.optionsListe.length > 0

      if (champ && LIST_TYPE_FILTRES.has(f.typeFiltre) && !hasStaticOptions) {
        const valeurs =
          champ.nature === "SOURCE"
            ? await findDistinctSourceValues(organisationId, champ.codeMachine)
            : await findDistinctEnrichmentValues(champ.id)

        if (valeurs.length > 0) {
          return { ...f, champEnrichissable: { ...champ, optionsListe: valeurs } }
        }
      }

      return f
    })
  )

  return withOptions.map((f) => ({
    ...f,
    typeFiltre: f.typeFiltre,
    operateursDisponibles: Array.isArray(f.operateursDisponibles)
      ? (f.operateursDisponibles as string[])
      : null,
  })) as FilterConfig[]
}

export async function findChampsByOrganisation(organisationId: string) {
  return prisma.champEnrichissable.findMany({
    where: { organisationId },
    select: {
      id: true,
      codeMachine: true,
      nomAffichage: true,
      typeDonnees: true,
      nature: true,
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
