import { expect, test } from "@playwright/test"

/**
 * Types de transaction applicables : plusieurs cases peuvent être cochées, et les types cochés sont
 * restitués à la réouverture du champ. Le nom commence par « E2E » : le nettoyage de la suite le supprime.
 */

test("coche plusieurs types de transaction et les retrouve après enregistrement", async ({ page }) => {
  await page.goto("/admin/champs")
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Nouveau champ enrichissable", { exact: true }) })

  await card.getByText("Nom affiché", { exact: true }).locator("..").getByRole("textbox").fill("E2E Types multiples")
  await card.getByText("Unité", { exact: true }).locator("..").getByRole("textbox").fill("ha")
  await card.getByRole("checkbox", { name: "Terres cultivées" }).check()
  await card.getByRole("checkbox", { name: "Terres boisées" }).check()
  await expect(card.getByText(/Types de transaction applicables/)).toContainText("(2)")
  await card.getByRole("button", { name: "Créer le champ" }).click()

  await expect(page.getByRole("button", { name: /E2E Types multiples/ }).first()).toBeVisible()
  await page.getByRole("button", { name: /E2E Types multiples/ }).first().click()

  await expect(page.getByRole("checkbox", { name: "Terres cultivées" }).last()).toBeChecked()
  await expect(page.getByRole("checkbox", { name: "Terres boisées" }).last()).toBeChecked()
  await expect(page.getByRole("checkbox", { name: "Érablières" }).last()).not.toBeChecked()
})
