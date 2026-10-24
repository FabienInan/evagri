import { expect, test, type Locator, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { E2E_SOURCE, ORG_ID, restoreDefaultLayout } from "./db"
import { setEnrichLayout } from "./support"

/**
 * Avertissement W-001 (§7.8.3) : écart supérieur à 10 % entre la superficie totale et la somme des
 * composantes (cultivée + boisée + constructible). Non bloquant : l'évaluateur corrige ou force la
 * sauvegarde. Une transaction dédiée est semée pour que les autres specs ne voient aucun changement.
 * La superficie totale vaut 10 ha : 3 + 3 = 6 ha, écart de 40 % → avertissement.
 */

const NUMERO = "E2E-AV-001"

let prisma: PrismaClient
let transactionId = ""

function ficheSection(page: Page, titre: string): Locator {
  return page.locator('[data-slot="card"]').filter({ has: page.getByText(titre, { exact: true }) })
}

function superficieCultivee(page: Page): Locator {
  return ficheSection(page, "Superficies test")
    .getByText("Superficie cultivée test (ha)", { exact: true })
    .locator("..")
    .getByRole("spinbutton")
}

function superficieBoisee(page: Page): Locator {
  return ficheSection(page, "Superficies test")
    .getByText("Superficie boisée test (ha)", { exact: true })
    .locator("..")
    .getByRole("spinbutton")
}

async function open(page: Page): Promise<void> {
  await page.goto(`/transactions/${transactionId}`)
  await expect(page.getByRole("heading", { level: 1, name: "Fiche de transaction" })).toBeVisible()
}

const avertissement = (page: Page) =>
  page.getByRole("heading", { name: "Avertissement avant enregistrement" })

async function enregistrer(page: Page): Promise<void> {
  const response = page.waitForResponse((r) => r.request().method() === "POST" && r.ok())
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await response
  await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeEnabled()
}

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  prisma = new PrismaClient()
  await setEnrichLayout(prisma)

  const champs = await prisma.champ.findMany({
    where: {
      organisationId: ORG_ID,
      codeMachine: {
        in: ["date_vente", "prix_vente", "superficie_totale_hectare", "mrc", "municipalite", "typeTransaction", "e2e_champ_obligatoire"],
      },
    },
    select: { id: true, codeMachine: true, typeDonnees: true },
  })
  const valeurs: Record<string, string | number> = {
    date_vente: "2024-04-01",
    prix_vente: 120000,
    superficie_totale_hectare: 10,
    mrc: "Drummond",
    municipalite: "Drummondville",
    typeTransaction: "TERRES_CULTIVEES",
    e2e_champ_obligatoire: "Renseigné",
  }

  const tx = await prisma.transaction.create({
    data: { organisationId: ORG_ID, systemeSource: E2E_SOURCE, statut: "NON_ANALYSEE" },
  })
  transactionId = tx.id

  const rows = [
    { transactionId, champId: champs.find((c) => c.codeMachine === "numero_inscription")?.id ?? null, texte: NUMERO },
    ...Object.entries(valeurs).map(([code, value]) => ({
      transactionId,
      champId: champs.find((c) => c.codeMachine === code)?.id ?? null,
      value,
      typeDonnees: champs.find((c) => c.codeMachine === code)?.typeDonnees ?? "TEXTE",
    })),
  ]
  await prisma.valeurChamp.createMany({
    data: rows
      .filter((r) => r.champId)
      .map((r) => {
        const base = { transactionId: r.transactionId, champId: r.champId as string }
        if ("texte" in r) return { ...base, valeurTexte: r.texte }
        if (r.typeDonnees === "DECIMAL" || r.typeDonnees === "ENTIER")
          return { ...base, valeurNombre: String(r.value) }
        if (r.typeDonnees === "DATE") return { ...base, valeurDate: new Date(String(r.value)) }
        return { ...base, valeurTexte: String(r.value) }
      }),
  })
})

test.afterAll(async () => {
  await prisma.valeurChamp.deleteMany({ where: { transactionId } })
  await prisma.transaction.deleteMany({ where: { id: transactionId } })
  await restoreDefaultLayout(prisma)
  await prisma.$disconnect()
})

