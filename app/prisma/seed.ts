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
