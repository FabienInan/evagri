import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

/**
 * Non-régression : dans chaque fenêtre modale, les listes de choix appliquent la valeur choisie et la fenêtre reste
 * ouverte. Les choix sont faits par leur libellé réel (pas par position, qui peut tomber sur un libellé de groupe).
 */

const fx = fixtures()

test("création de champ : Nature et Type de données appliquent le choix sans fermer la fenêtre", async ({ page }) => {
  await page.goto("/admin/champs")
  await page.getByRole("button", { name: "Nouveau champ", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Nouveau champ enrichissable" })

  const nature = dialog.getByText("Nature", { exact: true }).locator("..").getByRole("combobox")
  await nature.click()
  await page.getByRole("option", { name: "Calculé", exact: true }).click()
  await expect(nature).toContainText("Calculé")

  const type = dialog.getByText("Type de données", { exact: true }).locator("..").getByRole("combobox")
  await type.click()
  await page.getByRole("option", { name: "Entier", exact: true }).click()
  await expect(type).toContainText("Entier")

  await expect(dialog).toBeVisible()
})

test("ajout de filtre : Champ cible et Type de filtre appliquent le choix sans fermer la fenêtre", async ({ page }) => {
  await page.goto("/admin/filters")
  await page.getByRole("button", { name: "Ajouter un filtre", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Ajouter un filtre" })

  const cible = dialog.getByRole("combobox").first()
  await cible.click()
  await page.getByRole("option", { name: "Taux cultivé de référence", exact: true }).click()
  await expect(cible).toContainText("Taux cultivé de référence")

  const type = dialog.getByRole("combobox").nth(1)
  await type.click()
  await page.getByRole("option", { name: "Recherche texte", exact: true }).click()
  await expect(type).toContainText("Recherche texte")

  await expect(dialog).toBeVisible()
})

test("création de panier : le type de transaction est pris en compte", async ({ page }) => {
  await page.goto(`/dossiers/${fx.dossierId}`)
  await page.getByRole("button", { name: "Nouveau panier" }).click()
  const dialog = page.getByRole("dialog", { name: "Nouveau panier" })

  await dialog.getByLabel("Type de transaction (optionnel)").selectOption({ label: "Terres cultivées" })
  await expect(dialog.getByLabel("Type de transaction (optionnel)")).toHaveValue(/.+/)
  await expect(dialog).toBeVisible()
})

test("la liste d'un sélecteur ouvert passe au-dessus de la fenêtre modale", async ({ page }) => {
  await page.goto("/admin/champs")
  await page.getByRole("button", { name: "Nouveau champ", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Nouveau champ enrichissable" })
  const type = dialog.getByText("Type de données", { exact: true }).locator("..").getByRole("combobox")
  await type.click()
  await expect(page.getByRole("listbox")).toBeVisible()

  const [listZ, modalZ] = await page.evaluate(() => {
    const listbox = document.querySelector('[role="listbox"]') as HTMLElement
    // Le conteneur de la liste est le premier ancêtre en position fixe (portail Radix).
    let wrapper: HTMLElement = listbox
    while (wrapper.parentElement && getComputedStyle(wrapper).position !== "fixed") wrapper = wrapper.parentElement
    const overlay = document.querySelector('[role="dialog"]')!.parentElement as HTMLElement
    return [Number(getComputedStyle(wrapper).zIndex), Number(getComputedStyle(overlay).zIndex)]
  })
  expect(listZ).toBeGreaterThan(modalZ)
})
