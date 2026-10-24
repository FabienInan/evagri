import { readFile } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import { ORG_ID } from "./db"
import { fixtures } from "./fixtures"

/**
 * Analyse de Dossier (§7.8.2) : création, validation, modification, recalcul après retrait d'une transaction,
 * export qui reprend les valeurs stockées, suppression. Dossier et panier dédiés pour ne pas perturber les
 * autres specs. Les scénarios dépendent l'un de l'autre : le describe est sériel.
 */

const fx = fixtures()
const DOSSIER_NUMERO = "25-ZZ-010"

let prisma: PrismaClient
let dossierId = ""
let panierId = ""

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  prisma = new PrismaClient()
  const dossier = await prisma.dossier.create({
    data: { organisationId: ORG_ID, numeroDossier: DOSSIER_NUMERO, nom: "Analyse e2e" },
  })
  dossierId = dossier.id
  const panier = await prisma.panier.create({
    data: { organisationId: ORG_ID, dossierId, nom: "Panier analyse e2e" },
  })
  panierId = panier.id
  await prisma.panierTransaction.createMany({
    data: [
      { panierId, transactionId: fx.transactions.t1 },
      { panierId, transactionId: fx.transactions.t2 },
    ],
  })
})

test.afterAll(async () => {
  await prisma.indicateursAjustes.deleteMany({ where: { analyseDossier: { dossierId } } })
  await prisma.analyseDossier.deleteMany({ where: { dossierId } })
  await prisma.panierTransaction.deleteMany({ where: { panierId } })
  await prisma.panier.deleteMany({ where: { dossierId } })
  await prisma.dossier.deleteMany({ where: { id: dossierId } })
  await prisma.$disconnect()
})

async function openDossier(page: Page): Promise<void> {
  await page.goto(`/dossiers/${dossierId}`)
  await expect(page.getByRole("heading", { name: "Analyses de dossier" })).toBeVisible()
}

async function openNewAnalyse(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Nouvelle analyse" }).click()
  await expect(page.getByRole("heading", { name: "Nouvelle analyse de dossier" })).toBeVisible()
}

test("refuse une analyse sans date d'évaluation", async ({ page }) => {
  await openDossier(page)
  await openNewAnalyse(page)

  await page.getByLabel("Date d'évaluation").fill("")
  await page.getByLabel("Taux de croissance (%)").fill("5")
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(page.getByText("La date d'évaluation est obligatoire.")).toBeVisible()
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(page.getByText("Aucune analyse.")).toBeVisible()
})

test("refuse les taux hors bornes (au plus -100 % exclu, au plus 100 % inclus)", async ({ page }) => {
  await openDossier(page)
  await openNewAnalyse(page)
  await page.getByLabel("Date d'évaluation").fill("2025-05-01")
  const taux = page.getByLabel("Taux de croissance (%)")
  const enregistrer = page.getByRole("button", { name: "Enregistrer", exact: true })

  await taux.fill("-100")
  await enregistrer.click()
  await expect(page.getByText("Le taux de croissance doit être supérieur à -100 %.")).toBeVisible()

  await taux.fill("100.5")
  await enregistrer.click()
  await expect(page.getByText("Le taux de croissance doit être inférieur ou égal à 100 %.")).toBeVisible()

  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(page.getByText("Aucune analyse.")).toBeVisible()
})

test("refuse une valeur de référence négative", async ({ page }) => {
  await openDossier(page)
  await openNewAnalyse(page)
  await page.getByLabel("Date d'évaluation").fill("2025-05-01")
  await page.getByLabel("Taux de croissance (%)").fill("10")
  await page.getByLabel("Taux boisé de référence ($/ha)").fill("-5")
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(page.getByText("Une valeur de référence ne peut pas être négative.")).toBeVisible()
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(page.getByText("Aucune analyse.")).toBeVisible()
})

test("crée une analyse et calcule le nombre de transactions du dossier", async ({ page }) => {
  await openDossier(page)
  await openNewAnalyse(page)
  await page.getByLabel("Date d'évaluation").fill("2025-05-01")
  await page.getByLabel("Taux de croissance (%)").fill("10")
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  // Deux transactions dans le panier du dossier : une ligne d'indicateurs par transaction.
  await expect(page.getByText("Évaluation du 01/05/2025")).toBeVisible()
  await expect(page.getByText("Croissance 10 % · 2 transactions")).toBeVisible()
})

