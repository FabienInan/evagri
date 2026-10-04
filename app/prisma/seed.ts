import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DEFAULT_ORGANISATION_ID = "90a5866e-06e5-46ce-9941-56582b8ca15c"

async function main() {
  let org = await prisma.organisation.findUnique({ where: { id: DEFAULT_ORGANISATION_ID } })
  if (!org) {
    org = await prisma.organisation.create({
      data: { id: DEFAULT_ORGANISATION_ID, nom: "EVAGRI" },
    })
    console.log("Created default organisation:", org.id)
  }

  const typologies = [
    { code: "TERRES_CULTIVEES", nom: "Terres cultivées", ordre: 1 },
    { code: "TERRES_BOISEES", nom: "Terres boisées", ordre: 2 },
    { code: "ERABLIERES", nom: "Érablières", ordre: 3 },
    { code: "BATIMENTS_AGRICOLES", nom: "Bâtiments agricoles", ordre: 4 },
    { code: "FERME", nom: "Ferme", ordre: 5 },
  ]

  for (const t of typologies) {
    await prisma.typologie.upsert({
      where: { organisationId_code: { organisationId: org.id, code: t.code } },
      update: {},
      create: { organisationId: org.id, ...t, estFeuille: true },
    })
  }

  const villes = [
    { nomMunicipalite: "Drummondville", mrc: "Drummond", regionAdministrative: "Centre-du-Québec" },
    { nomMunicipalite: "Victoriaville", mrc: "Arthabaska", regionAdministrative: "Centre-du-Québec" },
    { nomMunicipalite: "Nicolet", mrc: "Nicolet-Yamaska", regionAdministrative: "Centre-du-Québec" },
  ]

  for (const v of villes) {
    await prisma.municipalite.upsert({
      where: { organisationId_nomMunicipalite: { organisationId: org.id, nomMunicipalite: v.nomMunicipalite } },
      update: {},
      create: { organisationId: org.id, ...v },
    })
  }

  const geoChamps = [
    { codeMachine: "latitude", nomAffichage: "Latitude", typeDonnees: "DECIMAL", unite: "°" },
    { codeMachine: "longitude", nomAffichage: "Longitude", typeDonnees: "DECIMAL", unite: "°" },
  ]

  for (const c of geoChamps) {
    await prisma.champEnrichissable.upsert({
      where: { organisationId_codeMachine: { organisationId: org.id, codeMachine: c.codeMachine } },
      update: {},
      create: { organisationId: org.id, ...c, nature: "SAISISSABLE", applicableATypes: [] },
    })
  }

  const typeTransaction = await prisma.champEnrichissable.upsert({
    where: { organisationId_codeMachine: { organisationId: org.id, codeMachine: "typeTransaction" } },
    update: {
      optionsListe: [
        "Terres cultivées",
        "Terres boisées",
        "Érablières",
        "Bâtiments agricoles",
        "Ferme",
      ],
    },
    create: {
      organisationId: org.id,
      codeMachine: "typeTransaction",
      nomAffichage: "Type de transaction",
      typeDonnees: "LISTE",
      nature: "SAISISSABLE",
      unite: "N/A",
      applicableATypes: [],
      optionsListe: [
        "Terres cultivées",
        "Terres boisées",
        "Érablières",
        "Bâtiments agricoles",
        "Ferme",
      ],
    },
  })

  // Indicateurs calculés (§7.8.1). nature = CALCULE, est_modifiable = false (dérivé de la nature, §6.5).
  // Les identifiants de la règle sont résolus par le calculateur (lib/calculator.ts) : code_machine enrichi
  // d'abord, puis champ source. Ils sont traduits vers les codes réels produits par l'import
  // (buildCodeMachine : accents supprimés, suffixe d'unité conservé) et vers les codes sources
  // (transaction-source-fields.ts). Les paramètres d'évaluation propres au Dossier (§7.8.2 :
  // taux_boise_ref, taux_cultive_ref, valeur_batiments, valeur_maison, valeur_terrain_residentiel) et les
  // champs sans code réel (superficie_batiment, superficie_feuillu) restent littéraux : ils valent null
  // (affichage « — ») tant qu'aucun champ correspondant n'existe. Les indicateurs « (%) » multiplient par
  // 100, sinon l'arrondi entier (§7.5.4/§7.8.1) ramènerait toute fraction à 0.
  const tousTypes = ["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]

  const indicateurs = [
    { codeMachine: "taux_global", nomAffichage: "Taux global", unite: "$/ha", ordreAffichage: 10, applicableATypes: tousTypes,
      regleCalcul: "prix_vente / superficie_totale_hectare" },
    { codeMachine: "taux_residuel_cultive", nomAffichage: "Taux résiduel cultivé", unite: "$/ha", ordreAffichage: 11, applicableATypes: ["TERRES_CULTIVEES"],
      regleCalcul: "(prix_vente - superficie_boise_ha * taux_boise_ref - valeur_batiments - valeur_maison - valeur_terrain_residentiel) / superficie_cultive_ha" },
    { codeMachine: "taux_residuel_boisee", nomAffichage: "Taux résiduel boisée", unite: "$/ha", ordreAffichage: 12, applicableATypes: ["TERRES_BOISEES"],
      regleCalcul: "(prix_vente - superficie_cultive_ha * taux_cultive_ref - valeur_batiments - valeur_maison - valeur_terrain_residentiel) / superficie_boise_ha" },
    { codeMachine: "taux_residuel_batiment", nomAffichage: "Taux résiduel bâtiment", unite: "$/pi²", ordreAffichage: 13, applicableATypes: ["BATIMENTS_AGRICOLES"],
      regleCalcul: "(prix_vente - superficie_cultive_ha * taux_cultive_ref - superficie_boise_ha * taux_boise_ref - valeur_maison - valeur_terrain_residentiel) / superficie_batiment" },
    { codeMachine: "terres_drainees", nomAffichage: "Terres drainées", unite: "%", ordreAffichage: 14, applicableATypes: ["TERRES_CULTIVEES"],
      regleCalcul: "superficie_draine_ha * 100 / superficie_cultive_ha" },
    { codeMachine: "peuplement_feuillu", nomAffichage: "Peuplement feuillu", unite: "%", ordreAffichage: 15, applicableATypes: ["TERRES_BOISEES"],
      regleCalcul: "superficie_feuillu * 100 / superficie_boise_ha" },
    { codeMachine: "zones_humides_potentielles", nomAffichage: "Zones humides potentielles", unite: "%", ordreAffichage: 16, applicableATypes: ["TERRES_BOISEES"],
      regleCalcul: "zones_humides_ha * 100 / superficie_boise_ha" },
    { codeMachine: "densite_entaillage", nomAffichage: "Densité d'entaillage", unite: "entailles/ha", ordreAffichage: 17, applicableATypes: ["ERABLIERES"],
      regleCalcul: "nombre_dentailles / superficie_acricole_ha" },
    { codeMachine: "taux_par_entaille", nomAffichage: "Taux par entaille", unite: "$/entaille", ordreAffichage: 18, applicableATypes: ["ERABLIERES"],
      regleCalcul: "(prix_vente - superficie_cultive_ha * taux_cultive_ref - valeur_batiments - valeur_maison - valeur_terrain_residentiel) / nombre_dentailles" },
  ]

  for (const c of indicateurs) {
    await prisma.champEnrichissable.upsert({
      where: { organisationId_codeMachine: { organisationId: org.id, codeMachine: c.codeMachine } },
      update: { regleCalcul: c.regleCalcul, applicableATypes: c.applicableATypes },
      create: {
        organisationId: org.id,
        codeMachine: c.codeMachine,
        nomAffichage: c.nomAffichage,
        typeDonnees: "ENTIER",
        nature: "CALCULE",
        unite: c.unite,
        regleCalcul: c.regleCalcul,
        applicableATypes: c.applicableATypes,
        ordreAffichage: c.ordreAffichage,
        estModifiable: false,
      },
    })
  }

  // Champs saisis par l'évaluateur, référencés par les règles ci-dessus mais absents de la base.
  // Les 5 paramètres d'évaluation par Dossier du §7.8.2 (taux_boise_ref, taux_cultive_ref,
  // valeur_batiments, valeur_maison, valeur_terrain_residentiel) sont provisoirement seedés comme champs
  // saisissables par transaction, en attendant l'implémentation de l'Analyse de Dossier (§7.8.2).
  const champsIndicateurs = [
    { codeMachine: "taux_boise_ref", nomAffichage: "Taux boisé de référence", unite: "$/ha", ordreAffichage: 20 },
    { codeMachine: "taux_cultive_ref", nomAffichage: "Taux cultivé de référence", unite: "$/ha", ordreAffichage: 21 },
    { codeMachine: "valeur_batiments", nomAffichage: "Valeur bâtiments", unite: "$", ordreAffichage: 22 },
    { codeMachine: "valeur_maison", nomAffichage: "Valeur maison", unite: "$", ordreAffichage: 23 },
    { codeMachine: "valeur_terrain_residentiel", nomAffichage: "Valeur terrain résidentiel", unite: "$", ordreAffichage: 24 },
    { codeMachine: "superficie_batiment", nomAffichage: "Superficie bâtiment", unite: "pi²", ordreAffichage: 25 },
    { codeMachine: "superficie_feuillu", nomAffichage: "Superficie feuillu", unite: "ha", ordreAffichage: 26 },
  ]

  for (const c of champsIndicateurs) {
    await prisma.champEnrichissable.upsert({
      where: { organisationId_codeMachine: { organisationId: org.id, codeMachine: c.codeMachine } },
      update: {},
      create: {
        organisationId: org.id,
        ...c,
        typeDonnees: "DECIMAL",
        nature: "SAISISSABLE",
        applicableATypes: tousTypes,
      },
    })
  }

  await prisma.filtreRecherche.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {
      nomFiltre: "Type de transaction",
      typeFiltre: "LISTE",
      operateursDisponibles: ["="],
      ordreAffichage: 0,
      estActif: true,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organisationId: org.id,
      champEnrichissableId: typeTransaction.id,
      nomFiltre: "Type de transaction",
      typeFiltre: "LISTE",
      operateursDisponibles: ["="],
      ordreAffichage: 0,
      estActif: true,
      applicableATypes: [],
    },
  })

  await prisma.filtreRecherche.upsert({
    where: { organisationId_codeMachine: { organisationId: org.id, codeMachine: "statut" } },
    update: {
      nomFiltre: "Statut d'analyse",
      typeFiltre: "LISTE",
      operateursDisponibles: ["="],
      ordreAffichage: 1,
      estActif: true,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      organisationId: org.id,
      codeMachine: "statut",
      nomFiltre: "Statut d'analyse",
      typeFiltre: "LISTE",
      operateursDisponibles: ["="],
      ordreAffichage: 1,
      estActif: true,
      applicableATypes: [],
    },
  })

  console.log("Seed completed.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
