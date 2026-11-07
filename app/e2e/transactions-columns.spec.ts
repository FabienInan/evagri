import { expect, test, type Page } from "@playwright/test"

/** Ordre et visibilité des colonnes de la liste des transactions : persistés dans le navigateur. */

async function openTransactions(page: Page): Promise<void> {
  await page.goto("/transactions")
  await expect(page.getByRole("columnheader", { name: "Prix à l'acte" })).toBeVisible()
}

/** Attend l'hydratation React : avant, le HTML serveur affiche la disposition par défaut et ignore le localStorage. */
async function waitForHydration(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const th = document.querySelector("thead th")
        return th ? Object.keys(th).some((k) => k.startsWith("__reactProps")) : false
      })
    )
    .toBe(true)
}

async function headerLabels(page: Page): Promise<string[]> {
  return (await page.locator("thead th").allInnerTexts()).map((t) => t.trim()).filter(Boolean)
}

test("l'ordre des colonnes des transactions est restauré après rechargement", async ({ page }) => {
  await openTransactions(page)
  const before = await headerLabels(page)
  await waitForHydration(page)
  const headers = page.locator("thead th")
  await headers.nth(1).dragTo(headers.nth(0))
  const moved = await headerLabels(page)
  expect(moved).not.toEqual(before)

  await page.reload()
  await waitForHydration(page)
  await expect.poll(() => headerLabels(page)).toEqual(moved)
})

test("les colonnes masquées des transactions restent masquées après rechargement", async ({ page }) => {
  await openTransactions(page)
  const hidden = (await headerLabels(page))[1]

  await waitForHydration(page)
  await page.getByRole("button", { name: "Colonnes" }).click()
  await page.locator("label", { hasText: hidden }).locator("input").uncheck()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("columnheader", { name: hidden, exact: true })).toHaveCount(0)

  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole("columnheader", { name: hidden, exact: true })).toHaveCount(0)
})
