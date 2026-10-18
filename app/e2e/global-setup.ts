import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { Prisma, PrismaClient } from "@prisma/client"
import { loadEnv } from "./env"
import { cleanup, E2E_SOURCE, ORG_ID } from "./db"
import { ENRICH_TEST_CHAMPS, FILTER_TEST_CHAMPS, type TestChamp } from "./test-champs"

loadEnv()

type SeedValue = string | number | boolean | string[] | Date

function columnFor(typeDonnees: string, value: SeedValue) {
  switch (typeDonnees) {
    case "DECIMAL":
    case "ENTIER":
      return { valeurNombre: new Prisma.Decimal(String(value)) }
    case "DATE":
      return { valeurDate: new Date(value as string) }
    case "BOOLEAN":
      return { valeurBooleen: Boolean(value) }
    case "MULTI_SELECT":
      // Le modèle stocke une multi-sélection dans valeur_texte (liste délimitée), pas dans le tableau
      // valeur_texte_multiple réservé au type TEXTE_MULTIPLE.
      return { valeurTexte: Array.isArray(value) ? value.join(", ") : String(value) }
    case "TEXTE_MULTIPLE":
      return { valeurTexteMultiple: Array.isArray(value) ? value : [String(value)] }
    default:
      return { valeurTexte: String(value) }
  }
}

