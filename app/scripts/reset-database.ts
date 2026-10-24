import { prisma } from "../src/lib/prisma"

async function main() {
  await prisma.$transaction([
    prisma.valeurChamp.deleteMany({}),
    prisma.documentActe.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.importation.deleteMany({}),
    prisma.filtreRecherche.deleteMany({}),
    prisma.champ.deleteMany({}),
    prisma.vueFicheEvaluation.deleteMany({}),
    prisma.indicateursAjustes.deleteMany({}),
    prisma.analyseDossier.deleteMany({}),
    prisma.panierTransaction.deleteMany({}),
    prisma.panier.deleteMany({}),
    prisma.dossier.deleteMany({}),
    prisma.typologie.deleteMany({}),
    prisma.municipalite.deleteMany({}),
    prisma.journalAudit.deleteMany({}),
    prisma.utilisateur.deleteMany({}),
    prisma.organisation.deleteMany({}),
  ])

  const counts = await prisma.$transaction([
    prisma.valeurChamp.count(),
    prisma.documentActe.count(),
    prisma.transaction.count(),
    prisma.importation.count(),
    prisma.filtreRecherche.count(),
    prisma.champ.count(),
    prisma.organisation.count(),
  ])

  console.log("Remaining:", {
    valeurChamp: counts[0],
    documentActe: counts[1],
    transaction: counts[2],
    importation: counts[3],
    filtreRecherche: counts[4],
    champ: counts[5],
    organisation: counts[6],
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
