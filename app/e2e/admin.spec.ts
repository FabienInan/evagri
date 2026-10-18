import { expect, test } from "@playwright/test"

test("page admin des champs enrichissables", async ({ page }) => {
  await page.goto("/admin/champs")
  await expect(page.getByRole("heading", { level: 1, name: "Champs enrichissables" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Champs enrichissables" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Disposition de la fiche" })).toBeVisible()
  await expect(page.getByText("Nouveau champ enrichissable")).toBeVisible()
  // Cibler le bouton de la liste : le champ peut aussi apparaître dans le panneau d'édition
  // (le premier champ est sélectionné par défaut).
  await expect(page.getByRole("button", { name: /^N° d'inscription/ })).toBeVisible()
})

test("page admin de configuration des filtres", async ({ page }) => {
  await page.goto("/admin/filters")
  await expect(page.getByRole("heading", { level: 1, name: "Configuration des filtres" })).toBeVisible()
  await expect(page.getByText("Ajouter un filtre")).toBeVisible()
  await expect(page.getByText("Statut d'analyse")).toBeVisible()
})

test("page admin de gestion des imports", async ({ page }) => {
  await page.goto("/admin/import")
  await expect(page.getByRole("heading", { level: 1, name: "Gestion des imports" })).toBeVisible()
  await expect(page.getByText("Importer un fichier Excel EVAGRI")).toBeVisible()
  await expect(page.getByLabel("Fichier Excel")).toBeVisible()
  await expect(page.getByText("Importer des actes PDF")).toBeVisible()
  await expect(page.getByLabel("Documents PDF")).toBeVisible()
  await expect(page.getByText("Historique des importations")).toBeVisible()
})
