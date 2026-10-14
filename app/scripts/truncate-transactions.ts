import { prisma } from "@/lib/prisma"

async function main() {
  await prisma.$transaction([
    prisma.valeurChamp.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.documentActe.deleteMany({}),
    prisma.importation.deleteMany({}),
  ])

  const counts = await prisma.$transaction([
    prisma.valeurChamp.count(),
    prisma.transaction.count(),
    prisma.documentActe.count(),
    prisma.importation.count(),
  ])

  console.log("Remaining:", {
    valeurChamp: counts[0],
    transaction: counts[1],
    documentActe: counts[2],
    importation: counts[3],
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
