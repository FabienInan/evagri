import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.$transaction([
    prisma.valeurChamp.deleteMany({}),
    prisma.panierTransaction.deleteMany({}),
    prisma.documentActe.deleteMany({}),
    prisma.parametresAnalyseTransaction.deleteMany({}),
    prisma.indicateursAjustes.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.filtreRecherche.deleteMany({}),
    prisma.champ.deleteMany({}),
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
    prisma.valeurChamp.count(),
    prisma.documentActe.count(),
    prisma.transaction.count(),
    prisma.importation.count(),
    prisma.filtreRecherche.count(),
    prisma.champ.count(),
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
    valeurChamp: counts[0],
    documentActe: counts[1],
    transaction: counts[2],
    importation: counts[3],
    filtreRecherche: counts[4],
    champ: counts[5],
    vueFicheEvaluation: counts[6],
    parametresAnalyseTransaction: counts[7],
    indicateursAjustes: counts[8],
    analyseDossier: counts[9],
    panierTransaction: counts[10],
    panier: counts[11],
    dossier: counts[12],
    typologie: counts[13],
    municipalite: counts[14],
    journalAudit: counts[15],
    utilisateur: counts[16],
    organisation: counts[17],
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
