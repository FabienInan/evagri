import { expect, test as setup } from "@playwright/test"
import { resolve } from "node:path"

const authFile = resolve(process.cwd(), "e2e/.auth/user.json")

setup("authenticate", async ({ page }) => {
  const username = process.env.AUTH_USER
  const password = process.env.AUTH_PASSWORD
  if (!username || !password) {
    throw new Error("AUTH_USER / AUTH_PASSWORD introuvables (renseignez app/.env).")
  }

  await page.goto("/login")
  await page.getByLabel("Nom d'utilisateur").fill(username)
  await page.getByLabel("Mot de passe").fill(password)
  await page.getByRole("button", { name: "Se connecter" }).click()

  await page.waitForURL("**/transactions")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
