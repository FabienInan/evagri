import { prisma } from "../src/lib/prisma"
import { normalizeEnrichmentText } from "../src/lib/normalization/transforms"

/**
 * One-off backfill: canonicalizes already-imported `cptaq` enrichment values (oui / Non / Partiel / ...) to
 * Oui / Non / Partiel. Idempotent: only rows whose text actually changes are written.
 */
async function main() {
  const champs = await prisma.champEnrichissable.findMany({
    where: { codeMachine: "cptaq" },
    select: { id: true, codeMachine: true },
  })
  if (champs.length === 0) {
    console.log("No champ with codeMachine 'cptaq' — nothing to backfill.")
    return
  }

  let updated = 0
  let scanned = 0
  for (const champ of champs) {
    const valeurs = await prisma.valeurEnrichissement.findMany({
      where: { champEnrichissableId: champ.id, valeurTexte: { not: null } },
      select: { id: true, valeurTexte: true },
    })
    for (const v of valeurs) {
      scanned++
      const next = normalizeEnrichmentText(champ.codeMachine, v.valeurTexte)
      if (next !== v.valeurTexte) {
        await prisma.valeurEnrichissement.update({ where: { id: v.id }, data: { valeurTexte: next } })
        updated++
      }
    }
  }

  console.log(`cptaq backfill: ${updated} value(s) updated out of ${scanned} scanned.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
