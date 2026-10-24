import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { ChampEnrichissableConfig, ChampEnrichissableInput } from "@/types/champ"

function toConfig(champ: Prisma.ChampGetPayload<object>): ChampEnrichissableConfig {
  return {
    id: champ.id,
    codeMachine: champ.codeMachine,
    nomAffichage: champ.nomAffichage,
    typeDonnees: champ.typeDonnees as ChampEnrichissableConfig["typeDonnees"],
    nature: champ.nature as ChampEnrichissableConfig["nature"],
    unite: champ.unite,
    plageMin: champ.plageMin ? champ.plageMin.toNumber() : null,
    plageMax: champ.plageMax ? champ.plageMax.toNumber() : null,
    optionsListe: Array.isArray(champ.optionsListe) ? (champ.optionsListe as string[]) : null,
    regleCalcul: champ.regleCalcul,
    applicableATypes: Array.isArray(champ.applicableATypes) ? (champ.applicableATypes as string[]) : [],
    ordreAffichage: champ.ordreAffichage,
    estAffiche: champ.estAffiche,
    estObligatoire: champ.estObligatoire,
    typeFiltreRecommande: champ.typeFiltreRecommande,
    estLectureSeule: champ.estLectureSeule,
    actif: champ.actif,
  }
}

export async function listChampsEnrichissablesByOrganisation(
  organisationId: string
): Promise<ChampEnrichissableConfig[]> {
  const champs = await prisma.champ.findMany({
    where: { organisationId },
    orderBy: { ordreAffichage: "asc" },
  })
  return champs.map(toConfig)
}

export async function createChampEnrichissable(
  organisationId: string,
  input: ChampEnrichissableInput & { estLectureSeule: boolean }
): Promise<ChampEnrichissableConfig> {
  const created = await prisma.champ.create({
    data: {
      organisationId,
      codeMachine: input.codeMachine,
      nomAffichage: input.nomAffichage,
      typeDonnees: input.typeDonnees,
      nature: input.nature,
      unite: input.unite,
      plageMin: input.plageMin,
      plageMax: input.plageMax,
      optionsListe: input.optionsListe ?? Prisma.JsonNull,
      regleCalcul: input.regleCalcul,
      applicableATypes: input.applicableATypes,
      ordreAffichage: input.ordreAffichage,
      estAffiche: input.estAffiche,
      estObligatoire: input.estObligatoire,
      estLectureSeule: input.estLectureSeule,
    },
  })
  return toConfig(created)
}

/** Scoped by organisationId so an id from another tenant matches nothing instead of being updated. */
export async function updateChampEnrichissable(
  organisationId: string,
  id: string,
  input: ChampEnrichissableInput & { estLectureSeule: boolean }
): Promise<boolean> {
  const result = await prisma.champ.updateMany({
    where: { id, organisationId },
    data: {
      nomAffichage: input.nomAffichage,
      typeDonnees: input.typeDonnees,
      nature: input.nature,
      unite: input.unite,
      plageMin: input.plageMin,
      plageMax: input.plageMax,
      optionsListe: input.optionsListe ?? Prisma.JsonNull,
      regleCalcul: input.regleCalcul,
      applicableATypes: input.applicableATypes,
      ordreAffichage: input.ordreAffichage,
      estAffiche: input.estAffiche,
      estObligatoire: input.estObligatoire,
      estLectureSeule: input.estLectureSeule,
    },
  })
  return result.count > 0
}

export async function setChampActif(
  organisationId: string,
  id: string,
  actif: boolean
): Promise<boolean> {
  const result = await prisma.champ.updateMany({
    where: { id, organisationId },
    data: { actif },
  })
  return result.count > 0
}

/** Ownership check: returns the champ's id only when it belongs to the organisation. */
export async function findChampForOrganisation(organisationId: string, id: string) {
  return prisma.champ.findFirst({
    where: { id, organisationId },
    select: { id: true },
  })
}

export async function findChampByOrganisationAndCode(organisationId: string, codeMachine: string) {
  return prisma.champ.findUnique({
    where: { organisationId_codeMachine: { organisationId, codeMachine } },
    select: { id: true },
  })
}
