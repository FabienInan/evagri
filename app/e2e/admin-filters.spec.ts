import { expect, test, type Locator, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"
import { FILTER_TEST_CODES } from "./test-champs"

/**
 * Configuration des filtres (§6.6). Chaque test repart des deux filtres semés par `prisma/seed.ts`
 * (« Type de transaction » et le filtre virtuel « Statut d'analyse »). Les filtres créés par les tests
 * ciblent les champs `e2e_filtre_*` : le teardown les reconnaît à leur champ et à leur préfixe.
 */

const FILTER_TYPE_TX_ID = "00000000-0000-0000-0000-000000000001"
const FILTER_STATUT_ID = "00000000-0000-0000-0000-000000000002"

let prisma: PrismaClient

async function resetFilters(): Promise<void> {
  const champs = await prisma.champ.findMany({
    where: { organisationId: ORG_ID, codeMachine: { in: FILTER_TEST_CODES } },
    select: { id: true },
  })
  await prisma.filtreRecherche.deleteMany({
    where: {
      organisationId: ORG_ID,
      OR: [
        { champId: { in: champs.map((c) => c.id) } },
        { nomFiltre: { startsWith: "E2E " } },
        { codeMachine: { startsWith: "e2e_" } },
      ],
    },
  })
  await prisma.filtreRecherche.updateMany({
    where: { organisationId: ORG_ID, id: FILTER_TYPE_TX_ID },
    data: { typeFiltre: "LISTE", estActif: true, ordreAffichage: 0 },
  })
  await prisma.filtreRecherche.updateMany({
    where: { organisationId: ORG_ID, id: FILTER_STATUT_ID },
    data: { typeFiltre: "LISTE", estActif: true, ordreAffichage: 1 },
  })
}

function rows(page: Page): Locator {
  return page.locator("[data-row-id]")
}

function row(page: Page, nom: string): Locator {
  return rows(page).filter({ hasText: nom })
}

function createForm(page: Page): Locator {
  return page.locator("form")
}

function targetSelect(page: Page): Locator {
  return createForm(page).getByRole("combobox").first()
}

function createTypeSelect(page: Page): Locator {
  return createForm(page).getByRole("combobox").nth(1)
}

function detailTypeSelect(page: Page): Locator {
  return page.getByRole("combobox").last()
}

async function selectTarget(page: Page, nom: string): Promise<void> {
  await targetSelect(page).click()
  await page.getByRole("option", { name: nom, exact: true }).click()
}

async function addFilterFor(page: Page, nom: string): Promise<void> {
  await selectTarget(page, nom)
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await expect(row(page, nom)).toBeVisible()
}

async function openFilters(page: Page): Promise<void> {
  await page.goto("/admin/filters")
  await expect(page.getByRole("heading", { level: 1, name: "Configuration des filtres" })).toBeVisible()
}

test.beforeAll(async () => {
  prisma = new PrismaClient()
})

test.afterAll(async () => {
  await resetFilters()
  await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
  await resetFilters()
  await openFilters(page)
})

test("affiche les filtres semés et leur type", async ({ page }) => {
  await expect(rows(page)).toHaveCount(2)
  await expect(row(page, "Type de transaction")).toContainText("Type : Liste")
  await expect(row(page, "Statut d'analyse")).toContainText("Type : Liste")
})

test("présente le filtre Statut d'analyse comme virtuel", async ({ page }) => {
  await expect(row(page, "Statut d'analyse")).toContainText("Virtuel (statut)")

  await row(page, "Statut d'analyse").getByText("Statut d'analyse").click()
  await expect(page.getByText("Code virtuel", { exact: true })).toBeVisible()
  await expect(page.getByText("statut", { exact: true })).toBeVisible()
})

test("désactive l'ajout d'un champ déjà filtré", async ({ page }) => {
  await selectTarget(page, "Type de transaction")

  const add = page.getByRole("button", { name: "Déjà ajouté" })
  await expect(add).toBeVisible()
  await expect(add).toBeDisabled()
})

test("désactive l'ajout du filtre virtuel déjà présent", async ({ page }) => {
  await selectTarget(page, "Statut d'analyse")

  const add = page.getByRole("button", { name: "Déjà ajouté" })
  await expect(add).toBeVisible()
  await expect(add).toBeDisabled()
})

test("recommande une recherche texte pour un champ texte", async ({ page }) => {
  await selectTarget(page, "E2E Filtre texte")
  await expect(createTypeSelect(page)).toContainText("Recherche texte")
})

test("recommande une plage de valeurs pour un champ numérique", async ({ page }) => {
  await selectTarget(page, "E2E Filtre nombre")
  await expect(createTypeSelect(page)).toContainText("Plage de valeurs")
})

test("ajoute un filtre texte avec le type recommandé", async ({ page }) => {
  await addFilterFor(page, "E2E Filtre texte")

  await expect(row(page, "E2E Filtre texte")).toContainText("Type : Recherche texte")
})

test("ajoute un filtre numérique avec le type recommandé", async ({ page }) => {
  await addFilterFor(page, "E2E Filtre nombre")

  await expect(row(page, "E2E Filtre nombre")).toContainText("Type : Plage de valeurs")
})

test("supprime un filtre ajouté", async ({ page }) => {
  await addFilterFor(page, "E2E Filtre texte")

  await row(page, "E2E Filtre texte").getByText("E2E Filtre texte").click()
  await page.getByRole("button", { name: "Supprimer" }).click()
  await expect(row(page, "E2E Filtre texte")).toHaveCount(0)
})

test("filtre la liste des filtres via la recherche", async ({ page }) => {
  const search = page.getByPlaceholder("Rechercher un filtre")

  await search.fill("Statut")
  await expect(row(page, "Statut d'analyse")).toBeVisible()
  await expect(row(page, "Type de transaction")).toHaveCount(0)

  await search.fill("zzz")
  await expect(page.getByText("Aucun filtre ne correspond à la recherche.")).toBeVisible()

  await search.fill("")
  await expect(rows(page)).toHaveCount(2)
})

test("change le type d'un filtre et le conserve après publication", async ({ page }) => {
  await detailTypeSelect(page).click()
  await page.getByRole("option", { name: "Recherche texte", exact: true }).click()
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Publier la configuration" }).click()
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible()

  await page.reload()
  await expect(detailTypeSelect(page)).toContainText("Recherche texte")
})

test("propose le type recommandé et l'applique", async ({ page }) => {
  await detailTypeSelect(page).click()
  await page.getByRole("option", { name: "Recherche texte", exact: true }).click()

  const recommended = page.getByText("Type recommandé").locator("..")
  await expect(recommended).toBeVisible()
  await expect(recommended.getByText("Type de transaction", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Appliquer" }).click()
  await expect(detailTypeSelect(page)).toContainText("Type de transaction")
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible()
})

test("masque dans la liste des transactions un filtre désactivé", async ({ page }) => {
  await row(page, "Statut d'analyse").getByText("Statut d'analyse").click()

  const toggle = page.getByRole("switch")
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()

  await page.getByRole("button", { name: "Publier la configuration" }).click()
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible()

  await page.goto("/transactions")
  await expect(page.getByText("Type de transaction", { exact: true })).toBeVisible()
  await expect(page.getByText("Statut d'analyse", { exact: true })).toHaveCount(0)

  // Repose l'état pour les specs suivantes (la liste des transactions attend ce filtre).
  await openFilters(page)
  await row(page, "Statut d'analyse").getByText("Statut d'analyse").click()
  await page.getByRole("switch").click()
  await page.getByRole("button", { name: "Publier la configuration" }).click()
  await expect(page.getByRole("switch")).toBeChecked()
})

test("conserve un filtre désactivé après rechargement", async ({ page }) => {
  await row(page, "Statut d'analyse").getByText("Statut d'analyse").click()
  await page.getByRole("switch").click()
  await page.getByRole("button", { name: "Publier la configuration" }).click()

  await page.reload()
  await row(page, "Statut d'analyse").getByText("Statut d'analyse").click()

  await expect(page.getByRole("switch")).not.toBeChecked()
})

test("réordonne les filtres et publie l'ordre", async ({ page }) => {
  const handle = row(page, "Type de transaction").getByRole("button", { name: "Réordonner" })
  await expect(handle).toHaveAttribute("title", "Glisser pour réordonner")

  await handle.dragTo(row(page, "Statut d'analyse"))
  await expect(rows(page).first()).toContainText("Statut d'analyse")

  await page.getByRole("button", { name: "Publier la configuration" }).click()
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible()

  await page.reload()
  await expect(rows(page).first()).toContainText("Statut d'analyse")
})

test("désactive le réordonnancement pendant une recherche", async ({ page }) => {
  await page.getByPlaceholder("Rechercher un filtre").fill("Statut")

  const handle = row(page, "Statut d'analyse").getByRole("button", { name: "Réordonner" })
  await expect(handle).toHaveAttribute("title", "Réordonnancement indisponible pendant une recherche")
  await expect(handle).toHaveAttribute("draggable", "false")
})
