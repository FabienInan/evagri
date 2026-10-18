import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

test.beforeEach(async ({ page }) => {
  await page.goto("/transactions")
})

test("affiche la liste et les transactions semées", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "Liste des transactions" })).toBeVisible()
  await expect(page.getByRole("heading", { level: 2, name: "Liste des transactions" })).toBeVisible()
  await expect(page.getByText(fx.numeros.t1)).toBeVisible()
  await expect(page.getByText(fx.numeros.t4)).toBeVisible()
  await expect(page.getByText("Résultats")).toBeVisible()
})

test("trie par prix à l'acte dans les deux sens", async ({ page }) => {
  const priceHeader = page.getByRole("columnheader", { name: "Prix à l'acte" })

  // 1er clic : ordre croissant → la vente la moins chère (E2E-004) en tête, la plus chère (E2E-003) en queue.
  await priceHeader.click()
  await expect(page.getByRole("row").nth(1)).toContainText(fx.numeros.t4)
  await expect(page.getByRole("row").last()).toContainText(fx.numeros.t3)

  // 2e clic : ordre décroissant → la plus chère passe en tête.
  await priceHeader.click()
  await expect(page.getByRole("row").nth(1)).toContainText(fx.numeros.t3)
})

test("filtre par statut d'analyse", async ({ page }) => {
  const statutSelect = page
    .locator("select")
    .filter({ has: page.locator("option", { hasText: "Non analysée" }) })
  await statutSelect.selectOption({ label: "Analysée" })
  await page.getByRole("button", { name: "Rechercher" }).click()

  await expect(page.getByText(fx.numeros.t1)).toBeVisible()
  await expect(page.getByText(fx.numeros.t4)).toHaveCount(0)
})

test("affiche un état vide quand aucun résultat", async ({ page }) => {
  // Aucune transaction semée n'est du type « Ferme » : le filtre ne doit rien retourner.
  const typeSelect = page
    .locator("select")
    .filter({ has: page.locator("option", { hasText: "Ferme" }) })
  await typeSelect.selectOption({ label: "Ferme" })
  await page.getByRole("button", { name: "Rechercher" }).click()

  await expect(page.getByText("Aucun résultat")).toBeVisible()
  await expect(page.getByText(fx.numeros.t1)).toHaveCount(0)
})

test("expose les bonnes actions selon le statut", async ({ page }) => {
  const analysed = page.getByRole("row").filter({ hasText: fx.numeros.t1 })
  await expect(analysed.getByRole("button", { name: "Voir" })).toBeVisible()
  await expect(analysed.getByRole("button", { name: "Ajouter au panier" })).toBeVisible()

  const nonAnalysee = page.getByRole("row").filter({ hasText: fx.numeros.t4 })
  await expect(nonAnalysee.getByRole("button", { name: "Analyser" })).toBeVisible()
  await expect(nonAnalysee.getByRole("button", { name: "Ajouter au panier" })).toHaveCount(0)
})

test("ouvre la fiche via l'action Voir", async ({ page }) => {
  const analysed = page.getByRole("row").filter({ hasText: fx.numeros.t1 })
  await analysed.getByRole("button", { name: "Voir" }).click()
  await expect(page).toHaveURL(new RegExp(`/transactions/${fx.transactions.t1}`))
  await expect(page.getByRole("heading", { level: 1, name: "Fiche de transaction" })).toBeVisible()
})
