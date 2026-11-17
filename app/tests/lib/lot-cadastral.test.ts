import { describe, it, expect } from "vitest"
import { NUMERO_LOT_REGEX, estDansQuebec, formatNumeroLot } from "@/lib/lot-cadastral"

describe("formatNumeroLot", () => {
  it("groupe les chiffres par trois", () => {
    expect(formatNumeroLot("4128182")).toBe("4 128 182")
    expect(formatNumeroLot("4 128 182")).toBe("4 128 182")
    expect(formatNumeroLot("999")).toBe("999")
  })
})

describe("NUMERO_LOT_REGEX", () => {
  it("accepte chiffres et espaces", () => {
    for (const ok of ["4 128 182", "4128182", "999", "9 999  999"]) expect(NUMERO_LOT_REGEX.test(ok)).toBe(true)
  })
  it("refuse le reste", () => {
    for (const bad of ["", " ", "A12", "4-128", "4.128", "12B", " 4 "]) {
      expect(NUMERO_LOT_REGEX.test(bad)).toBe(false)
    }
  })
})

describe("estDansQuebec", () => {
  it("accepte Québec, Montréal et le Nunavik", () => {
    expect(estDansQuebec(46.8, -71.2)).toBe(true)
    expect(estDansQuebec(45.5, -73.6)).toBe(true)
    expect(estDansQuebec(60.0, -75.0)).toBe(true)
  })
  it("refuse l'Ontario, New York et le Labrador", () => {
    expect(estDansQuebec(43.7, -79.4)).toBe(false)
    expect(estDansQuebec(40.7, -74.0)).toBe(false)
    expect(estDansQuebec(53.3, -60.0)).toBe(false)
  })
})