export default async function globalSetup(): Promise<void> {
  const prisma = new PrismaClient()
  try {
    await cleanup(prisma)

    // Champs dédiés aux specs de fiche et de filtres. Upsert (et non create) pour rester idempotent si un
    // run précédent s'est interrompu avant le teardown ; cleanup() les a déjà retirés juste au-dessus.
    for (const c of [...ENRICH_TEST_CHAMPS, ...FILTER_TEST_CHAMPS] as TestChamp[]) {
      const data = {
        nomAffichage: c.nomAffichage,
        typeDonnees: c.typeDonnees,
        nature: c.nature,
        unite: c.unite,
        plageMin: c.plageMin ?? null,
        plageMax: c.plageMax ?? null,
        optionsListe: c.optionsListe ?? Prisma.DbNull,
        regleCalcul: c.regleCalcul ?? null,
        applicableATypes: [] as string[],
        ordreAffichage: c.ordreAffichage,
        estAffiche: true,
        estObligatoire: c.estObligatoire ?? false,
        estLectureSeule: c.estLectureSeule ?? c.nature === "CALCULE",
      }
      await prisma.champ.upsert({
        where: { organisationId_codeMachine: { organisationId: ORG_ID, codeMachine: c.codeMachine } },
        update: data,
        create: { organisationId: ORG_ID, codeMachine: c.codeMachine, ...data },
      })
    }

    const champs = await prisma.champ.findMany({
      where: { organisationId: ORG_ID },
      select: { id: true, codeMachine: true, typeDonnees: true },
    })
    const byCode = new Map(champs.map((c) => [c.codeMachine, c]))

    async function createTransaction(
      numeroInscription: string,
      statut: "ANALYSEE" | "NON_ANALYSEE",
      values: Record<string, SeedValue>
    ): Promise<string> {
      const tx = await prisma.transaction.create({
        data: {
          organisationId: ORG_ID,
          systemeSource: E2E_SOURCE,
          statut,
          dateStatut: statut === "ANALYSEE" ? new Date() : null,
        },
      })
      const rows: Prisma.ValeurChampCreateManyInput[] = []
      for (const [code, value] of Object.entries({ numero_inscription: numeroInscription, ...values })) {
        const champ = byCode.get(code)
        if (!champ) continue
        rows.push({ transactionId: tx.id, champId: champ.id, ...columnFor(champ.typeDonnees, value) })
      }
      await prisma.valeurChamp.createMany({ data: rows })
      return tx.id
    }

    // Three analysed transactions clustered around Drummondville (so a drawn polygon can select several),
    // plus non-analysed ones (so the list's status filter and the fiche's two modes differ).
    const t1 = await createTransaction("E2E-001", "ANALYSEE", {
      date_vente: "2024-05-01",
      prix_vente: 250000,
      mrc: "Drummond",
      municipalite: "Drummondville",
      superficie_totale_hectare: 50,
      latitude: 45.8833,
      longitude: -72.4833,
      vendeur: "Alice Tremblay",
      acheteur: "Bob Gagnon",
      lots_cadastraux: ["1234567", "2345678"],
    })
    const t2 = await createTransaction("E2E-002", "ANALYSEE", {
      date_vente: "2024-06-15",
      prix_vente: 100000,
      mrc: "Arthabaska",
      municipalite: "Victoriaville",
      superficie_totale_hectare: 20,
      latitude: 45.89,
      longitude: -72.47,
    })
    const t3 = await createTransaction("E2E-003", "ANALYSEE", {
      date_vente: "2024-07-20",
      prix_vente: 500000,
      mrc: "Nicolet-Yamaska",
      municipalite: "Nicolet",
      superficie_totale_hectare: 80,
      latitude: 45.875,
      longitude: -72.49,
    })
    const t4 = await createTransaction("E2E-004", "NON_ANALYSEE", {
      date_vente: "2024-08-10",
      prix_vente: 75000,
      mrc: "Drummond",
      municipalite: "Drummondville",
      superficie_totale_hectare: 10,
      latitude: 46.22,
      longitude: -72.61,
    })
    // Two extra non-analysed transactions that exist only to exercise the fiche's blocking rules.
    // No coordinates, so the map endpoint skips them and the map spec is unaffected. Their prices sit
    // between the cheapest (t4) and the dearest (t3) so the list's price sort order stays predictable.
    // t5 has no transaction type → validating it raises V-TYPE.
    const t5 = await createTransaction("E2E-005", "NON_ANALYSEE", {
      date_vente: "2024-09-01",
      prix_vente: 150000,
      mrc: "Drummond",
      municipalite: "Drummondville",
      superficie_totale_hectare: 15,
    })
    // t6 carries a type (so V-TYPE stays silent) but a far-future sale date → validating raises V-004.
    const t6 = await createTransaction("E2E-006", "NON_ANALYSEE", {
      date_vente: "2099-01-01",
      prix_vente: 200000,
      mrc: "Drummond",
      municipalite: "Drummondville",
      superficie_totale_hectare: 25,
      typeTransaction: "TERRES_CULTIVEES",
    })
    // t7 porte un type valide et une superficie totale : les specs d'enrichissement y saisissent les
    // champs placés dans la disposition pour déclencher V-OBLIG/V-001/V-002/V-003/V-005/V-006/V-007.
    const t7 = await createTransaction("E2E-007", "NON_ANALYSEE", {
      date_vente: "2024-03-01",
      prix_vente: 100000,
      superficie_totale_hectare: 10,
      mrc: "Drummond",
      municipalite: "Drummondville",
      typeTransaction: "TERRES_CULTIVEES",
    })
    // t9 est analysée (consultation) et porte des valeurs de chaque type de données, pour vérifier le
    // rendu formaté des champs enrichis. Son prix se glisse entre les autres pour que le tri par prix de
    // la liste des transactions garde t4 en tête et t3 en queue.
    const t9 = await createTransaction("E2E-009", "ANALYSEE", {
      date_vente: "2024-06-01",
      prix_vente: 130000,
      superficie_totale_hectare: 10,
      mrc: "Drummond",
      municipalite: "Drummondville",
      typeTransaction: "TERRES_CULTIVEES",
      e2e_champ_texte: "Bonjour E2E",
      e2e_champ_decimal: 1234.5,
      e2e_champ_booleen: true,
      e2e_champ_date: "2024-05-06",
      e2e_champ_liste: "Alpha",
      e2e_champ_multi: "X, Y",
    })

    const dossier = await prisma.dossier.create({
      data: {
        organisationId: ORG_ID,
        numeroDossier: "25-ZZ-001",
        nom: "Dossier e2e",
      },
    })
    const panierSource = await prisma.panier.create({
      data: { organisationId: ORG_ID, dossierId: dossier.id, nom: "Comparables e2e" },
    })
    await prisma.panierTransaction.createMany({
      data: [
        { panierId: panierSource.id, transactionId: t1 },
        { panierId: panierSource.id, transactionId: t2 },
      ],
    })
    // Empty target panier so the "add to panier" scenario never disturbs the removal scenario.
    const panierCible = await prisma.panier.create({
      data: { organisationId: ORG_ID, dossierId: dossier.id, nom: "Cible e2e" },
    })
    // Panier créé vide et laissé tel quel : aucun scénario ne le peuple, donc l'état « panier vide »
    // (export carte désactivé) reste vérifiable même quand les autres tests ont rempli le panier cible.
    const panierVide = await prisma.panier.create({
      data: { organisationId: ORG_ID, dossierId: dossier.id, nom: "Vide e2e" },
    })

    const fixtures = {
      orgId: ORG_ID,
      dossierId: dossier.id,
      dossierNumero: "25-ZZ-001",
      paniers: { source: panierSource.id, cible: panierCible.id, vide: panierVide.id },
      transactions: { t1, t2, t3, t4, t5, t6, t7, t9 },
      numeros: {
        t1: "E2E-001",
        t2: "E2E-002",
        t3: "E2E-003",
        t4: "E2E-004",
        t5: "E2E-005",
        t6: "E2E-006",
        t7: "E2E-007",
        t9: "E2E-009",
      },
    }
    writeFileSync(resolve(process.cwd(), "e2e/.fixtures.json"), JSON.stringify(fixtures, null, 2))
    console.log(`[e2e] seeded 8 transactions, 1 dossier, 3 paniers (org ${ORG_ID})`)
  } finally {
    await prisma.$disconnect()
  }
}