test("modifie le taux et répercute la nouvelle valeur", async ({ page }) => {
  await openDossier(page)
  await page.getByTitle("Modifier l'analyse").click()
  await expect(page.getByRole("heading", { name: "Modifier l'analyse" })).toBeVisible()

  await page.getByLabel("Taux de croissance (%)").fill("20")
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(page.getByText("Croissance 20 % · 2 transactions")).toBeVisible()
})

test("exporte le panier avec le prix actualisé de l'analyse choisie", async ({ page }) => {
  // Prix 250 000 $ vendu le 2024-05-01, évalué le 2025-05-01 (365 jours) à 20 % : 250 000 × 1,20.
  await page.goto(`/paniers/${panierId}`)
  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await page.getByLabel("Analyse de dossier").selectOption({ index: 1 })

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ])
  const workbook = XLSX.read(await readFile(await download.path()), { type: "buffer" })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])

  const row = rows.find((r) => r["N° d'inscription"] === fx.numeros.t1)
  expect(row).toBeDefined()
  expect(Number(row?.["Prix actualisé"])).toBeCloseTo(300000, 2)
})

test("retirer une transaction du panier retire son résultat de l'analyse", async ({ page }) => {
  await page.goto(`/paniers/${panierId}`)
  await page.getByRole("row").filter({ hasText: fx.numeros.t1 }).getByRole("button", { name: "Retirer du panier" }).click()
  await expect(page.getByText("(1 élément)")).toBeVisible()

  await openDossier(page)
  await expect(page.getByText("Croissance 20 % · 1 transaction", { exact: true })).toBeVisible()
})

test("ajouter une transaction analysée au panier recalcule l'analyse sans nouvelle sauvegarde", async ({ page }) => {
  // t9 : 130 000 $ vendu le 2024-06-01, évalué le 2025-05-01 (334 jours) à 20 % : 130 000 × 1,2^(334/365).
  await page.goto(`/transactions/${fx.transactions.t9}`)
  await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click()
  await page.getByRole("combobox", { name: "Dossier" }).selectOption({ label: `${DOSSIER_NUMERO} — Analyse e2e` })
  await expect(page.getByRole("option", { name: "Panier analyse e2e" })).toBeAttached()
  await page.getByRole("combobox", { name: "Panier" }).selectOption({ label: "Panier analyse e2e" })
  // Attend la fin de l'action serveur avant de naviguer, sinon la requête peut être interrompue.
  const added = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"])
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await added

  await openDossier(page)
  await expect(page.getByText("Croissance 20 % · 2 transactions")).toBeVisible()

  // L'export reprend le résultat recalculé pour la transaction ajoutée.
  await page.goto(`/paniers/${panierId}`)
  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await page.getByLabel("Analyse de dossier").selectOption({ index: 1 })
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ])
  const workbook = XLSX.read(await readFile(await download.path()), { type: "buffer" })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
  const row = rows.find((r) => r["N° d'inscription"] === fx.numeros.t9)
  expect(Number(row?.["Prix actualisé"])).toBeCloseTo(153602.97, 2)
})

test("annuler la suppression garde l'analyse, confirmer la supprime", async ({ page }) => {
  await openDossier(page)

  page.once("dialog", (dialog) => dialog.dismiss())
  await page.getByTitle("Supprimer l'analyse").click()
  await expect(page.getByText("Évaluation du 01/05/2025")).toBeVisible()

  page.once("dialog", (dialog) => dialog.accept())
  await page.getByTitle("Supprimer l'analyse").click()
  await expect(page.getByText("Aucune analyse.")).toBeVisible()
  await expect(page.getByText("Évaluation du 01/05/2025")).toHaveCount(0)
})

test("sans analyse, l'export est limité aux colonnes non ajustées", async ({ page }) => {
  await openDossier(page)
  await expect(page.getByText("Aucune analyse.")).toBeVisible()

  await page.goto(`/paniers/${panierId}`)
  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await expect(page.getByLabel("Analyse de dossier")).toBeDisabled()
  await expect(page.getByText("Aucune analyse pour ce dossier.", { exact: false })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ])
  const workbook = XLSX.read(await readFile(await download.path()), { type: "buffer" })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
  expect(rows.length).toBeGreaterThan(0)
  expect(rows[0]).not.toHaveProperty("Prix actualisé")
})
