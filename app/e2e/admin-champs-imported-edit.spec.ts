import { expect, test } from "@playwright/test"

/**
 * Renommer un champ importé (ex. « Vendeur ») dans la configuration des champs : l'enregistrement doit réussir
 * sans exiger de type de transaction, puisque les champs importés s'appliquent à tous les types. Le nom est
 * remis à l'original à la fin du test.
 */

test("renomme un champ importé sans erreur de type de transaction", async ({ page }) => {
  await page.goto("/admin/champs")
  const row = page.getByRole("button", { name: /Vendeur/ }).first()
  await row.click()

  // Le panneau d'édition est le dernier bloc « Nom affiché » (le premier est celui de la carte de création).
  const nameInput = page.getByText("Nom affiché", { exact: true }).last().locator("..").getByRole("textbox")
  try {
    await nameInput.fill("Vendeur e2e")
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
    await expect(page.getByText("Au moins un type de transaction doit etre selectionne.")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Enregistré ✓" })).toBeVisible()
  } finally {
    await nameInput.fill("Vendeur")
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
    await expect(page.getByRole("button", { name: "Enregistré ✓" })).toBeVisible()
  }
})
