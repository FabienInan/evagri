import { expect, test } from "@playwright/test"

/** La touche D ne doit pas basculer le thème clair/sombre (raccourci supprimé). */

test("appuyer sur D ne change pas le thème", async ({ page }) => {
  await page.goto("/transactions")
  await expect(page.getByRole("heading", { level: 1, name: "Liste des transactions" })).toBeVisible()
  const avant = await page.evaluate(() => document.documentElement.className)

  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("d")
  await page.keyboard.press("D")

  expect(await page.evaluate(() => document.documentElement.className)).toBe(avant)
})
