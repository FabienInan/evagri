import { expect, test, type Locator, type Page } from "@playwright/test"

/**
 * Création et édition de champs enrichissables via l'admin (§6.5). Chaque test crée (ou tente de créer) un
 * champ dont le nom commence par « E2E » : `cleanup()` les supprime après la suite, et le préfixe garantit
 * que deux exécutions ne se heurtent pas au contrôle d'unicité du code machine.
 */

function createCard(page: Page): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Nouveau champ enrichissable", { exact: true }) })
}

async function pick(page: Page, card: Locator, label: string, option: string): Promise<void> {
  await card.getByText(label, { exact: true }).locator("..").getByRole("combobox").click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

async function fillName(page: Page, name: string): Promise<void> {
  await createCard(page).getByRole("textbox").first().fill(name)
}

async function fillUnit(page: Page, unit: string): Promise<void> {
  await createCard(page).getByText("Unité", { exact: true }).locator("..").getByRole("textbox").fill(unit)
}

async function fillRule(page: Page, rule: string): Promise<void> {
  await createCard(page)
    .getByText(/^Règle de calcul/)
    .locator("..")
    .getByRole("textbox")
    .fill(rule)
}

async function fillOptions(page: Page, options: string): Promise<void> {
  await createCard(page)
    .getByText("Options de liste", { exact: true })
    .locator("..")
    .getByRole("textbox")
    .fill(options)
}

async function applyToTypes(page: Page): Promise<void> {
  await pick(page, createCard(page), "Types de transaction applicables", "Terres cultivées")
}

async function clickCreate(page: Page): Promise<void> {
  await createCard(page).getByRole("button", { name: "Créer le champ" }).click()
}

function row(page: Page, name: string): Locator {
  return page.locator("button").filter({ hasText: name }).first()
}

test.beforeEach(async ({ page }) => {
  await page.goto("/admin/champs")
  await expect(page.getByRole("heading", { level: 1, name: "Champs enrichissables" })).toBeVisible()
})

test("crée un champ saisissable décimal et l'affiche dans la liste", async ({ page }) => {
  await fillName(page, "E2E Creation decimale")
  await fillUnit(page, "ha")
  await applyToTypes(page)
  await clickCreate(page)

  const created = row(page, "E2E Creation decimale")
  await expect(created).toBeVisible()
  await expect(created.getByText("Saisissable", { exact: true })).toBeVisible()
  await expect(created).toContainText("e2e_creation_decimale")
  await expect(created).toContainText("ha")
})

test("crée un champ calculé avec une règle et l'affiche comme Calculé", async ({ page }) => {
  await fillName(page, "E2E Creation calculee")
  await pick(page, createCard(page), "Nature", "Calculé")
  await pick(page, createCard(page), "Type de données", "Entier")
  await fillUnit(page, "$/ha")
  await fillRule(page, "prix_vente / superficie_totale_hectare")
  await applyToTypes(page)
  await clickCreate(page)

  const created = row(page, "E2E Creation calculee")
  await expect(created).toBeVisible()
  await expect(created.getByText("Calculé", { exact: true })).toBeVisible()
})

test("crée un champ liste avec ses options", async ({ page }) => {
  await fillName(page, "E2E Creation liste")
  await pick(page, createCard(page), "Type de données", "Liste")
  await fillOptions(page, "Alpha\nBeta")
  await applyToTypes(page)
  await clickCreate(page)

  const created = row(page, "E2E Creation liste")
  await expect(created).toBeVisible()
  await expect(created).toContainText("Liste")
})

test("crée un champ liste à choix multiple", async ({ page }) => {
  await fillName(page, "E2E Creation multi")
  await pick(page, createCard(page), "Type de données", "Liste (choix multiple)")
  await fillOptions(page, "X\nY")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(row(page, "E2E Creation multi")).toBeVisible()
})

test("crée un champ texte", async ({ page }) => {
  await fillName(page, "E2E Creation texte")
  await pick(page, createCard(page), "Type de données", "Texte")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(row(page, "E2E Creation texte")).toBeVisible()
})

test("crée un champ booléen", async ({ page }) => {
  await fillName(page, "E2E Creation booleen")
  await pick(page, createCard(page), "Type de données", "Booléen")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(row(page, "E2E Creation booleen")).toBeVisible()
})

test("crée un champ date", async ({ page }) => {
  await fillName(page, "E2E Creation date")
  await pick(page, createCard(page), "Type de données", "Date")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(row(page, "E2E Creation date")).toBeVisible()
})

test("dérive le code machine du nom affiché, accents retirés", async ({ page }) => {
  await fillName(page, "Coût total E2E")
  await expect(createCard(page).getByText("cot_total_e2e")).toBeVisible()
})

test("exige une unité pour un champ numérique", async ({ page }) => {
  await fillName(page, "E2E Creation sans unite")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(
    page.getByText("L'unite est obligatoire pour un champ decimal ou entier.")
  ).toBeVisible()
  await expect(row(page, "E2E Creation sans unite")).toHaveCount(0)
})

test("exige au moins une option pour une liste", async ({ page }) => {
  await fillName(page, "E2E Creation liste vide")
  await pick(page, createCard(page), "Type de données", "Liste")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(page.getByText("Une liste doit contenir au moins une option.")).toBeVisible()
})

test("exige une règle de calcul pour un champ calculé", async ({ page }) => {
  await fillName(page, "E2E Creation calculee vide")
  await pick(page, createCard(page), "Nature", "Calculé")
  await pick(page, createCard(page), "Type de données", "Entier")
  await fillUnit(page, "$")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(
    page.getByText("La regle de calcul est obligatoire pour un champ calcule.")
  ).toBeVisible()
})

test("exige au moins un type de transaction applicable", async ({ page }) => {
  await fillName(page, "E2E Creation sans type")
  await fillUnit(page, "ha")
  await clickCreate(page)

  await expect(
    page.getByText("Au moins un type de transaction doit etre selectionne.")
  ).toBeVisible()
})

test("refuse un code machine déjà utilisé", async ({ page }) => {
  await fillName(page, "E2E Creation doublon")
  await fillUnit(page, "ha")
  await applyToTypes(page)
  await clickCreate(page)
  await expect(row(page, "E2E Creation doublon")).toBeVisible()

  await fillName(page, "E2E Creation doublon")
  await fillUnit(page, "ha")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(page.getByText("Un champ existe déjà avec ce code machine.")).toBeVisible()
})

test("refuse une règle référençant un champ inconnu", async ({ page }) => {
  await fillName(page, "E2E Creation regle inconnue")
  await pick(page, createCard(page), "Nature", "Calculé")
  await pick(page, createCard(page), "Type de données", "Entier")
  await fillUnit(page, "$")
  await fillRule(page, "champ_inconnu * 2")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(page.getByText("Champ inconnu: champ_inconnu")).toBeVisible()
})

test("refuse une règle syntaxiquement incomplète", async ({ page }) => {
  await fillName(page, "E2E Creation regle incomplete")
  await pick(page, createCard(page), "Nature", "Calculé")
  await pick(page, createCard(page), "Type de données", "Entier")
  await fillUnit(page, "$")
  await fillRule(page, "prix_vente superficie_totale_hectare")
  await applyToTypes(page)
  await clickCreate(page)

  await expect(page.getByText("Expression incomplete")).toBeVisible()
})

test("masque le switch Obligatoire pour un champ calculé", async ({ page }) => {
  const obligatory = createCard(page).getByText("Obligatoire", { exact: true })
  await expect(obligatory).toHaveCount(1)

  await pick(page, createCard(page), "Nature", "Calculé")
  await expect(obligatory).toHaveCount(0)
})

test("masque le switch Lecture seule pour un champ calculé", async ({ page }) => {
  const readOnly = createCard(page).getByText("Lecture seule", { exact: true })
  await expect(readOnly).toHaveCount(1)

  await pick(page, createCard(page), "Nature", "Calculé")
  await expect(readOnly).toHaveCount(0)
})

test("filtre la liste des champs via la recherche", async ({ page }) => {
  const search = page.getByPlaceholder("Rechercher un champ")
  await search.fill("Taux boisé de référence")
  await expect(page.locator("button").filter({ hasText: "Taux boisé de référence" })).toHaveCount(1)

  await search.fill("zzz")
  await expect(page.getByText("Aucun champ ne correspond à la recherche.")).toBeVisible()

  await search.fill("")
  await expect(page.locator("button").filter({ hasText: "Taux boisé de référence" })).toHaveCount(1)
})

test("édite le nom affiché d'un champ et confirme l'enregistrement", async ({ page }) => {
  await fillName(page, "E2E Creation editable")
  await fillUnit(page, "ha")
  await applyToTypes(page)
  await clickCreate(page)
  await row(page, "E2E Creation editable").click()

  await page
    .getByText("Nom affiché", { exact: true })
    .last()
    .locator("..")
    .getByRole("textbox")
    .fill("E2E Creation renommee")
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(page.getByRole("button", { name: "Enregistré ✓" })).toBeVisible()
  await expect(row(page, "E2E Creation renommee")).toBeVisible()
})

test("refuse une plage minimale supérieure à la plage maximale", async ({ page }) => {
  await page.locator("button").filter({ hasText: "Superficie (ha)" }).first().click()

  await page.getByText("Min", { exact: true }).locator("..").getByRole("spinbutton").fill("10")
  await page.getByText("Max", { exact: true }).locator("..").getByRole("spinbutton").fill("5")
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(
    page.getByText("La plage maximale doit etre superieure ou egale a la plage minimale.")
  ).toBeVisible()
})

test("désactive puis réactive un champ", async ({ page }) => {
  await fillName(page, "E2E Creation actif")
  await fillUnit(page, "ha")
  await applyToTypes(page)
  await clickCreate(page)
  await row(page, "E2E Creation actif").click()

  await page.getByRole("button", { name: "Désactiver" }).click()
  await expect(page.getByRole("button", { name: "Réactiver" })).toBeVisible()

  await page.getByRole("button", { name: "Réactiver" }).click()
  await expect(page.getByRole("button", { name: "Désactiver" })).toBeVisible()
})
