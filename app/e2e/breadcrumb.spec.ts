import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { ORG_ID } from "./db"
import { fixtures } from "./fixtures"

/** Fil d'ariane Dossiers › dossier › panier, parcouru de bout en bout ; absent de la fiche de transaction. */

const fx = fixtures()
const DOSSIER_NUMERO = "99-99-020"
const PANIER_NOM = "Fil e2e"

let prisma: PrismaClient
let dossierId = ""
let panierId = ""

test.beforeAll(async () => {
  prisma = new PrismaClient()
  const dossier = await prisma.dossier.create({ data: { organisationId: ORG_ID, numeroDossier: DOSSIER_NUMERO, nom: "Fil e2e" } })
  dossierId = dossier.id
  panierId = (await prisma.panier.create({ data: { organisationId: ORG_ID, dossierId, nom: PANIER_NOM } })).id
  await prisma.panierTransaction.create({ data: { panierId, transactionId: fx.transactions.t1 } })
})

test.afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panierId } })
  await prisma.panier.deleteMany({ where: { dossierId } })
  await prisma.dossier.deleteMany({ where: { id: dossierId } })
  await prisma.$disconnect()
})

test("le fil d'ariane suit le parcours Dossiers › dossier › panier › transaction", async ({ page }) => {
  await page.goto(`/dossiers/${dossierId}`)
  const fil = page.getByRole("navigation", { name: "Fil d'ariane" })
  await expect(fil).toContainText(DOSSIER_NUMERO)

  await page.getByRole("link", { name: PANIER_NOM }).click()
  await expect(page.getByRole("navigation", { name: "Fil d'ariane" })).toContainText(PANIER_NOM)
  await page.getByRole("link", { name: DOSSIER_NUMERO }).click()
  await expect(page).toHaveURL(new RegExp(`/dossiers/${dossierId}$`))

  await page.getByRole("link", { name: PANIER_NOM }).click()
  await page.locator("tbody tr").first().getByTitle("Voir la transaction").click()
  // La fiche de transaction n'a pas de fil d'ariane : la navigation reste dans l'en-tête et les boutons précédent/suivant.
  await expect(page.getByRole("heading", { level: 1, name: "Fiche de transaction" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Fil d'ariane" })).toHaveCount(0)
})
