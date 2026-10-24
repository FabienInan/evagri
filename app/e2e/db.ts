import { rm } from "node:fs/promises"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { ALL_TEST_CODES } from "./test-champs"

export const ORG_ID =
  process.env.DEFAULT_ORGANISATION_ID ?? "90a5866e-06e5-46ce-9941-56582b8ca15c"
/** Marker on every seeded transaction so teardown can remove exactly what this suite created. */
export const E2E_SOURCE = "E2E"
/**
 * The dossier numero must match /\d{2}-[A-Z]{2}-\d{3}/ (validator). The suite marks its own dossiers with
 * the "ZZ" letter pair so teardown can find them regardless of whether the seed or a spec created them.
 */
export const E2E_DOSSIER_MARKER = "-ZZ-"

/** Removes every row the seed or the specs left behind, scoped to the E2E markers. */
export async function cleanup(prisma: PrismaClient): Promise<void> {
  const dossiers = await prisma.dossier.findMany({
    where: { organisationId: ORG_ID, numeroDossier: { contains: E2E_DOSSIER_MARKER } },
    select: { id: true },
  })
  const paniers = await prisma.panier.findMany({
    where: { dossierId: { in: dossiers.map((d) => d.id) } },
    select: { id: true },
  })
  const txs = await prisma.transaction.findMany({
    where: { organisationId: ORG_ID, systemeSource: E2E_SOURCE },
    select: { id: true },
  })
  const txIds = txs.map((t) => t.id)
  const panierIds = paniers.map((p) => p.id)

  await prisma.panierTransaction.deleteMany({
    where: { OR: [{ panierId: { in: panierIds } }, { transactionId: { in: txIds } }] },
  })
  await prisma.panier.deleteMany({ where: { id: { in: panierIds } } })
  const dossierIds = dossiers.map((d) => d.id)
  await prisma.indicateursAjustes.deleteMany({
    where: { OR: [{ transactionId: { in: txIds } }, { analyseDossier: { dossierId: { in: dossierIds } } }] },
  })
  await prisma.analyseDossier.deleteMany({ where: { dossierId: { in: dossierIds } } })
  await prisma.dossier.deleteMany({ where: { id: { in: dossierIds } } })
  await prisma.documentActe.deleteMany({ where: { transactionId: { in: txIds } } })
  await prisma.valeurChamp.deleteMany({ where: { transactionId: { in: txIds } } })
  await prisma.transaction.deleteMany({ where: { id: { in: txIds } } })

  // Uploaded acte PDFs live under uploads/actes/<org>/<transaction>/ ; remove each seeded transaction's
  // folder so a PDF-upload spec leaves nothing behind (the DB rows are already gone above).
  for (const id of txIds) {
    await rm(join(process.cwd(), "uploads", "actes", ORG_ID, id), { recursive: true, force: true })
  }

  // Champs créés par les specs (création via l'admin ou champs de fixture) et filtres associés. Les
  // valeurs sont supprimées d'abord : aucune relation du schéma n'est en cascade.
  // Les champs créés via l'admin portent tous un nom « E2E … » (préfixe choisi par les specs) mais ont un
  // codeMachine dérivé (`e2e_creation_…`) absent de ALL_TEST_CODES : on les retrouve par leur nom.
  const testChamps = await prisma.champ.findMany({
    where: {
      organisationId: ORG_ID,
      OR: [{ codeMachine: { in: ALL_TEST_CODES } }, { nomAffichage: { startsWith: "E2E " } }],
    },
    select: { id: true },
  })
  const testChampIds = testChamps.map((c) => c.id)

  await prisma.filtreRecherche.deleteMany({
    where: {
      OR: [
        { champId: { in: testChampIds } },
        { nomFiltre: { startsWith: "E2E " } },
        { codeMachine: { startsWith: "e2e_" } },
      ],
    },
  })
  await prisma.valeurChamp.deleteMany({ where: { champId: { in: testChampIds } } })
  await prisma.champ.deleteMany({ where: { id: { in: testChampIds } } })

  // Les specs de disposition remplacent la VueFicheEvaluation entière : on efface la disposition
  // enregistrée pour que la suite reparte de la disposition par défaut, même si un test a échoué avant
  // son afterAll.
  await restoreDefaultLayout(prisma)
}

/**
 * Efface la disposition enregistrée : `getEffectiveFicheLayout` propose alors la disposition par défaut
 * (champs importés + « Champs à enrichir »), comme sur une organisation qui n'a jamais enregistré la sienne.
 */
export async function restoreDefaultLayout(prisma: PrismaClient): Promise<void> {
  await prisma.vueFicheEvaluation.deleteMany({
    where: { organisationId: ORG_ID, typeVue: "FICHE_TRANSACTION" },
  })
}
