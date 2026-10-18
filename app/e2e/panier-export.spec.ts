import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fixtures } from "./fixtures"

const fx = fixtures()

// En-tête d'un fichier PNG : 89 50 4E 47 0D 0A 1A 0A.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

test("exporte la carte du panier en PNG", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  const button = page.getByRole("button", { name: "Exporter la carte" })
  await expect(button).toBeEnabled()

  // Un pin par transaction géolocalisée, portant le seul numéro de vente (§7.10).
  await expect(page.locator(".panier-export-pin-inner", { hasText: fx.numeros.t1 })).toHaveCount(1)
  await expect(page.locator(".panier-export-pin-inner", { hasText: fx.numeros.t2 })).toHaveCount(1)

  const [download] = await Promise.all([page.waitForEvent("download"), button.click()])

  expect(download.suggestedFilename()).toMatch(/^carte-.+\.png$/)
  const path = await download.path()
  const bytes = await readFile(path)
  expect(bytes.length).toBeGreaterThan(0)
  expect(bytes.subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
})

test("désactive l'export quand le panier n'a aucune transaction géolocalisée", async ({ page }) => {
  // Le panier « Vide e2e » n'est peuplé par aucun scénario : il reste vide même après les tests qui
  // remplissent le panier cible.
  await page.goto(`/paniers/${fx.paniers.vide}`)
  await expect(page.getByText("Aucune transaction dans ce panier")).toBeVisible()

  const button = page.getByRole("button", { name: "Exporter la carte" })
  await expect(button).toBeVisible()
  await expect(button).toBeDisabled()
})
