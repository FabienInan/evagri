import { expect, test } from "@playwright/test"

/**
 * Un champ calculé n'a pas de type choisi : il prend le type déduit de sa règle. Ici la règle utilise un champ
 * décimal (prix_vente) : le type affiché est Décimal, le sélecteur est en lecture seule, et le champ est enregistré
 * avec ce type. Le nom commence par « E2E » : le nettoyage de la suite le supprime.
 */

test("un champ calculé affiche le type déduit de sa règle, en lecture seule", async ({ page }) => {
  await page.goto("/admin/champs")
  await page.getByRole("button", { name: "Nouveau champ", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Nouveau champ enrichissable" })

  await dialog.getByText("Nom affiché", { exact: true }).locator("..").getByRole("textbox").fill("E2E Calcule type")
  await dialog.getByText("Nature", { exact: true }).locator("..").getByRole("combobox").click()
  await page.getByRole("option", { name: "Calculé", exact: true }).click()
  await dialog.getByText("Unité", { exact: true }).locator("..").getByRole("textbox").fill("$")
  await dialog.getByText(/^Règle de calcul/).locator("..").getByRole("combobox").fill("prix_vente / superficie_totale_hectare")

  const type = dialog.getByText("Type de données", { exact: true }).locator("..").getByRole("combobox")
  await expect(type).toBeDisabled()
  await expect(type).toContainText("Décimal")

  await dialog.getByRole("checkbox", { name: "Terres cultivées" }).check()
  await dialog.getByRole("button", { name: "Créer le champ" }).click()
  await expect(page.getByRole("button", { name: /E2E Calcule type/ }).first()).toBeVisible()
})
