import { expect, test } from "@playwright/test"
import { fixtures } from "./fixtures"

const fx = fixtures()

test("affiche la carte des transactions avec des marqueurs", async ({ page }) => {
  await page.goto("/transactions/map")
  await expect(page.getByRole("heading", { level: 1, name: "Carte des transactions" })).toBeVisible()
  await expect(page.locator(".leaflet-container")).toBeVisible()
  // Les 3 transactions groupées forment un cluster ; la 4e est un marqueur isolé.
  await expect(page.locator("img.leaflet-marker-icon, .marker-cluster-custom").first()).toBeVisible({
    timeout: 20_000,
  })
})

test("dessine un polygone et ajoute la sélection au panier", async ({ page }) => {
  await page.goto("/transactions/map")
  const map = page.locator(".leaflet-container")
  await map.waitFor()
  const marker = page.locator("img.leaflet-marker-icon, .marker-cluster-custom").first()
  await marker.waitFor({ timeout: 20_000 })

  // The default view (centre [52,-72], zoom 6) leaves the Drummondville-area pins below the fold, so a
  // polygon drawn on what's visible would contain nothing. Zoom out until the marker sits inside the
  // map viewport, then draw around it.
  const box = await map.boundingBox()
  if (!box) throw new Error("contour de la carte introuvable")
  for (let i = 0; i < 6; i++) {
    const b = await marker.boundingBox()
    if (b && b.y > box.y + 40 && b.y + b.height < box.y + box.height - 40) break
    await page.locator(".leaflet-control-zoom-out").click()
    await page.waitForTimeout(300)
  }

  await page.locator(".leaflet-draw-draw-polygon").click()
  // Attendre l'apparition de la barre d'actions de leaflet-draw (déterministe, sans temporisation).
  await expect(page.getByRole("link", { name: "Finish" })).toBeVisible()

  const mb = await marker.boundingBox()
  if (!mb) throw new Error("marqueur introuvable")
  const cx = mb.x + mb.width / 2
  const cy = mb.y + mb.height / 2
  // Quadrilatère centré sur le marqueur ; on attend entre chaque clic pour que leaflet-draw enregistre
  // chaque sommet avant le suivant.
  const corners = [
    { x: cx - 100, y: cy - 100 },
    { x: cx + 100, y: cy - 100 },
    { x: cx + 100, y: cy + 100 },
    { x: cx - 100, y: cy + 100 },
  ]
  for (const c of corners) {
    await page.mouse.click(c.x, c.y)
    await page.waitForTimeout(200)
  }
  await page.getByRole("link", { name: "Finish" }).click()

  await expect(page.getByText(/transactions? sélectionnées?/)).toBeVisible({ timeout: 10_000 })
  await page.getByRole("button", { name: "Ajouter au panier" }).click()
  await expect(page.getByRole("heading", { name: "Ajouter au panier" })).toBeVisible()

  await page.getByLabel("Dossier").selectOption({ label: `${fx.dossierNumero} — Dossier e2e` })
  await expect(page.getByLabel("Panier").locator("option", { hasText: "Cible e2e" })).toHaveCount(1)
})
