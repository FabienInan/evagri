import { expect, test } from "@playwright/test"

test("le taux de croissance d'un panier peut être modifié après sa création", async ({ page }) => {
  await page.goto("/dossiers")
  await page.locator("a[href^='/dossiers/']", { hasText: "99-99-001" }).first().click()
  await page.locator("a[href^='/paniers/']").first().click()
  const button = page.getByRole("button", { name: /Taux/ }).first()
  await expect(button).toBeVisible()
  await button.click()
  await page.getByLabel("Taux de croissance annuel (%)").fill("4,5")
  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByRole("button", { name: "Taux : 4.5 %" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("button", { name: "Taux : 4.5 %" })).toBeVisible()
})

test("un taux invalide est refusé avec un message", async ({ page }) => {
  await page.goto("/dossiers")
  await page.locator("a[href^='/dossiers/']", { hasText: "99-99-001" }).first().click()
  await page.locator("a[href^='/paniers/']").first().click()
  await page.getByRole("button", { name: /Taux/ }).first().click()
  await page.getByLabel("Taux de croissance annuel (%)").fill("150")
  await page.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByText("doit être inférieur à 100 %")).toBeVisible()
})
