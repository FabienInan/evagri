import { expect, test, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"
import { fixtures } from "./fixtures"

/**
 * Tri du panier persisté par panier (localStorage, clé `evagri:panier-table:<id>:sort`).
 * t2 (100 000 $, vendu le 2024-06-15) et t1 (250 000 $, vendu le 2024-05-01) : le tri par date décroissant
 * met t2 en tête, le tri par prix décroissant met t1 en tête. Dossier et paniers dédiés.
 */

const fx = fixtures()
const DOSSIER_NUMERO = "25-ZZ-011"

let prisma: PrismaClient
let dossierId = ""
let panierA = ""
let panierB = ""

test.beforeAll(async () => {
  prisma = new PrismaClient()
  const dossier = await prisma.dossier.create({
    data: { organisationId: ORG_ID, numeroDossier: DOSSIER_NUMERO, nom: "Tri e2e" },
  })
  dossierId = dossier.id
  panierA = (await prisma.panier.create({ data: { organisationId: ORG_ID, dossierId, nom: "Tri A e2e" } })).id
  panierB = (await prisma.panier.create({ data: { organisationId: ORG_ID, dossierId, nom: "Tri B e2e" } })).id
  await prisma.panierTransaction.createMany({
    data: [panierA, panierB].flatMap((panierId) => [
      { panierId, transactionId: fx.transactions.t1 },
      { panierId, transactionId: fx.transactions.t2 },
    ]),
  })
})

test.afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panierId: { in: [panierA, panierB] } } })
  await prisma.panier.deleteMany({ where: { dossierId } })
  await prisma.dossier.deleteMany({ where: { id: dossierId } })
  await prisma.$disconnect()
})

function sortKey(panierId: string): string {
  return `evagri:panier-table:${panierId}:sort`
}

async function openPanier(page: Page, panierId: string): Promise<void> {
  await page.goto(`/paniers/${panierId}`)
  await expect(page.getByRole("columnheader", { name: "Prix à l'acte" })).toBeVisible()
}

async function clickHeader(page: Page, label: string): Promise<void> {
  await page.getByRole("columnheader", { name: label }).click()
}

function firstRow(page: Page) {
  return page.locator("tbody tr").first()
}

test("trie par prix, inverse à la seconde visite, et garde le tri après rechargement", async ({ page }) => {
  await openPanier(page, panierA)
  // Tri par défaut : date de vente décroissante, donc t2 en premier.
  await expect(firstRow(page)).toContainText(fx.numeros.t2)

  await clickHeader(page, "Prix à l'acte")
  await expect(firstRow(page)).toContainText(fx.numeros.t2)

  await clickHeader(page, "Prix à l'acte")
  await expect(firstRow(page)).toContainText(fx.numeros.t1)

  await page.reload()
  await expect(firstRow(page)).toContainText(fx.numeros.t1)
})

test("changer de colonne repart en croissant", async ({ page }) => {
  await openPanier(page, panierA)
  await clickHeader(page, "Prix à l'acte")
  await clickHeader(page, "Prix à l'acte")
  await expect(firstRow(page)).toContainText(fx.numeros.t1)

  await clickHeader(page, "Date de vente")
  // Date croissante : t1 (2024-05-01) avant t2 (2024-06-15).
  await expect(firstRow(page)).toContainText(fx.numeros.t1)
})

test("le tri est isolé par panier", async ({ page }) => {
  await openPanier(page, panierA)
  await clickHeader(page, "Prix à l'acte")
  await clickHeader(page, "Prix à l'acte")
  await expect(firstRow(page)).toContainText(fx.numeros.t1)

  // Le panier B n'a jamais été trié : il garde le tri par défaut.
  await openPanier(page, panierB)
  await expect(firstRow(page)).toContainText(fx.numeros.t2)

  await openPanier(page, panierA)
  await expect(firstRow(page)).toContainText(fx.numeros.t1)
})

test("ignore une préférence de tri corrompue et revient au tri par défaut", async ({ page }) => {
  await openPanier(page, panierA)
  await page.evaluate((key) => localStorage.setItem(key, "{pas du json"), sortKey(panierA))
  await page.reload()
  await expect(firstRow(page)).toContainText(fx.numeros.t2)

  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ field: "date_vente", order: "sideways" })), sortKey(panierA))
  await page.reload()
  await expect(firstRow(page)).toContainText(fx.numeros.t2)
})
