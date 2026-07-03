import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.$transaction([
    prisma.valeurEnrichissement.deleteMany({}),
    prisma.panierTransaction.deleteMany({}),
    prisma.transactionEnrichie.deleteMany({}),
    prisma.documentActe.deleteMany({}),
    prisma.parametresAnalyseTransaction.deleteMany({}),
    prisma.indicateursAjustes.deleteMany({}),
    prisma.transactionSource.deleteMany({}),
    prisma.filtreRecherche.deleteMany({}),
    prisma.champEnrichissable.deleteMany({}),
    prisma.importation.deleteMany({}),
    prisma.analyseDossier.deleteMany({}),
    prisma.panier.deleteMany({}),
    prisma.dossier.deleteMany({}),
    prisma.vueFicheEvaluation.deleteMany({}),
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
    prisma.vueFicheEvaluation.count(),
    prisma.parametresAnalyseTransaction.count(),
    prisma.indicateursAjustes.count(),
    prisma.analyseDossier.count(),
    prisma.panierTransaction.count(),
    prisma.panier.count(),
    prisma.dossier.count(),
    prisma.typologie.count(),
    prisma.municipalite.count(),
    prisma.journalAudit.count(),
    prisma.utilisateur.count(),
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
    vueFicheEvaluation: counts[7],
    parametresAnalyseTransaction: counts[8],
    indicateursAjustes: counts[9],
    analyseDossier: counts[10],
    panierTransaction: counts[11],
    panier: counts[12],
    dossier: counts[13],
    typologie: counts[14],
    municipalite: counts[15],
    journalAudit: counts[16],
    utilisateur: counts[17],
    organisation: counts[18],
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
