import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"

/**
 * Filtre « Date de vente » : saisie par calendrier (input date). L'opérateur « entre » en propose deux, début et
 * fin. Le filtre est créé pour le champ importé « date_vente » s'il n'existe pas, et supprimé après le test s'il a
 * été créé ici.
 */

let prisma: PrismaClient
let createdFiltreId: string | null = null

test.beforeAll(async () => {
  prisma = new PrismaClient()
  const existing = await prisma.filtreRecherche.findFirst({
    where: { organisationId: ORG_ID, champ: { codeMachine: "date_vente" } },
  })
  if (existing) return
  const champ = await prisma.champ.findFirst({ where: { organisationId: ORG_ID, codeMachine: "date_vente" } })
  if (!champ) throw new Error("champ importé « date_vente » introuvable")
  const created = await prisma.filtreRecherche.create({
    data: {
      organisationId: ORG_ID,
      champId: champ.id,
      nomFiltre: "Date de vente",
      typeFiltre: "PLAGE_DATE",
      operateursDisponibles: ["=", "+", "-", "entre"],
      ordreAffichage: 98,
      estActif: true,
    },
  })
  createdFiltreId = created.id
})

test.afterAll(async () => {
  if (createdFiltreId) await prisma.filtreRecherche.delete({ where: { id: createdFiltreId } })
  await prisma.$disconnect()
})

test("le filtre date propose un calendrier, et « entre » en propose deux", async ({ page }) => {
  await page.goto("/transactions")
  const bloc = page.getByText("Date de vente", { exact: true }).first().locator("..")
  const operateur = bloc.locator("select")

  await operateur.selectOption("=")
  await expect(bloc.locator('input[type="date"]')).toHaveCount(1)
  await bloc.locator('input[type="date"]').fill("2024-05-01")
  await expect(bloc.locator('input[type="date"]')).toHaveValue("2024-05-01")

  await operateur.selectOption("entre")
  const dates = bloc.locator('input[type="date"]')
  await expect(dates).toHaveCount(2)
  await dates.nth(0).fill("2024-05-01")
  await dates.nth(1).fill("2024-06-30")
  await expect(dates.nth(1)).toHaveValue("2024-06-30")
})
