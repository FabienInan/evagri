import { expect, test } from "@playwright/test"

test("les colonnes ne changent pas à l'ouverture ou la fermeture du volet de filtres", async ({ page }) => {
  await page.goto("/transactions")
  await expect(page.getByRole("columnheader", { name: "Prix à l'acte" })).toBeVisible()
  await expect.poll(() => page.evaluate(() => { const th = document.querySelector("thead th"); return th ? Object.keys(th).some((k) => k.startsWith("__reactProps")) : false })).toBe(true)
  const labels = async () => (await page.locator("thead th").allInnerTexts()).map((t) => t.trim()).filter(Boolean)
  const before = await labels()
  const btn = page.getByRole("button", { name: /filtres/i }).first()
  await btn.click()
  await page.waitForTimeout(400)
  const afterOpen = await labels()
  await btn.click()
  await page.waitForTimeout(400)
  const afterClose = await labels()
    expect(afterOpen).toEqual(before)
  expect(afterClose).toEqual(before)
})
