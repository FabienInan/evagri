import { expect, test } from "@playwright/test"

// Authentication is exactly what these tests exercise, so start every one logged out.
test.use({ storageState: { cookies: [], origins: [] } })

test("redirige vers /login quand la session est absente", async ({ page }) => {
  await page.goto("/transactions")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { level: 1, name: "Evagri" })).toBeVisible()
})

test("refuse des identifiants invalides", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Nom d'utilisateur").fill("utilisateur-invalide")
  await page.getByLabel("Mot de passe").fill("mot-de-passe-invalide")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page.getByText("Identifiants invalides")).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("connecte avec des identifiants valides et atteint la liste", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Nom d'utilisateur").fill(process.env.AUTH_USER ?? "")
  await page.getByLabel("Mot de passe").fill(process.env.AUTH_PASSWORD ?? "")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page).toHaveURL(/\/transactions/)
  await expect(page.getByRole("heading", { level: 1, name: "Liste des transactions" })).toBeVisible()
})

test("la déconnexion purge la session", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Nom d'utilisateur").fill(process.env.AUTH_USER ?? "")
  await page.getByLabel("Mot de passe").fill(process.env.AUTH_PASSWORD ?? "")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page).toHaveURL(/\/transactions/)

  await page.getByRole("button", { name: "Déconnexion" }).click()
  await expect(page).toHaveURL(/\/login/)
})
