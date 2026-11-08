import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

/** Finaliser ouvre une confirmation : on la valide pour déclencher les règles bloquantes. */
async function finaliser(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("button", { name: "Finaliser", exact: true }).click()
  await page.getByRole("button", { name: "Confirmer l'analyse" }).click()
}

test("Enregistrer ne valide pas ; Finaliser refuse sans type de transaction, puis accepte une fois le type choisi", async ({
  page,
}) => {
  await page.goto(`/transactions/${fx.transactions.t5}`)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  // Enregistrer sauvegarde la saisie incomplète, sans message bloquant.
  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByText("Le type de transaction est obligatoire.")).toHaveCount(0)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  // Finaliser applique la règle bloquante V-TYPE : le message s'affiche sous le champ, la fiche reste en édition.
  await finaliser(page)
  await expect(page.getByText("Le type de transaction est obligatoire.")).toBeVisible()
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  // Corriger le champ efface immédiatement le message, sans nouvel aller-retour serveur.
  await page.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Terres cultivées" }).click()
  await expect(page.getByText("Le type de transaction est obligatoire.")).toHaveCount(0)
})

test("demande confirmation avant de passer la transaction à analysée", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t5}`)

  await page.getByRole("button", { name: "Finaliser", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Passer la transaction à « Analysée » ?" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Passer la transaction à « Analysée » ?" })
  ).toHaveCount(0)

  // Annuler ne change rien : la transaction reste non analysée.
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Finaliser", exact: true })).toBeEnabled()
})

test("bloque Finaliser, sans bloquer Enregistrer, quand la date de vente est dans le futur", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t6}`)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  // La date de vente est un champ importé en lecture seule : la règle V-004 bloque le passage à « Analysée »
  // mais pas l'enregistrement.
  const message = "La date de vente ne peut pas être postérieure à aujourd'hui."

  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByText(message)).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled()

  await finaliser(page)
  await expect(page.getByText(message)).toBeVisible()
  // Le statut n'a pas changé : la validation a interrompu le passage à « Analysée ».
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Finaliser", exact: true })).toBeEnabled()
})
