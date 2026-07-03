import { prisma } from "../src/lib/prisma"

async function main() {
  const tx = await prisma.transactionSource.findFirst({
    include: {
      enrichie: {
        include: {
          valeurs: { include: { champEnrichissable: true } },
        },
      },
    },
  })
  console.log("first tx:", JSON.stringify(tx, null, 2))

  const count = await prisma.valeurEnrichissement.count({
    where: { champEnrichissable: { codeMachine: "typeTransaction" } },
  })
  console.log("typeTransaction values:", count)

  const sample = await prisma.valeurEnrichissement.findMany({
    where: { champEnrichissable: { codeMachine: "typeTransaction" } },
    take: 5,
    include: { champEnrichissable: true },
  })
  console.log("sample:", JSON.stringify(sample, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
