import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Minimal `.env` loader for the Playwright process. Next.js loads `app/.env` for the server, but the
 * Playwright process (config, global setup, specs) does not — so DB credentials and auth secrets would be
 * undefined there. Values already present in the environment win.
 */
export function loadEnv(): void {
  let raw: string
  try {
    raw = readFileSync(resolve(process.cwd(), ".env"), "utf8")
  } catch {
    return
  }
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