test("avertit sur un écart de plus de 10 %, et Corriger ne sauvegarde rien", async ({ page }) => {
  await open(page)
  await superficieCultivee(page).fill("3")
  await superficieBoisee(page).fill("3")

  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(avertissement(page)).toBeVisible()
  await expect(page.getByText("s'écarte de plus de 10 % de la somme des composantes")).toBeVisible()

  await page.getByRole("button", { name: "Corriger", exact: true }).click()
  await expect(avertissement(page)).toHaveCount(0)

  // Les valeurs saisies restent à l'écran, mais rien n'a été persisté.
  await expect(superficieCultivee(page)).toHaveValue("3")
  await page.reload()
  await expect(superficieCultivee(page)).toHaveValue("")
})

test("forcer la sauvegarde persiste les valeurs malgré l'avertissement", async ({ page }) => {
  await open(page)
  await superficieCultivee(page).fill("3")
  await superficieBoisee(page).fill("3")

  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(avertissement(page)).toBeVisible()
  const response = page.waitForResponse((r) => r.request().method() === "POST" && r.ok())
  await page.getByRole("button", { name: "Forcer la sauvegarde", exact: true }).click()
  await response

  await page.reload()
  await expect(superficieCultivee(page)).toHaveValue("3")
  await expect(superficieBoisee(page)).toHaveValue("3")
})

test("un écart exactement égal à 10 % ne déclenche aucun avertissement", async ({ page }) => {
  await open(page)
  // Total 10 ha, somme 9 ha : écart de 1 ha soit exactement 10 %, la limite n'est pas dépassée.
  await superficieCultivee(page).fill("5")
  await superficieBoisee(page).fill("4")

  await enregistrer(page)
  await expect(avertissement(page)).toHaveCount(0)
  await page.reload()
  await expect(superficieCultivee(page)).toHaveValue("5")
})

test("une règle bloquante empêche la sauvegarde sans afficher l'avertissement", async ({ page }) => {
  await open(page)
  // 8 + 8 = 16 ha > 10 ha : V-001 bloque, et l'avertissement ne doit pas s'ajouter à l'erreur.
  await superficieCultivee(page).fill("8")
  await superficieBoisee(page).fill("8")

  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(page.getByText("La somme des superficies (cultivée, boisée, constructible) dépasse la superficie totale.")).toBeVisible()
  await expect(avertissement(page)).toHaveCount(0)
})

test("aucune composante renseignée : aucun avertissement", async ({ page }) => {
  await open(page)
  await superficieCultivee(page).fill("")
  await superficieBoisee(page).fill("")

  await enregistrer(page)
  await expect(avertissement(page)).toHaveCount(0)
})

test("Analyser : l'avertissement est proposé, puis Forcer et analyser passe la transaction à analysée", async ({ page }) => {
  await open(page)
  await superficieCultivee(page).fill("3")
  await superficieBoisee(page).fill("3")

  await page.getByRole("button", { name: "Analyser", exact: true }).click()
  await page.getByRole("button", { name: "Confirmer l'analyse" }).click()
  await expect(avertissement(page)).toBeVisible()
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Forcer et analyser", exact: true }).click()
  await expect(page.getByText("Analysée", { exact: true })).toBeVisible()
})

test("Analyser puis Corriger après réouverture : la transaction reste non analysée", async ({ page }) => {
  await open(page)
  await page.getByRole("button", { name: "Rouvrir", exact: true }).click()
  await page.getByRole("button", { name: "Confirmer la réouverture" }).click()
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  await superficieCultivee(page).fill("3")
  await superficieBoisee(page).fill("3")
  await page.getByRole("button", { name: "Analyser", exact: true }).click()
  await page.getByRole("button", { name: "Confirmer l'analyse" }).click()
  await expect(avertissement(page)).toBeVisible()

  await page.getByRole("button", { name: "Corriger", exact: true }).click()
  await expect(avertissement(page)).toHaveCount(0)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()
})

test("après réouverture, Enregistrer avertit à nouveau sur un écart de plus de 10 %", async ({ page }) => {
  await open(page)
  await expect(page.getByText("Non analysée", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(avertissement(page)).toBeVisible()
  await page.getByRole("button", { name: "Corriger", exact: true }).click()
  await expect(avertissement(page)).toHaveCount(0)
})
