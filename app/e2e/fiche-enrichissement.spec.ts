import { expect, test, type Locator, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { fixtures } from "./fixtures"
import { restoreBaseLayout } from "./db"
import { resetTestValues, setEnrichLayout } from "./support"

/**
 * Extrémité « fiche » de l'enrichissement (§6.5/§7.8.3) : les champs créés dans l'admin et placés dans la
 * disposition doivent apparaître sur la fiche et déclencher les règles bloquantes. La disposition de test
 * (support.setEnrichLayout) place les champs semés dans trois sections ; elle est reposée à l'identique
 * avant la suite et la disposition de référence est restaurée après, pour ne pas perturber les autres specs.
 */

const fx = fixtures()

let prisma: PrismaClient

function ficheSection(page: Page, titre: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(titre, { exact: true }) })
}

function fieldCell(section: Locator, label: string): Locator {
  return section.getByText(label, { exact: true }).locator("..")
}

async function open(page: Page, transactionId: string): Promise<void> {
  await page.goto(`/transactions/${transactionId}`)
  await expect(page.getByRole("heading", { level: 1, name: "Fiche de transaction" })).toBeVisible()
}

async function fillNumber(section: Locator, label: string, value: number): Promise<void> {
  await fieldCell(section, label).getByRole("spinbutton").fill(String(value))
}

/** Renseigne le champ obligatoire placé dans « Contrôles test » pour isoler la règle testée. */
async function fillObligatoire(page: Page): Promise<void> {
  await fieldCell(ficheSection(page, "Contrôles test"), "Champ obligatoire test *")
    .getByRole("textbox")
    .fill("Renseigné")
}

/** Clique Enregistrer et attend l'aller-retour de la server action avant de rendre la main. */
async function saveAndWait(page: Page): Promise<void> {
  const response = page.waitForResponse((r) => r.request().method() === "POST" && r.ok())
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await response
  await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeEnabled()
}

test.beforeAll(async () => {
  prisma = new PrismaClient()
  await setEnrichLayout(prisma)
})

test.afterAll(async () => {
  await resetTestValues(prisma, fx.transactions.t7)
  await restoreBaseLayout(prisma)
  await prisma.$disconnect()
})

test.beforeEach(async () => {
  await resetTestValues(prisma, fx.transactions.t7)
})

test("affiche les champs placés dans leurs sections", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await expect(ficheSection(page, "Données de l'acte test")).toBeVisible()
  await expect(ficheSection(page, "Superficies test")).toBeVisible()
  await expect(ficheSection(page, "Contrôles test")).toBeVisible()

  await expect(
    fieldCell(ficheSection(page, "Superficies test"), "Superficie cultivée test (ha)")
  ).toBeVisible()
  await expect(fieldCell(ficheSection(page, "Contrôles test"), "Texte test")).toBeVisible()
})

test("affiche l'unité et le marqueur obligatoire dans le libellé", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await expect(
    fieldCell(ficheSection(page, "Contrôles test"), "Champ obligatoire test *")
  ).toBeVisible()
  await expect(
    fieldCell(ficheSection(page, "Superficies test"), "Superficie cultivée test (ha)")
  ).toBeVisible()
})

test("affiche la valeur calculée dans le panneau Indicateurs", async ({ page }) => {
  await open(page, fx.transactions.t7)

  const indicateurs = ficheSection(page, "Indicateurs")
  const row = indicateurs.locator("dt").filter({ hasText: "Indicateur test" }).locator("..")

  await expect(row.locator("dd")).toHaveText(/^10[\s\u00a0]?000$/)
})

test("ne rend pas les champs calculés dans les sections", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await expect(page.getByText(/Indicateur test/)).toHaveCount(1)
  await expect(ficheSection(page, "Superficies test").getByText(/Indicateur test/)).toHaveCount(0)
})

test("rend un contrôle adapté à chaque type de données", async ({ page }) => {
  await open(page, fx.transactions.t7)
  const controles = ficheSection(page, "Contrôles test")

  await expect(fieldCell(controles, "Booléen test").getByRole("switch")).toBeVisible()
  await expect(
    fieldCell(controles, "Date test").locator('input[type="date"]')
  ).toBeVisible()
  await expect(fieldCell(controles, "Liste test").getByRole("combobox")).toBeVisible()
  await expect(
    fieldCell(controles, "Multi test").locator('[aria-haspopup="listbox"]')
  ).toBeVisible()
  await expect(fieldCell(controles, "Texte test").getByRole("textbox")).toBeVisible()
  await expect(
    fieldCell(ficheSection(page, "Superficies test"), "Décimal test (ha)").locator(
      'input[type="number"]'
    )
  ).toBeVisible()
})

