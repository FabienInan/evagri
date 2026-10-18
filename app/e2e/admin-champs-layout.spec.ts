import { expect, test, type Locator, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { restoreDefaultLayout } from "./db"

/**
 * Éditeur de disposition de la fiche (§6.5). Chaque test repart de la disposition par défaut — les champs
 * importés dans « Données de l'acte » et le champ saisissable obligatoire dans « Champs à enrichir » —
 * calculée par `getEffectiveFicheLayout` après l'effacement opéré par `restoreDefaultLayout`. Les autres
 * champs de test restent non assignés : c'est la réserve dans laquelle les tests viennent piocher pour
 * vérifier le glisser-déposer.
 */

let prisma: PrismaClient

function sectionInputs(page: Page): Locator {
  return page.getByRole("textbox", { name: "Nom de la section" })
}

function sectionCard(page: Page, nom: string): Locator {
  // L'attribut `value` reflète le nom au montage de l'input (création ou rechargement), ce qui suffit ici :
  // les cartes ciblées portent leur nom définitif dès leur apparition.
  return page.locator(`input[aria-label="Nom de la section"][value="${nom}"]`).locator("../..")
}

function unassignedBox(page: Page): Locator {
  return page.getByText(/^Champs non assignés \(\d+\)$/).locator("..")
}

async function unassignedCount(page: Page): Promise<number> {
  const text = await page.getByText(/^Champs non assignés \(\d+\)$/).textContent()
  const match = text?.match(/\((\d+)\)/)
  if (!match) throw new Error(`Compteur introuvable dans : ${text}`)
  return Number(match[1])
}

async function openLayout(page: Page): Promise<void> {
  await page.goto("/admin/champs")
  await page.getByRole("tab", { name: "Disposition de la fiche" }).click()
  await expect(page.getByText(/^Champs non assignés \(\d+\)$/)).toBeVisible()
}

async function addSection(page: Page, nom: string): Promise<void> {
  await page.getByPlaceholder("Nom de la nouvelle section (ex. : Superficies)").fill(nom)
  await page.getByRole("button", { name: "Ajouter une section" }).click()
  await expect(sectionInputs(page).last()).toHaveValue(nom)
}

/** L'overlay de dnd-kit reste monté jusqu'à la fin du `dragEnd` ; attendre sa disparition garantit que
 *  l'état du glisser-déposer est retombé avant l'interaction suivante (sinon un clic peut être avalé). */
const DRAG_OVERLAY = "div.shadow-lg.border-primary"

async function waitDragSettled(page: Page): Promise<void> {
  await expect(page.locator(DRAG_OVERLAY)).toHaveCount(0)
}

/**
 * Glisser-déposer au pointeur. dnd-kit utilise un PointerSensor avec une distance d'activation de 5 px :
 * il faut donc amorcer le mouvement, puis avancer par étapes jusqu'à la cible.
 */
async function dragWithMouse(page: Page, source: Locator, target: Locator): Promise<void> {
  await waitDragSettled(page)
  await source.scrollIntoViewIfNeeded()
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error("Source ou cible du glisser-déposer introuvable")

  const startX = from.x + from.width / 2
  const startY = from.y + from.height / 2
  const endX = to.x + to.width / 2
  const endY = to.y + to.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 8, startY + 8, { steps: 5 })
  await page.mouse.move(endX, endY, { steps: 25 })
  await page.mouse.move(endX, endY, { steps: 5 })
  await page.mouse.up()
  await waitDragSettled(page)
}

test.beforeAll(async () => {
  prisma = new PrismaClient()
})

test.afterAll(async () => {
  await restoreDefaultLayout(prisma)
  await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
  await restoreDefaultLayout(prisma)
  await openLayout(page)
})

test("affiche les sections de référence et le compteur des champs non assignés", async ({ page }) => {
  await expect(sectionInputs(page).first()).toHaveValue("Données de l'acte")
  await expect(sectionInputs(page).last()).toHaveValue("Champs à enrichir")
  await expect(page.getByText(/^Champs non assignés \(\d+\)$/)).toBeVisible()
  await expect(page.getByText("Déposez des champs ici")).toHaveCount(0)
})

test("regroupe dans les non assignés les champs saisissables hors disposition", async ({ page }) => {
  const unassigned = unassignedBox(page)
  await expect(unassigned.getByText("Superficie cultivée test", { exact: true })).toBeVisible()
  await expect(unassigned.getByText("Texte test", { exact: true })).toBeVisible()
  await expect(unassigned.getByText("E2E Filtre nombre", { exact: true })).toBeVisible()
})

test("crée une section via le bouton Ajouter une section", async ({ page }) => {
  await addSection(page, "Nouvelle zone")

  await expect(sectionInputs(page)).toHaveCount(3)
  await expect(sectionInputs(page).last()).toHaveValue("Nouvelle zone")
})

