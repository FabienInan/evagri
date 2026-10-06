import { prisma } from "../src/lib/prisma"
import { splitNameUnit } from "../src/lib/normalization/parsing"

/**
 * One-off backfill: moves the unit out of `nom_affichage` into `unite` for already-imported numeric champs
 * (§6.5: `unite` is mandatory for DECIMAL/ENTIER, and the label must not carry it). The live importer does
 * this now (repositories/enrichment.repository.ts); this aligns the rows created before that fix.
 *
 * Idempotent: only rows that actually change are written, and stored enrichment values are never touched
 * (the codeMachine, and therefore every stored value, is unchanged).
 */
async function main() {
  const champs = await prisma.champEnrichissable.findMany({
    where: { typeDonnees: { in: ["DECIMAL", "ENTIER"] } },
    select: { id: true, codeMachine: true, nomAffichage: true, unite: true },
  })

  let updated = 0
  for (const champ of champs) {
    const { nom, unite } = splitNameUnit(champ.nomAffichage, champ.unite)
    if (nom === champ.nomAffichage && unite === champ.unite) continue

    await prisma.champEnrichissable.update({
      where: { id: champ.id },
      data: { nomAffichage: nom, unite },
    })
    updated++
    console.log(`  ${champ.codeMachine}: "${champ.nomAffichage}" (${champ.unite}) -> "${nom}" (${unite})`)
  }

  console.log(`champ units backfill: ${updated} champ(s) updated out of ${champs.length} numeric.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
