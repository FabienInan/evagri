import { readFileSync } from "node:fs"
import { resolve } from "node:path"

export type E2eFixtures = {
  orgId: string
  dossierId: string
  dossierNumero: string
  paniers: { source: string; cible: string; vide: string }
  transactions: {
    t1: string
    t2: string
    t3: string
    t4: string
    t5: string
    t6: string
    t7: string
    t9: string
  }
  numeros: {
    t1: string
    t2: string
    t3: string
    t4: string
    t5: string
    t6: string
    t7: string
    t9: string
  }
}

/** Reads the ids the global setup persisted, so specs can navigate straight to seeded rows. */
export function fixtures(): E2eFixtures {
  return JSON.parse(readFileSync(resolve(process.cwd(), "e2e/.fixtures.json"), "utf8"))
}
