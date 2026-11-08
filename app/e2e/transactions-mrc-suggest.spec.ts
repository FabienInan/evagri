import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"

/**
 * Le filtre MRC propose les MRC et territoires du Québec à la saisie des premières lettres. Le filtre est créé
 * pour le champ importé « mrc » s'il n'existe pas encore, et supprimé après le test s'il a été créé ici.
 */

let prisma: PrismaClient
let createdFiltreId: string | null = null

test.beforeAll(async () => {
  prisma = new PrismaClient()
  const existing = await prisma.filtreRecherche.findFirst({
    where: { organisationId: ORG_ID, champ: { codeMachine: "mrc" } },
  })
  if (existing) return
  const champ = await prisma.champ.findFirst({ where: { organisationId: ORG_ID, codeMachine: "mrc" } })
  if (!champ) throw new Error("champ importé « mrc » introuvable")
  const created = await prisma.filtreRecherche.create({
    data: {
      organisationId: ORG_ID,
      champId: champ.id,
      nomFiltre: "MRC",
      typeFiltre: "RECHERCHE_TEXTE",
      operateursDisponibles: ["=", "contient", "in"],
      ordreAffichage: 99,
      estActif: true,
    },
  })
  createdFiltreId = created.id
})

test.afterAll(async () => {
  if (createdFiltreId) await prisma.filtreRecherche.delete({ where: { id: createdFiltreId } })
  await prisma.$disconnect()
})

test("le filtre MRC propose les noms correspondant à la saisie", async ({ page }) => {
  await page.goto("/transactions")
  const filtre = page.getByText("MRC", { exact: true }).first().locator("..").locator('input[role="combobox"]')
  await filtre.click()
  await filtre.pressSequentially("dru")
  await expect(page.getByRole("listbox").getByRole("option").first()).toHaveText("Drummond")

  // Accents ignorés : « rouv » trouve Rouville.
  await filtre.fill("")
  await filtre.pressSequentially("rouv")
  await expect(page.getByRole("listbox").getByRole("option", { name: "Rouville" })).toBeVisible()

  await filtre.press("Enter")
  await expect(filtre).toHaveValue("Rouville")
})