test("crée une section avec la touche Entrée", async ({ page }) => {
  const input = page.getByPlaceholder("Nom de la nouvelle section (ex. : Superficies)")
  await input.fill("Zone clavier")
  await input.press("Enter")

  await expect(sectionInputs(page)).toHaveCount(3)
  await expect(sectionInputs(page).last()).toHaveValue("Zone clavier")
})

test("ignore une section dont le nom est vide", async ({ page }) => {
  await page.getByPlaceholder("Nom de la nouvelle section (ex. : Superficies)").fill("   ")
  await page.getByRole("button", { name: "Ajouter une section" }).click()

  await expect(sectionInputs(page)).toHaveCount(2)
})

test("renomme une section et conserve le nom après rechargement", async ({ page }) => {
  await sectionInputs(page).first().fill("Données renommées")
  await page.getByRole("button", { name: "Enregistrer la disposition" }).click()
  await expect(page.getByRole("button", { name: "Enregistré ✓" })).toBeVisible()

  await page.reload()
  await page.getByRole("tab", { name: "Disposition de la fiche" }).click()

  await expect(sectionInputs(page).first()).toHaveValue("Données renommées")
})

test("supprime une section", async ({ page }) => {
  await addSection(page, "Zone à supprimer")
  await page.getByRole("button", { name: "Supprimer la section Zone à supprimer" }).click()

  await expect(sectionInputs(page)).toHaveCount(2)
  await expect(
    page.locator('input[aria-label="Nom de la section"][value="Zone à supprimer"]')
  ).toHaveCount(0)
})

test("renvoie les champs d'une section supprimée dans les non assignés", async ({ page }) => {
  await addSection(page, "Zone temporaire")
  const before = await unassignedCount(page)

  await dragWithMouse(
    page,
    unassignedBox(page).getByText("Texte test", { exact: true }),
    sectionCard(page, "Zone temporaire").getByText("Déposez des champs ici")
  )

  await expect(sectionCard(page, "Zone temporaire").getByText("Texte test", { exact: true })).toBeVisible()
  await expect(page.getByText(new RegExp(`^Champs non assignés \\(${before - 1}\\)$`))).toBeVisible()

  await page.getByRole("button", { name: "Supprimer la section Zone temporaire" }).click()

  await expect(page.getByText(new RegExp(`^Champs non assignés \\(${before}\\)$`))).toBeVisible()
  await expect(unassignedBox(page).getByText("Texte test", { exact: true })).toBeVisible()
})

test("affiche Enregistré ✓ après l'enregistrement de la disposition", async ({ page }) => {
  await page.getByRole("button", { name: "Enregistrer la disposition" }).click()
  await expect(page.getByRole("button", { name: "Enregistré ✓" })).toBeVisible()
})

test("déplace un champ dans une section et le conserve après rechargement", async ({ page }) => {
  await addSection(page, "Culture test")

  await dragWithMouse(
    page,
    unassignedBox(page).getByText("Superficie cultivée test", { exact: true }),
    sectionCard(page, "Culture test").getByText("Déposez des champs ici")
  )
  await expect(sectionCard(page, "Culture test").getByText("Superficie cultivée test", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Enregistrer la disposition" }).click()
  await expect(page.getByRole("button", { name: "Enregistré ✓" })).toBeVisible()

  await page.reload()
  await page.getByRole("tab", { name: "Disposition de la fiche" }).click()

  await expect(sectionCard(page, "Culture test").getByText("Superficie cultivée test", { exact: true })).toBeVisible()
})

test("réordonne deux sections par glisser-déposer et persiste l'ordre", async ({ page }) => {
  await addSection(page, "Zone déplacée")

  await dragWithMouse(
    page,
    page.getByRole("button", { name: "Déplacer la section Zone déplacée" }),
    page.getByRole("button", { name: "Déplacer la section Données de l'acte" })
  )

  await expect(sectionInputs(page).first()).toHaveValue("Zone déplacée")

  await page.getByRole("button", { name: "Enregistrer la disposition" }).click()
  await expect(page.getByRole("button", { name: "Enregistré ✓" })).toBeVisible()

  await page.reload()
  await page.getByRole("tab", { name: "Disposition de la fiche" }).click()

  await expect(sectionInputs(page).first()).toHaveValue("Zone déplacée")
})

test("conserve la section de référence quand une section vide est ajoutée", async ({ page }) => {
  await addSection(page, "Zone vide")

  await expect(sectionCard(page, "Zone vide").getByText("Déposez des champs ici")).toBeVisible()
  await expect(sectionCard(page, "Données de l'acte").getByText("N° d'inscription", { exact: true })).toBeVisible()
})
