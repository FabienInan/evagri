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

  const sourceChamps = [
    { codeMachine: "numeroInscription", nomAffichage: "N° d'inscription", typeDonnees: "TEXTE", unite: "N/A" },
    { codeMachine: "dateVente", nomAffichage: "Date de vente", typeDonnees: "DATE", unite: "N/A" },
    { codeMachine: "vendeur", nomAffichage: "Vendeur", typeDonnees: "TEXTE", unite: "N/A" },
    { codeMachine: "acheteur", nomAffichage: "Acheteur", typeDonnees: "TEXTE", unite: "N/A" },
    { codeMachine: "prixVente", nomAffichage: "Prix de vente", typeDonnees: "DECIMAL", unite: "$" },
    { codeMachine: "mrc", nomAffichage: "MRC", typeDonnees: "TEXTE", unite: "N/A" },
    { codeMachine: "municipalite", nomAffichage: "Municipalité", typeDonnees: "TEXTE", unite: "N/A" },
    { codeMachine: "adresse", nomAffichage: "Adresse", typeDonnees: "TEXTE", unite: "N/A" },
    { codeMachine: "superficieTotaleHectare", nomAffichage: "Superficie totale (ha)", typeDonnees: "DECIMAL", unite: "ha" },
  ]

  for (const c of sourceChamps) {
    await prisma.champEnrichissable.upsert({
      where: { organisationId_codeMachine: { organisationId: org.id, codeMachine: c.codeMachine } },
      update: {},
      create: { organisationId: org.id, ...c, nature: "SAISISSABLE", applicableATypes: [] },
    })
  }

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
