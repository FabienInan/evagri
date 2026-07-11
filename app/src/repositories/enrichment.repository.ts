import { prisma } from "@/lib/prisma"
import { extractNonEmptyEnrichmentHeaders, inferType } from "@/parsers/excel.parser"
import type { EnrichmentChamp } from "@/types/import"

export type { EnrichmentChamp }

function buildCodeMachine(header: string): string {
  return header
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
}

export async function ensureEnrichmentChamps(
  organisationId: string,
  sheetRows: Record<string, unknown>[]
): Promise<EnrichmentChamp[]> {
  const candidates = extractNonEmptyEnrichmentHeaders(sheetRows)
  const result: EnrichmentChamp[] = []

  for (const candidate of candidates) {
    const codeMachine = buildCodeMachine(candidate.header)

    const existing = await prisma.champEnrichissable.findUnique({
      where: { organisationId_codeMachine: { organisationId, codeMachine } },
    })

    if (existing) {
      result.push({
        id: existing.id,
        header: candidate.header,
        codeMachine,
        typeDonnees: existing.typeDonnees,
      })
    } else {
      const created = await prisma.champEnrichissable.create({
        data: {
          organisationId,
          codeMachine,
          nomAffichage: candidate.header,
          typeDonnees: inferType(candidate.sample),
          nature: "SAISISSABLE",
          unite: "N/A",
          applicableATypes: [],
        },
      })
      result.push({
        id: created.id,
        header: candidate.header,
        codeMachine,
        typeDonnees: created.typeDonnees,
      })
    }
  }

  return result
}

export async function findChampByCodeMachine(
  organisationId: string,
  codeMachine: string
): Promise<Pick<import("@prisma/client").ChampEnrichissable, "id" | "typeDonnees"> | null> {
  return prisma.champEnrichissable.findUnique({
    where: { organisationId_codeMachine: { organisationId, codeMachine } },
    select: { id: true, typeDonnees: true },
  })
}

export async function ensureChampByCodeMachine(
  organisationId: string,
  codeMachine: string,
  nomAffichage: string,
  typeDonnees: string,
  unite: string
): Promise<Pick<import("@prisma/client").ChampEnrichissable, "id" | "typeDonnees">> {
  const existing = await prisma.champEnrichissable.findUnique({
    where: { organisationId_codeMachine: { organisationId, codeMachine } },
    select: { id: true, typeDonnees: true },
  })
  if (existing) return existing
  const created = await prisma.champEnrichissable.create({
    data: {
      organisationId,
      codeMachine,
      nomAffichage,
      typeDonnees,
      nature: "SAISISSABLE",
      unite,
      applicableATypes: [],
    },
  })
  return { id: created.id, typeDonnees: created.typeDonnees }
}

export interface EnrichmentField {
  id: string
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
  unite: string
}

export async function findEnrichmentFieldsByOrganisation(
  organisationId: string
): Promise<EnrichmentField[]> {
  return prisma.champEnrichissable.findMany({
    where: { organisationId, actif: true },
    select: {
      id: true,
      codeMachine: true,
      nomAffichage: true,
      typeDonnees: true,
      unite: true,
    },
    orderBy: { ordreAffichage: "asc" },
  })
}
