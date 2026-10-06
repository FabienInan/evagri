import { Prisma } from "@prisma/client"
import { prisma } from "../src/lib/prisma"
import { ENRICHMENT_CHAMP_CATALOG } from "../src/lib/enrichment-champ-catalog"
import { recommendFilterType } from "../src/lib/filters"

/**
 * One-off backfill: aligns already-imported enrichment champs with the canonical catalogue
 * (src/lib/enrichment-champ-catalog.ts). Fixes the fields the value-shape inference mis-typed as TEXTE —
 * closed vocabularies (topographie, feuillusrsineux, cptaq, zone_agricole_cptaq, ...) and numeric money/area
 * fields — so the transaction fiche renders the matching control. Idempotent: only rows that actually
 * change are written, and stored values are never touched (so no data is lost).
 */
async function main() {
  const codes = Object.keys(ENRICHMENT_CHAMP_CATALOG)
  const champs = await prisma.champEnrichissable.findMany({
    where: { codeMachine: { in: codes } },
    select: {
      id: true,
      codeMachine: true,
      nomAffichage: true,
      typeDonnees: true,
      optionsListe: true,
      typeFiltreRecommande: true,
    },
  })
  if (champs.length === 0) {
    console.log("No catalogued champ found — nothing to backfill.")
    return
  }

  let updated = 0
  for (const champ of champs) {
    const def = ENRICHMENT_CHAMP_CATALOG[champ.codeMachine]
    const recommended = recommendFilterType({
      codeMachine: champ.codeMachine,
      nomAffichage: champ.nomAffichage,
      typeDonnees: def.typeDonnees,
    })
    const sameOptions = JSON.stringify(champ.optionsListe ?? null) === JSON.stringify(def.optionsListe ?? null)
    if (champ.typeDonnees === def.typeDonnees && sameOptions && champ.typeFiltreRecommande === recommended) {
      continue
    }

    await prisma.champEnrichissable.update({
      where: { id: champ.id },
      data: {
        typeDonnees: def.typeDonnees,
        optionsListe: def.optionsListe ? def.optionsListe : Prisma.DbNull,
        typeFiltreRecommande: recommended,
      },
    })
    updated++
    console.log(`  ${champ.codeMachine}: ${champ.typeDonnees} -> ${def.typeDonnees}`)
  }

  console.log(`champ types backfill: ${updated} champ(s) updated out of ${champs.length} catalogued.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
