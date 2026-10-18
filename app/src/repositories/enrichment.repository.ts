import { prisma } from "@/lib/prisma"
import { recommendFilterType } from "@/lib/filters"
import { enrichmentChampDef } from "@/lib/enrichment-champ-catalog"
import { buildCodeMachine, splitNameUnit } from "@/lib/normalization/parsing"
import { extractNonEmptyEnrichmentHeaders, inferType } from "@/parsers/excel.parser"
import type { Prisma } from "@prisma/client"
import type { EnrichmentChamp } from "@/types/import"

export type { EnrichmentChamp }

/** Two spreadsheet headers can collapse to the same codeMachine (accents, spacing, punctuation), so the
 *  batch is deduplicated before it reaches the unique (organisationId, codeMachine) constraint. */
function uniqueCodeMachine(base: string, seen: Set<string>): string {
  const root = base || "champ"
  let code = root
  let suffix = 2
  while (seen.has(code)) {
    code = `${root}_${suffix++}`
  }
  seen.add(code)
  return code
}

export async function ensureEnrichmentChamps(
  organisationId: string,
  sheetRows: Record<string, unknown>[]
): Promise<EnrichmentChamp[]> {
  const candidates = extractNonEmptyEnrichmentHeaders(sheetRows)
  if (candidates.length === 0) return []

  const seen = new Set<string>()
  const prepared = candidates.map((candidate) => ({
    header: candidate.header,
    codeMachine: uniqueCodeMachine(buildCodeMachine(candidate.header), seen),
    sample: candidate.sample,
  }))

  // One lookup for the whole batch instead of one per header, then create only the genuinely new ones.
  const existing = await prisma.champ.findMany({
    where: { organisationId, codeMachine: { in: prepared.map((p) => p.codeMachine) } },
    select: { id: true, codeMachine: true, typeDonnees: true },
  })
  const byCode = new Map(existing.map((c) => [c.codeMachine, c]))

  const missing = prepared.filter((p) => !byCode.has(p.codeMachine))
  if (missing.length > 0) {
    const data: Prisma.ChampCreateManyInput[] = missing.map((p) => {
      // A catalogued champ (closed vocabulary or known numeric field) gets its canonical type/options; the
      // rest fall back to value-shape inference, which can never yield LISTE/MULTI_SELECT.
      const def = enrichmentChampDef(p.codeMachine)
      const typeDonnees = def?.typeDonnees ?? inferType(p.sample)
      // A numeric spreadsheet header often carries its unit in the label ("Superficie cultivée (ha)");
      // store it in `unite` and keep the name free of it (§6.5). Non-numeric types keep unite = "N/A".
      const numeric = typeDonnees === "DECIMAL" || typeDonnees === "ENTIER"
      const named = numeric ? splitNameUnit(p.header, "N/A") : { nom: p.header, unite: "N/A" }
      return {
        organisationId,
        codeMachine: p.codeMachine,
        nomAffichage: named.nom,
        typeDonnees,
        typeFiltreRecommande: recommendFilterType({
          codeMachine: p.codeMachine,
          nomAffichage: named.nom,
          typeDonnees,
        }),
        nature: "SAISISSABLE",
        // §6.5 : un champ saisissable est modifiable par défaut. La colonne SQL vaut `true` pour couvrir
        // les champs IMPORTE, donc l'import doit l'écrire explicitement plutôt que subir ce défaut.
        estLectureSeule: false,
        // Les colonnes importées sont des champs à enrichir : elles sont exigées par défaut.
        estObligatoire: true,
        unite: named.unite,
        applicableATypes: [],
        ...(def?.optionsListe ? { optionsListe: def.optionsListe } : {}),
      }
    })
    await prisma.champ.createMany({ data })

    const created = await prisma.champ.findMany({
      where: { organisationId, codeMachine: { in: missing.map((p) => p.codeMachine) } },
      select: { id: true, codeMachine: true, typeDonnees: true },
    })
    for (const c of created) byCode.set(c.codeMachine, c)
  }

  return prepared.map((p) => {
    const champ = byCode.get(p.codeMachine)!
    return { id: champ.id, header: p.header, codeMachine: p.codeMachine, typeDonnees: champ.typeDonnees }
  })
}

export async function findChampByCodeMachine(
  organisationId: string,
  codeMachine: string
): Promise<Pick<import("@prisma/client").Champ, "id" | "typeDonnees"> | null> {
  return prisma.champ.findUnique({
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
): Promise<Pick<import("@prisma/client").Champ, "id" | "typeDonnees">> {
  const existing = await prisma.champ.findUnique({
    where: { organisationId_codeMachine: { organisationId, codeMachine } },
    select: { id: true, typeDonnees: true },
  })
  if (existing) return existing
  const created = await prisma.champ.create({
    data: {
      organisationId,
      codeMachine,
      nomAffichage,
      typeDonnees,
      typeFiltreRecommande: recommendFilterType({
        codeMachine,
        nomAffichage,
        typeDonnees,
      }),
      nature: "SAISISSABLE",
      // Même règle que ci-dessus : le défaut SQL (true) ne vaut que pour les champs IMPORTE.
      estLectureSeule: false,
      estObligatoire: true,
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
  return prisma.champ.findMany({
    // Only SAISISSABLE/CALCULE champs are enrichment fields: IMPORTE champs come from import columns,
    // not from unrecognised spreadsheet headers to be mapped.
    where: { organisationId, actif: true, nature: { in: ["SAISISSABLE", "CALCULE"] } },
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
