import { expect, test, type Page } from "@playwright/test"
import { fixtures } from "./fixtures"

/**
 * « Ajouter au panier » ajoute au panier courant, choisi dans la barre latérale (sélecteurs Dossier et Panier).
 * Le contexte est mémorisé dans le navigateur ; chaque test part d'un navigateur vierge.
 */

const fx = fixtures()

async function choisirPanierCourant(page: Page): Promise<void> {
  await page.getByLabel("Dossier courant").selectOption({ label: fx.dossierNumero })
  await page.getByLabel("Panier courant").selectOption({ label: "Cible e2e" })
}

test("ajoute une transaction au panier courant depuis la liste", async ({ page }) => {
  await page.goto("/transactions")
  await choisirPanierCourant(page)

  const row = page.getByRole("row").filter({ hasText: fx.numeros.t1 })
  await row.getByRole("button", { name: "Ajouter au panier" }).click()
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toBeVisible()
  await expect(page.getByRole("dialog", { name: "Ajouter au panier" }).getByText("Cible e2e", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()

  // Succès : la fenêtre se referme et la transaction est bien présente dans le panier cible.
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toHaveCount(0)
  await page.goto(`/paniers/${fx.paniers.cible}`)
  await expect(page.getByText(fx.numeros.t1)).toBeVisible()
})

test("ajoute une transaction au panier courant depuis la fiche", async ({ page }) => {
  await page.goto("/transactions")
  await choisirPanierCourant(page)

  await page.goto(`/transactions/${fx.transactions.t2}`)
  await page.getByRole("button", { name: "Ajouter au panier" }).click()

  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toBeVisible()
  await expect(page.getByText("1 transaction sélectionnée.")).toBeVisible()
  await page.getByRole("button", { name: "Fermer" }).first().click()
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toHaveCount(0)
})

test("sans panier courant, Ajouter est désactivé et renvoie vers la barre latérale", async ({ page }) => {
  await page.goto("/transactions")
  const row = page.getByRole("row").filter({ hasText: fx.numeros.t3 })
  await row.getByRole("button", { name: "Ajouter au panier" }).click()

  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toBeVisible()
  await expect(page.getByText(/barre latérale/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Ajouter", exact: true })).toBeDisabled()
})

test("le panier courant est conservé d'une page à l'autre", async ({ page }) => {
  await page.goto("/transactions")
  await choisirPanierCourant(page)

  await page.goto(`/transactions/${fx.transactions.t9}`)
  await expect(page.getByLabel("Panier courant")).toHaveValue(fx.paniers.cible)
})
