import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()
const dossierOption = `${fx.dossierNumero} — Dossier e2e`

test("ajoute une transaction au panier depuis la liste", async ({ page }) => {
  await page.goto("/transactions")
  const row = page.getByRole("row").filter({ hasText: fx.numeros.t1 })
  await row.getByRole("button", { name: "Ajouter au panier" }).click()

  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toBeVisible()

  await page.getByLabel("Dossier").selectOption({ label: dossierOption })
  await expect(page.getByLabel("Panier").locator("option", { hasText: "Cible e2e" })).toHaveCount(1)
  await page.getByLabel("Panier").selectOption({ label: "Cible e2e" })
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()

  // Succès : la modale se referme et la transaction est bien présente dans le panier cible.
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toHaveCount(0)
  await page.goto(`/paniers/${fx.paniers.cible}`)
  await expect(page.getByText(fx.numeros.t1)).toBeVisible()
})

test("ajoute une transaction au panier depuis la fiche", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t2}`)
  await page.getByRole("button", { name: "Ajouter au panier" }).click()

  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toBeVisible()
  await expect(page.getByText("1 transaction sélectionnée.")).toBeVisible()

  await page.getByRole("button", { name: "Fermer" }).first().click()
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toHaveCount(0)
})

test("refuse de confirmer sans panier choisi", async ({ page }) => {
  await page.goto("/transactions")
  const row = page.getByRole("row").filter({ hasText: fx.numeros.t3 })
  await row.getByRole("button", { name: "Ajouter au panier" }).click()
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toBeVisible()

  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await expect(page.getByText("Sélectionnez un panier.")).toBeVisible()
})
