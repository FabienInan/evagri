import { expect, test, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"
import { fixtures } from "./fixtures"

/**
 * Ordre et visibilité des colonnes du panier : persistés dans le navigateur (localStorage) et restaurés
 * après rechargement. Dossier et panier dédiés, pour ne pas dépendre des autres specs.
 */

const fx = fixtures()
const DOSSIER_NUMERO = "99-99-012"

let prisma: PrismaClient
let dossierId = ""
let panierId = ""

test.beforeAll(async () => {
  prisma = new PrismaClient()
  const dossier = await prisma.dossier.create({
    data: { organisationId: ORG_ID, numeroDossier: DOSSIER_NUMERO, nom: "Colonnes e2e" },
  })
  dossierId = dossier.id
  panierId = (await prisma.panier.create({ data: { organisationId: ORG_ID, dossierId, nom: "Colonnes e2e" } })).id
  await prisma.panierTransaction.createMany({
    data: [{ panierId, transactionId: fx.transactions.t1 }, { panierId, transactionId: fx.transactions.t2 }],
  })
})

test.afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panierId } })
  await prisma.panier.deleteMany({ where: { dossierId } })
  await prisma.dossier.deleteMany({ where: { id: dossierId } })
  await prisma.$disconnect()
})

async function openPanier(page: Page): Promise<void> {
  await page.goto(`/paniers/${panierId}`)
  await expect(page.getByRole("columnheader", { name: "Prix à l'acte" })).toBeVisible()
}

/** Attend l'hydratation React : avant, le HTML serveur affiche la disposition par défaut et ignore le localStorage. */
async function waitForHydration(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const th = document.querySelector("thead th")
        return th ? Object.keys(th).some((k) => k.startsWith("__reactProps")) : false
      })
    )
    .toBe(true)
}

async function headerLabels(page: Page): Promise<string[]> {
  return (await page.locator("thead th").allInnerTexts()).map((t) => t.trim()).filter(Boolean)
}

test("l'ordre des colonnes est restauré après rechargement", async ({ page }) => {
  await openPanier(page)
  const before = await headerLabels(page)
  expect(before.length).toBeGreaterThan(2)

  // Glisse la deuxième colonne en première position.
  await waitForHydration(page)
  const headers = page.locator("thead th")
  await headers.nth(1).dragTo(headers.nth(0))
  const moved = await headerLabels(page)
  expect(moved[0]).toBe(before[1])

  await page.reload()
  await waitForHydration(page)
  await expect.poll(() => headerLabels(page)).toEqual(moved)
})

test("les colonnes masquées restent masquées après rechargement", async ({ page }) => {
  await openPanier(page)
  const before = await headerLabels(page)
  const hidden = before[1]

  await waitForHydration(page)
  await page.getByRole("button", { name: "Colonnes" }).click()
  await page.locator("label", { hasText: hidden }).locator("input").uncheck()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Colonnes" }).click()
  await expect(page.getByRole("columnheader", { name: hidden, exact: true })).toHaveCount(0)

  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole("columnheader", { name: hidden, exact: true })).toHaveCount(0)
})
