import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import * as XLSX from "xlsx"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("exporte le panier en Excel avec le prix actualisé", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await expect(page.getByRole("heading", { name: "Exporter en Excel" })).toBeVisible()

  await page.getByLabel("Taux de croissance (%)").fill("5")
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^export-.+\.xlsx$/)
  const path = await download.path()
  const workbook = XLSX.read(await readFile(path), { type: "buffer" })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])

  expect(rows.length).toBeGreaterThan(0)
  // Colonnes importées visibles par défaut + indicateur calculé dans le contexte de l'export (§7.9).
  expect(rows[0]).toHaveProperty("N° d'inscription")
  expect(rows[0]).toHaveProperty("Prix actualisé")
})

test("refuse l'export sans taux de croissance", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await page.getByRole("button", { name: "Exporter", exact: true }).click()

  await expect(page.getByText("Le taux de croissance doit être un nombre.")).toBeVisible()
})
