import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  let org = await prisma.organisation.findFirst({ where: { nom: "EVAGRI" } })
  if (!org) {
    org = await prisma.organisation.create({ data: { nom: "EVAGRI" } })
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
