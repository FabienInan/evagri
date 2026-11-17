import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

/**
 * Refuse que la suite de tests écrive dans une base distante (les tests e2e créent et suppriment des données).
 * `ALLOW_REMOTE_TEST_DB=1` lève la garde explicitement. Lève une erreur ; ne renvoie rien si la base est locale.
 */
export function assertLocalTestDatabase(databaseUrl: string | undefined, allowRemote: boolean): void {
  if (!databaseUrl || allowRemote) return
  let host: string
  try {
    host = new URL(databaseUrl).hostname
  } catch {
    throw new Error("DATABASE_URL invalide : impossible de vérifier que la base de test est locale.")
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Tests refusés sur une base distante (${host}). Utilisez une base locale, ou ALLOW_REMOTE_TEST_DB=1 pour forcer.`
    )
  }
}

/** Valeur d'une variable dans le fichier .env du projet (sans dépendance ; ne modifie pas l'environnement). */
export function readEnvFileValue(name: string, envPath = resolve(__dirname, "../../.env")): string | undefined {
  let content: string
  try {
    content = readFileSync(envPath, "utf8")
  } catch {
    return undefined
  }
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (match && match[1] === name) return match[2].replace(/^["']|["']$/g, "")
  }
  return undefined
}
