import { prisma } from "@/lib/prisma"

async function main() {
  await prisma.$transaction([
    prisma.valeurEnrichissement.deleteMany({}),
    prisma.transactionEnrichie.deleteMany({}),
    prisma.documentActe.deleteMany({}),
    prisma.transactionSource.deleteMany({}),
    prisma.importation.deleteMany({}),
  ])

  const counts = await prisma.$transaction([
    prisma.valeurEnrichissement.count(),
    prisma.transactionEnrichie.count(),
    prisma.documentActe.count(),
    prisma.transactionSource.count(),
    prisma.importation.count(),
  ])

  console.log("Remaining:", {
    valeurEnrichissement: counts[0],
    transactionEnrichie: counts[1],
    documentActe: counts[2],
    transactionSource: counts[3],
    importation: counts[4],
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
