import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("fiche d'une transaction analysée : consultation", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t1}`)
  await expect(page.getByRole("heading", { level: 1, name: "Fiche de transaction" })).toBeVisible()
  await expect(page.getByText("Analysée", { exact: true })).toBeVisible()
  const addToPanier = page.getByRole("button", { name: "Ajouter au panier" })
  await expect(addToPanier).toBeVisible()
  // Vert de la charte (Gazon) : la variante par défaut, pas une bordure.
  await expect(addToPanier).toHaveClass(/bg-primary/)
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0)
})

test("fiche d'une transaction non analysée : édition et enregistrement", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t4}`)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Analyser" })).toBeVisible()

  // Renseigne le type de transaction puis enregistre : aucune erreur ne doit s'afficher.
  await page.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Terres cultivées" }).click()
  await page.getByRole("button", { name: "Enregistrer" }).click()

  // Le bouton se réactive une fois l'aller-retour serveur terminé, sans message d'échec.
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled()
  await expect(page.getByText("Échec de l'enregistrement. Réessayez.")).toHaveCount(0)
})
