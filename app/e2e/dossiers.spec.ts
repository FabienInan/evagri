import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("liste les dossiers existants", async ({ page }) => {
  await page.goto("/dossiers")
  await expect(page.getByRole("heading", { level: 1, name: "Dossiers" })).toBeVisible()
  await expect(page.getByText(fx.dossierNumero)).toBeVisible()
  await expect(page.getByRole("button", { name: "Nouveau dossier" })).toBeVisible()
})

test("crée un dossier puis un panier depuis le détail", async ({ page }) => {
  await page.goto("/dossiers")

  await page.getByRole("button", { name: "Nouveau dossier" }).click()
  await page.getByLabel("Numéro de dossier").fill("99-ZZ-999")
  await page.getByLabel("Nom (optionnel)").fill("Dossier créé par test")
  await page.getByRole("button", { name: "Créer" }).click()

  // La création route vers la page de détail du nouveau dossier.
  await expect(page).toHaveURL(/\/dossiers\/[0-9a-f-]+$/)
  await expect(page.getByText("99-ZZ-999")).toBeVisible()
  await expect(page.getByText("Aucun panier dans ce dossier.")).toBeVisible()

  await page.getByRole("button", { name: "Nouveau panier" }).click()
  await page.getByLabel("Nom du panier").fill("Panier créé par test")
  await page.getByRole("button", { name: "Créer" }).click()

  // La création route vers la vue du panier, encore vide.
  await expect(page).toHaveURL(/\/paniers\/[0-9a-f-]+$/)
  await expect(page.getByRole("heading", { level: 1, name: "Panier" })).toBeVisible()
  await expect(page.getByText("Aucune transaction dans ce panier")).toBeVisible()
})

test("refuse un numéro de dossier au mauvais format", async ({ page }) => {
  await page.goto("/dossiers")
  await page.getByRole("button", { name: "Nouveau dossier" }).click()
  await page.getByLabel("Numéro de dossier").fill("abc")

  await page.getByRole("button", { name: "Créer" }).click()
  await expect(page.getByText("Format attendu : AA-RR-DDD (ex. 25-AB-001).")).toBeVisible()
  // Le dialogue reste ouvert sur l'erreur : rien n'a été créé.
  await expect(page.getByRole("button", { name: "Créer" })).toBeVisible()
})

test("refuse un numéro de dossier déjà utilisé", async ({ page }) => {
  await page.goto("/dossiers")
  await page.getByRole("button", { name: "Nouveau dossier" }).click()
  // Le format est valide, mais ce numéro est déjà celui du dossier semé.
  await page.getByLabel("Numéro de dossier").fill(fx.dossierNumero)

  await page.getByRole("button", { name: "Créer" }).click()
  await expect(page.getByText("Un dossier existe déjà avec ce numéro.")).toBeVisible()
})
