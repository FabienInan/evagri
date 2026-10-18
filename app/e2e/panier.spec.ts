import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("affiche par défaut les mêmes colonnes de champs que la liste des transactions", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)

  // Mêmes champs importés visibles que /transactions, dans le même ordre, puis la colonne de retrait
  // (sans libellé). Les champs enrichissables et les indicateurs calculés restent masqués par défaut.
  await expect(page.getByRole("columnheader")).toHaveText([
    "N° d'inscription",
    "Date de vente",
    "Prix à l'acte",
    "MRC",
    "Superficie (ha)",
    "",
  ])
})

// Affichage et retrait dans un seul test : le retrait mute le panier, donc l'ordre des assertions doit être
// garanti (des tests séparés dépendraient de l'ordre d'exécution du fichier).
test("affiche les transactions du panier puis en retire une", async ({ page }) => {
  await page.goto(`/paniers/${fx.paniers.source}`)
  await expect(page.getByRole("heading", { level: 1, name: "Panier" })).toBeVisible()
  await expect(page.getByText("Comparables e2e")).toBeVisible()
  await expect(page.getByText(fx.numeros.t1)).toBeVisible()
  await expect(page.getByText(fx.numeros.t2)).toBeVisible()
  await expect(page.getByText("(2 éléments)")).toBeVisible()

  const row = page.getByRole("row").filter({ hasText: fx.numeros.t1 })
  await row.getByRole("button", { name: "Retirer du panier" }).click()

  await expect(page.getByText(fx.numeros.t1)).toHaveCount(0)
  await expect(page.getByText("(1 élément)")).toBeVisible()
})
