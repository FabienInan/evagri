import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import * as XLSX from "xlsx"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("affiche la date d'évaluation du dossier et le taux du panier dans l'export", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await expect(page.getByRole("heading", { name: "Exporter en Excel" })).toBeVisible()
  await expect(page.getByText("01/01/2026")).toBeVisible()
  await expect(page.getByText("5 %")).toBeVisible()
})

test("exporte le panier en Excel avec le prix actualisé", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await expect(page.getByRole("heading", { name: "Exporter en Excel" })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^export-.+\.xlsx$/)
  const path = await download.path()
  const workbook = XLSX.read(await readFile(path), { type: "buffer" })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])

  expect(rows.length).toBeGreaterThan(0)
  // Colonnes importées visibles par défaut + indicateur ajusté calculé à partir du dossier et du panier.
  expect(rows[0]).toHaveProperty("N° d'inscription")
  expect(rows[0]).toHaveProperty("Prix actualisé")
})
