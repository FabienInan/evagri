import { expect, test } from "@playwright/test"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// A minimal one-page PDF: the import only needs the file name to match, but the content is a real PDF.
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

test("importe les actes depuis un dossier choisi dans l'explorateur, en ignorant les fichiers non PDF", async ({ page }) => {
  // The folder: two PDFs (one in a sub-folder), and a non-PDF file that must be ignored.
  const dossier = mkdtempSync(join(tmpdir(), "evagri-actes-"))
  mkdirSync(join(dossier, "sous-dossier"))
  writeFileSync(join(dossier, "123456789.pdf"), PDF)
  writeFileSync(join(dossier, "sous-dossier", "sans-numero.pdf"), PDF)
  writeFileSync(join(dossier, "note.txt"), "pas un acte")

  try {
    await page.goto("/admin/import")
    await expect(page.getByText("Importer des actes PDF")).toBeVisible()

    // Directory selection: the input accepts a folder, Playwright sends its content as the OS picker would.
    await page.getByLabel("Dossier des actes").setInputFiles(dossier)

    // 123456789 matches no transaction; "sans-numero" has no inscription number in its name.
    await expect(page.getByText("Associés : 0")).toBeVisible()
    await expect(page.getByText("Non associés : 2")).toBeVisible()
    await expect(page.getByText("123456789.pdf (aucune transaction pour 123456789)")).toBeVisible()
    await expect(page.getByText("sans-numero.pdf (impossible d'extraire le numéro d'inscription)")).toBeVisible()
    // The text file is not an act: it is never sent, so it is not reported either.
    await expect(page.getByText("note.txt")).toHaveCount(0)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test("refuse un dossier sans aucun PDF", async ({ page }) => {
  const dossier = mkdtempSync(join(tmpdir(), "evagri-actes-vide-"))
  writeFileSync(join(dossier, "note.txt"), "pas un acte")
  try {
    await page.goto("/admin/import")
    await page.getByLabel("Dossier des actes").setInputFiles(dossier)
    await expect(page.getByText("Aucun fichier PDF dans le dossier choisi.")).toBeVisible()
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
