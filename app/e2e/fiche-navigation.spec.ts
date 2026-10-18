import { expect, test, type Page } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()
const dossierOption = `${fx.dossierNumero} — Dossier e2e`

/** Applique le filtre « Analysée » : la liste ne garde que t3, t2, t9, t1 (date de vente décroissante). */
async function filterAnalysees(page: Page): Promise<void> {
  await page.goto("/transactions")
  const statutSelect = page
    .locator("select")
    .filter({ has: page.locator("option", { hasText: "Non analysée" }) })
  await statutSelect.selectOption({ label: "Analysée" })
  await page.getByRole("button", { name: "Rechercher" }).click()
  await expect(page.getByRole("row").filter({ hasText: fx.numeros.t4 })).toHaveCount(0)
}

test("n'affiche pas les flèches quand la fiche est ouverte hors liste filtrée", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t1}`)
  await expect(page.getByRole("button", { name: "Transaction précédente" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Transaction suivante" })).toHaveCount(0)
})

test("navigue dans la liste complète depuis la liste globale des transactions", async ({ page }) => {
  await page.goto("/transactions")

  // Liste non filtrée, date de vente décroissante : t6, t5, t4, t3, t2, t9, t1, t7.
  await page
    .getByRole("row")
    .filter({ hasText: fx.numeros.t3 })
    .getByRole("button", { name: "Voir" })
    .click()

  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t3}\\?liste=1`))
  const previous = page.getByRole("button", { name: "Transaction précédente" })
  await expect(previous).toBeEnabled()
  // Boutons de navigation aux couleurs de la charte (Gazon).
  await expect(previous).toHaveClass(/bg-primary/)

  await page.getByRole("button", { name: "Transaction suivante" }).click()
  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t2}\\?liste=1`))
  await expect(page.getByText(fx.numeros.t2).first()).toBeVisible()
})

test("navigue vers la transaction suivante de la liste filtrée", async ({ page }) => {
  await filterAnalysees(page)

  await page
    .getByRole("row")
    .filter({ hasText: fx.numeros.t2 })
    .getByRole("button", { name: "Voir" })
    .click()

  // Le contexte filtré est transmis à la fiche.
  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t2}\\?filters=`))
  await expect(page.getByRole("button", { name: "Transaction précédente" })).toBeEnabled()

  await page.getByRole("button", { name: "Transaction suivante" }).click()

  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t9}\\?filters=`))
  await expect(page.getByText(fx.numeros.t9).first()).toBeVisible()
})

test("navigue parmi les transactions du panier depuis la liste du panier", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  // Le panier source contient t2 puis t1 (date de vente décroissante).
  await page
    .getByRole("row")
    .filter({ hasText: fx.numeros.t2 })
    .getByRole("button", { name: "Voir la transaction" })
    .click()

  // Le contexte panier est transmis à la fiche.
  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t2}\\?panier=`))
  await expect(page.getByRole("button", { name: "Transaction précédente" })).toBeDisabled()

  await page.getByRole("button", { name: "Transaction suivante" }).click()

  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t1}\\?panier=`))
  await expect(page.getByText(fx.numeros.t1).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Transaction suivante" })).toBeDisabled()
})

test("passe à la suivante après un ajout au panier", async ({ page }) => {
  await filterAnalysees(page)

  await page
    .getByRole("row")
    .filter({ hasText: fx.numeros.t2 })
    .getByRole("button", { name: "Voir" })
    .click()
  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t2}\\?filters=`))

  await page.getByRole("button", { name: "Ajouter au panier" }).click()
  await page.getByLabel("Dossier").selectOption({ label: dossierOption })
  await page.getByLabel("Panier").selectOption({ label: "Cible e2e" })
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()

  // Succès : la fiche suivante de la liste filtrée s'ouvre directement.
  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t9}\\?filters=`))
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toHaveCount(0)
})
