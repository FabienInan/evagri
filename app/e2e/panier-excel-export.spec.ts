import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import * as XLSX from "xlsx"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("crée une analyse de dossier avec un taux de croissance", async ({ page }) => {
  await page.goto(`/dossiers/${fx.dossierId}`)

  await page.getByRole("button", { name: "Nouvelle analyse" }).click()
  await page.getByLabel("Taux de croissance (%)").fill("5")
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(page.getByText(/Évaluation du \d{2}\/\d{2}\/\d{4}/).first()).toBeVisible()
})

test("refuse la création d'une analyse sans taux de croissance", async ({ page }) => {
  await page.goto(`/dossiers/${fx.dossierId}`)

  await page.getByRole("button", { name: "Nouvelle analyse" }).click()
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(page.getByText("Le taux de croissance doit être un nombre.")).toBeVisible()
})

test("exporte le panier en Excel avec le prix actualisé de l'analyse", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await expect(page.getByRole("heading", { name: "Exporter en Excel" })).toBeVisible()

  await page.getByLabel("Analyse de dossier").selectOption({ index: 1 })
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^export-.+\.xlsx$/)
  const path = await download.path()
  const workbook = XLSX.read(await readFile(path), { type: "buffer" })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])

  expect(rows.length).toBeGreaterThan(0)
  // Colonnes importées visibles par défaut + indicateur ajusté repris de l'analyse (§7.9).
  expect(rows[0]).toHaveProperty("N° d'inscription")
  expect(rows[0]).toHaveProperty("Prix actualisé")
})

test("refuse l'export d'indicateurs ajustés sans analyse de dossier", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  await page.getByRole("button", { name: "Exporter Excel" }).click()
  await page.getByRole("button", { name: "Exporter", exact: true }).click()

  await expect(
    page.getByText("Choisissez une analyse de dossier pour inclure les indicateurs ajustés.")
  ).toBeVisible()
})
