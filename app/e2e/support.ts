import { Prisma, PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"
import { ENRICH_TEST_CODES } from "./test-champs"

const TYPE_VUE_FICHE_TRANSACTION = "FICHE_TRANSACTION"

/**
 * Disposition utilisée par les specs d'enrichissement : la section de référence (champs importés) plus
 * deux sections qui placent les champs de test. Écrite en base plutôt que via l'éditeur pour que chaque
 * test parte d'un état déterministe ; la disposition est reposée après la spec.
 */
export async function setEnrichLayout(prisma: PrismaClient): Promise<void> {
  const champs = await prisma.champ.findMany({
    where: { organisationId: ORG_ID },
    orderBy: { ordreAffichage: "asc" },
    select: { id: true, codeMachine: true, nature: true },
  })
  const idByCode = new Map(champs.map((c) => [c.codeMachine, c.id]))
  const importedIds = champs.filter((c) => c.nature === "IMPORTE").map((c) => c.id)
  const pick = (...codes: string[]) =>
    codes.map((code) => idByCode.get(code)).filter((id): id is string => !!id)

  const sections = [
    { id: "e2e-layout-donnees", nom: "Données de l'acte test", ordre: 0, champs: importedIds },
    {
      id: "e2e-layout-superficies",
      nom: "Superficies test",
      ordre: 1,
      champs: pick(
        "superficie_cultivee",
        "superficie_boisee",
        "superficie_constructible",
        "superficie_drainee",
        "superficie_acericole",
        "e2e_taux_zone_humide",
        "e2e_champ_plage",
        "e2e_champ_negatif",
        "e2e_champ_decimal"
      ),
    },
    {
      id: "e2e-layout-controles",
      nom: "Contrôles test",
      ordre: 2,
      champs: pick(
        "e2e_champ_obligatoire",
        "e2e_champ_texte",
        "e2e_champ_liste",
        "e2e_champ_multi",
        "e2e_champ_booleen",
        "e2e_champ_date"
      ),
    },
  ]

  await prisma.vueFicheEvaluation.deleteMany({
    where: { organisationId: ORG_ID, typeVue: TYPE_VUE_FICHE_TRANSACTION },
  })
  await prisma.vueFicheEvaluation.create({
    data: {
      organisationId: ORG_ID,
      typeVue: TYPE_VUE_FICHE_TRANSACTION,
      contenu: { sections } as unknown as Prisma.InputJsonValue,
    },
  })
}

/** Efface les valeurs saisies sur les champs de test d'une transaction, sans toucher aux champs importés. */
export async function resetTestValues(prisma: PrismaClient, transactionId: string): Promise<void> {
  const champs = await prisma.champ.findMany({
    where: { organisationId: ORG_ID, codeMachine: { in: ENRICH_TEST_CODES } },
    select: { id: true },
  })
  await prisma.valeurChamp.deleteMany({
    where: { transactionId, champId: { in: champs.map((c) => c.id) } },
  })
}
