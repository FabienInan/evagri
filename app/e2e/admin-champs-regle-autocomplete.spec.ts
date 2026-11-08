import { expect, test, type Locator, type Page } from "@playwright/test"

/**
 * Suggestions du champ « Règle de calcul » (création) : taper les premières lettres d'un champ décimal ou
 * entier propose son code, Enter/Tab l'insère, et les champs non numériques ne sont jamais proposés.
 */

function createCard(page: Page): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Nouveau champ enrichissable", { exact: true }) })
}

function ruleInput(page: Page): Locator {
  return createCard(page).getByText(/^Règle de calcul/).locator("..").getByRole("combobox")
}

test("propose les champs numériques correspondant aux premières lettres et insère le choix", async ({ page }) => {
  await page.goto("/admin/champs")
  const input = ruleInput(page)
  await input.click()

  await input.pressSequentially("prix_v")
  const listbox = page.getByRole("listbox")
  // Plusieurs codes commencent par « prix_v » : le plus court exact (prix_vente) doit arriver en tête.
  await expect(listbox.getByRole("option").first()).toContainText("prix_vente")
  // Un champ texte ne doit jamais être proposé dans une règle de calcul.
  await expect(listbox.getByRole("option", { name: /^numero_inscription/ })).toHaveCount(0)

  await input.press("Enter")
  await expect(input).toHaveValue("prix_vente")
  await expect(listbox).toHaveCount(0)
})

test("Tab insère la suggestion en cours après un opérateur, et Échap referme la liste", async ({ page }) => {
  await page.goto("/admin/champs")
  const input = ruleInput(page)
  await input.click()

  await input.pressSequentially("prix_vente / superficie_to")
  await expect(page.getByRole("listbox").getByRole("option").first()).toContainText("superficie_totale_hectare")
  await input.press("Tab")
  await expect(input).toHaveValue("prix_vente / superficie_totale_hectare")

  await input.press("End")
  await input.pressSequentially(" + pr")
  await expect(page.getByRole("option").first()).toContainText("prix_vente")
  await input.press("Escape")
  await expect(page.getByRole("listbox")).toHaveCount(0)
})

test("un terme commun liste tous les champs correspondants, au-delà de huit, et la liste défile aux flèches", async ({ page }) => {
  await page.goto("/admin/champs")
  const input = ruleInput(page)
  await input.click()

  await input.pressSequentially("superficie_totale")
  const listbox = page.getByRole("listbox")
  await expect(listbox.getByRole("option").first()).toContainText("superficie_totale_hectare")
  // Flèche haut depuis la première option : on boucle sur la dernière, qui doit être visible (défilement).
  await input.press("ArrowUp")
  await expect(listbox.getByRole("option").last()).toHaveAttribute("aria-selected", "true")
  await expect(listbox.getByRole("option").last()).toBeInViewport()

  // Un terme commun : toutes les correspondances sont proposées, pas seulement les huit premières.
  await input.fill("")
  await input.pressSequentially("superficie")
  await expect.poll(() => listbox.getByRole("option").count()).toBeGreaterThan(8)
})
