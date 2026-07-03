import { prisma } from "../src/lib/prisma"

async function main() {
  await prisma.$transaction([
    prisma.valeurEnrichissement.deleteMany({}),
    prisma.transactionEnrichie.deleteMany({}),
    prisma.documentActe.deleteMany({}),
    prisma.transactionSource.deleteMany({}),
    prisma.importation.deleteMany({}),
    prisma.filtreRecherche.deleteMany({}),
    prisma.champEnrichissable.deleteMany({}),
    prisma.vueFicheEvaluation.deleteMany({}),
    prisma.parametresAnalyseTransaction.deleteMany({}),
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
    prisma.valeurEnrichissement.count(),
    prisma.transactionEnrichie.count(),
    prisma.documentActe.count(),
    prisma.transactionSource.count(),
    prisma.importation.count(),
    prisma.filtreRecherche.count(),
    prisma.champEnrichissable.count(),
    prisma.organisation.count(),
  ])

  console.log("Remaining:", {
    valeurEnrichissement: counts[0],
    transactionEnrichie: counts[1],
    documentActe: counts[2],
    transactionSource: counts[3],
    importation: counts[4],
    filtreRecherche: counts[5],
    champEnrichissable: counts[6],
    organisation: counts[7],
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
