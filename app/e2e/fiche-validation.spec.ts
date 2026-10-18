import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("refuse d'enregistrer sans type de transaction, puis accepte une fois le type choisi", async ({
  page,
}) => {
  await page.goto(`/transactions/${fx.transactions.t5}`)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  // Aucun type sélectionné : la règle bloquante V-TYPE s'affiche sous le champ, la fiche reste en édition.
  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByText("Le type de transaction est obligatoire.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled()

  // Corriger le champ efface immédiatement le message, sans nouvel aller-retour serveur.
  await page.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Terres cultivées" }).click()
  await expect(page.getByText("Le type de transaction est obligatoire.")).toHaveCount(0)

  // Le nouvel enregistrement passe.
  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled()
  await expect(page.getByText("Le type de transaction est obligatoire.")).toHaveCount(0)
})

test("bloque Enregistrer et Analyser quand la date de vente est dans le futur", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t6}`)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  // La date de vente est un champ importé en lecture seule : on ne peut pas la corriger, mais la règle
  // V-004 doit empêcher à la fois l'enregistrement et le passage à « Analysée ».
  const message = "La date de vente ne peut pas être postérieure à aujourd'hui."

  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByText(message)).toBeVisible()
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled()

  await page.getByRole("button", { name: "Analyser" }).click()
  await expect(page.getByText(message)).toBeVisible()
  // Le statut n'a pas changé : la validation a interrompu le passage à « Analysée ».
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Analyser" })).toBeEnabled()
})
