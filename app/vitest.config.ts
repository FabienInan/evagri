import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    // Garde : refuse de lancer les tests sur une base distante (voir tests/setup/database-guard.ts).
    setupFiles: ["./tests/setup/load-database-guard.ts"],
    // Les specs Playwright (e2e/) ne sont pas des tests Vitest : `npm run test:e2e` les exécute.
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
