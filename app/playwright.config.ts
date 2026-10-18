import { defineConfig, devices } from "@playwright/test"
import { loadEnv } from "./e2e/env"

// The Playwright process does not read app/.env the way Next.js does; load it here so the webServer,
// the global setup and the specs all see DATABASE_URL, AUTH_USER/AUTH_PASSWORD, etc.
loadEnv()

// Next 16 allows a single `next dev` per project directory, so if a dev server is already up for this app
// the suite reuses it. 3001 is the app's usual dev port (3000 is taken by another project on this machine);
// override with E2E_PORT / E2E_BASE_URL.
const PORT = Number(process.env.E2E_PORT ?? 3001)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // One worker: every spec shares the same PostgreSQL database and the same seeded rows.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The dev server compiles each route on first hit, so give the first navigation room.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Logs in once and persists the session cookie; every spec below reuses it.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
