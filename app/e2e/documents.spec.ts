import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

// A minimal but structurally valid one-page PDF, so the upload stores a real document rather than junk.
const PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "trailer<</Root 1 0 R/Size 4>>",
    "%%EOF",
  ].join("\n")
)

test("refuse un fichier dont le type n'est pas PDF", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t5}`)
  await page.locator('input[type="file"]').setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("pas un pdf"),
  })

  await expect(page.getByText("Seuls les fichiers PDF sont acceptés.")).toBeVisible()
  // Rien n'a été ajouté.
  await expect(page.getByText("Aucun document.")).toBeVisible()
})

test("refuse un fichier PDF vide", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t5}`)
  await page.locator('input[type="file"]').setInputFiles({
    name: "vide.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(0),
  })

  await expect(page.getByText("Aucun fichier sélectionné.")).toBeVisible()
  await expect(page.getByText("Aucun document.")).toBeVisible()
})

test("téléverse un PDF puis le supprime", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t5}`)
  await expect(page.getByText("Aucun document.")).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles({
    name: "acte-e2e.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  })
  await expect(page.getByText("acte-e2e.pdf")).toBeVisible()
  await expect(page.getByText("Aucun document.")).toHaveCount(0)

  await page.getByRole("button", { name: "Supprimer" }).click()
  await expect(page.getByText("Aucun document.")).toBeVisible()
  await expect(page.getByText("acte-e2e.pdf")).toHaveCount(0)
})

test("masque les contrôles de documents sur une fiche analysée", async ({ page }) => {
  await page.goto(`/transactions/${fx.transactions.t1}`)
  await expect(page.getByText("Aucun document.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Ajouter un PDF" })).toHaveCount(0)
  await expect(page.locator('input[type="file"]')).toHaveCount(0)
})