test("affiche les valeurs formatées en consultation", async ({ page }) => {
  await open(page, fx.transactions.t9)
  const controles = ficheSection(page, "Contrôles test")
  const superficies = ficheSection(page, "Superficies test")

  await expect(fieldCell(controles, "Texte test").getByText("Bonjour E2E")).toBeVisible()
  await expect(fieldCell(controles, "Booléen test").getByText("Oui", { exact: true })).toBeVisible()
  await expect(fieldCell(controles, "Date test").getByText("2024-05-06")).toBeVisible()
  await expect(fieldCell(controles, "Liste test").getByText("Alpha", { exact: true })).toBeVisible()
  await expect(fieldCell(controles, "Multi test").getByText("X, Y", { exact: true })).toBeVisible()
  await expect(
    fieldCell(superficies, "Décimal test (ha)").getByText(/^1[\s\u00a0]?234,5$/)
  ).toBeVisible()
})

test("bloque Enregistrer quand un champ obligatoire est vide", async ({ page }) => {
  await open(page, fx.transactions.t7)
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  await expect(
    page.getByText("Le champ « Champ obligatoire test » est obligatoire.")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeEnabled()
})

test("efface l'erreur obligatoire dès la saisie", async ({ page }) => {
  await open(page, fx.transactions.t7)
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()

  const message = page.getByText("Le champ « Champ obligatoire test » est obligatoire.")
  await expect(message).toBeVisible()

  await fillObligatoire(page)
  await expect(message).toHaveCount(0)
})

test("déclenche V-001 quand la somme des superficies dépasse la superficie totale", async ({
  page,
}) => {
  await open(page, fx.transactions.t7)
  const superficies = ficheSection(page, "Superficies test")

  await fillNumber(superficies, "Superficie cultivée test (ha)", 6)
  await fillNumber(superficies, "Superficie boisée test (ha)", 3)
  await fillNumber(superficies, "Superficie constructible test (ha)", 2)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText(
      "La somme des superficies (cultivée, boisée, constructible) dépasse la superficie totale."
    )
  ).toBeVisible()
})

test("accepte V-001 à la limite exacte de la superficie totale", async ({ page }) => {
  await open(page, fx.transactions.t7)
  const superficies = ficheSection(page, "Superficies test")

  await fillNumber(superficies, "Superficie cultivée test (ha)", 5)
  await fillNumber(superficies, "Superficie boisée test (ha)", 3)
  await fillNumber(superficies, "Superficie constructible test (ha)", 2)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText(
      "La somme des superficies (cultivée, boisée, constructible) dépasse la superficie totale."
    )
  ).toHaveCount(0)
})

test("déclenche V-002 quand la superficie drainée dépasse la cultivée", async ({ page }) => {
  await open(page, fx.transactions.t7)
  const superficies = ficheSection(page, "Superficies test")

  await fillNumber(superficies, "Superficie cultivée test (ha)", 5)
  await fillNumber(superficies, "Superficie drainée test (ha)", 7)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText("La superficie drainée ne peut pas dépasser la superficie cultivée.")
  ).toBeVisible()
})

test("déclenche V-003 quand un pourcentage dépasse 100", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await fillNumber(ficheSection(page, "Superficies test"), "Taux zone humide test (%)", 120)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText("Le champ « Taux zone humide test » ne peut pas dépasser 100 %.")
  ).toBeVisible()
})

test("déclenche V-005 quand la superficie acéricole dépasse la boisée", async ({ page }) => {
  await open(page, fx.transactions.t7)
  const superficies = ficheSection(page, "Superficies test")

  await fillNumber(superficies, "Superficie boisée test (ha)", 4)
  await fillNumber(superficies, "Superficie acéricole test (ha)", 5)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText("La superficie acéricole ne peut pas dépasser la superficie boisée.")
  ).toBeVisible()
})

test("déclenche V-006 sur une valeur négative", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await fillNumber(ficheSection(page, "Superficies test"), "Champ négatif test (ha)", -5)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText("Le champ « Champ négatif test » ne peut pas être négatif.")
  ).toBeVisible()
})

test("déclenche V-007 quand la valeur sort de la plage", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await fillNumber(ficheSection(page, "Superficies test"), "Champ plage test (kg)", 15)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText("Le champ « Champ plage test » doit être compris entre 0 et 10.")
  ).toBeVisible()
})

test("accepte la borne maximale de la plage", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await fillNumber(ficheSection(page, "Superficies test"), "Champ plage test (kg)", 10)
  await fillObligatoire(page)

  await saveAndWait(page)

  await expect(
    page.getByText("Le champ « Champ plage test » doit être compris entre 0 et 10.")
  ).toHaveCount(0)
})

test("bloque Analyser quand une règle bloquante échoue", async ({ page }) => {
  await open(page, fx.transactions.t7)

  await page.getByRole("button", { name: "Analyser", exact: true }).click()
  await page.getByRole("button", { name: "Confirmer l'analyse" }).click()

  await expect(
    page.getByText("Le champ « Champ obligatoire test » est obligatoire.")
  ).toBeVisible()
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()
  await expect(page.getByText("Analysée", { exact: true })).toHaveCount(0)
})
