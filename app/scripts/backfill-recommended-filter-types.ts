import { prisma } from "@/lib/prisma"
import { recommendFilterType } from "@/lib/filters"

async function main() {
  const champs = await prisma.champEnrichissable.findMany({
    where: { typeFiltreRecommande: null },
  })
  for (const champ of champs) {
    await prisma.champEnrichissable.update({
      where: { id: champ.id },
      data: {
        typeFiltreRecommande: recommendFilterType({
          codeMachine: champ.codeMachine,
          nomAffichage: champ.nomAffichage,
          typeDonnees: champ.typeDonnees,
          nature: champ.nature,
        }),
      },
    })
  }
  console.log(`Updated ${champs.length} champs`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
