import { describe, it, expect } from "vitest"
import { assertLocalTestDatabase } from "../setup/database-guard"

describe("assertLocalTestDatabase", () => {
  it("accepte une base locale", () => {
    expect(() => assertLocalTestDatabase("postgresql://u:p@localhost:5432/evagri", false)).not.toThrow()
    expect(() => assertLocalTestDatabase("postgresql://u:p@127.0.0.1:5432/evagri", false)).not.toThrow()
  })

  it("refuse une base distante", () => {
    expect(() =>
      assertLocalTestDatabase("postgresql://u:p@ep-wild.neon.tech/neondb?sslmode=require", false)
    ).toThrow(/base distante \(ep-wild\.neon\.tech\)/)
  })

  it("laisse passer une base distante si la garde est levée explicitement", () => {
    expect(() => assertLocalTestDatabase("postgresql://u:p@ep-wild.neon.tech/neondb", true)).not.toThrow()
  })

  it("refuse une URL invalide sans révéler le mot de passe", () => {
    expect(() => assertLocalTestDatabase("pas une url secret", false)).toThrow(/DATABASE_URL invalide/)
  })

  it("ne bloque pas quand aucune base n'est configurée", () => {
    expect(() => assertLocalTestDatabase(undefined, false)).not.toThrow()
  })
})
