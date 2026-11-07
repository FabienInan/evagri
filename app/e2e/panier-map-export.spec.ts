import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"
import { fixtures } from "./fixtures"

/**
 * Export de la carte d'un panier : la carte doit être recadrée sur les points courants, même après qu'une
 * transaction éloignée a été retirée (sans recadrage, elle restait au zoom d'origine, trop large).
 */

const fx = fixtures()
const DOSSIER_NUMERO = "25-ZZ-013"

test("l'export recadre la carte après le retrait d'une transaction éloignée", async ({ page }) => {
  const prisma = new PrismaClient()
  const dossier = await prisma.dossier.create({
    data: { organisationId: ORG_ID, numeroDossier: DOSSIER_NUMERO, nom: "Carte e2e" },
  })
  const panier = await prisma.panier.create({
    data: { organisationId: ORG_ID, dossierId: dossier.id, nom: "Carte e2e" },
  })
  try {
    // t4 (46.22, -72.61) élargit les bornes au montage ; t1 et t2 sont dans le même secteur.
    await prisma.panierTransaction.createMany({
      data: [fx.transactions.t1, fx.transactions.t2, fx.transactions.t4].map((transactionId) => ({
        panierId: panier.id,
        transactionId,
      })),
    })

    await page.goto(`/paniers/${panier.id}`)
    await expect(page.getByRole("columnheader", { name: "Prix à l'acte" })).toBeVisible()
    await page.locator("tbody tr").filter({ hasText: fx.numeros.t4 }).getByTitle("Retirer du panier").click()
    await expect(page.locator("tbody tr").filter({ hasText: fx.numeros.t4 })).toHaveCount(0)

    await page.getByRole("button", { name: "Exporter la carte" }).click()
    // Les tuiles de la carte d'export portent leur niveau de zoom dans l'URL : toutes doivent être au zoom
    // des points restants (12 = bornes serrées, maxZoom), et non au zoom du montage initial (10).
    await expect
      .poll(async () =>
        page.locator("img.leaflet-tile").evaluateAll((imgs) =>
          [...new Set(imgs.map((i) => (i as HTMLImageElement).src.match(/\/(\d+)\/\d+\/\d+\.png/)?.[1]))]
        )
      )
      .toEqual(["12"])
  } finally {
    await prisma.panierTransaction.deleteMany({ where: { panierId: panier.id } })
    await prisma.panier.deleteMany({ where: { dossierId: dossier.id } })
    await prisma.dossier.deleteMany({ where: { id: dossier.id } })
    await prisma.$disconnect()
  }
})
