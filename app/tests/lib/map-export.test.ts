import { describe, it, expect } from "vitest"
import { buildMapPoints, pointsToBounds } from "@/lib/map-export"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"

function tx(
  id: string,
  coords: { latitude: number | null; longitude: number | null },
  fields: Record<string, unknown> = {}
): SerializedTransaction {
  return {
    id,
    statut: "ANALYSEE",
    fields: fields as SerializedTransaction["fields"],
    latitude: coords.latitude,
    longitude: coords.longitude,
    importationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("buildMapPoints", () => {
  it("retient les transactions géolocalisées avec leur numéro de vente", () => {
    const points = buildMapPoints([
      tx("a", { latitude: 45.88, longitude: -72.48 }, { numero_inscription: "1234567" }),
    ])
    expect(points).toEqual([{ id: "a", lat: 45.88, lng: -72.48, numero: "1234567" }])
  })

  it("écarte les transactions sans latitude ou sans longitude", () => {
    const points = buildMapPoints([
      tx("a", { latitude: null, longitude: -72.48 }),
      tx("b", { latitude: 45.88, longitude: null }),
      tx("c", { latitude: 45.88, longitude: -72.48 }),
    ])
    expect(points.map((p) => p.id)).toEqual(["c"])
  })

  it("écarte les coordonnées non finies (NaN, Infinity)", () => {
    const points = buildMapPoints([
      tx("a", { latitude: Number.NaN, longitude: -72.48 }),
      tx("b", { latitude: 45.88, longitude: Number.POSITIVE_INFINITY }),
    ])
    expect(points).toEqual([])
  })

  it("accepte la coordonnée 0 (équateur / méridien) sans la confondre avec l'absence", () => {
    const points = buildMapPoints([tx("a", { latitude: 0, longitude: 0 })])
    expect(points).toEqual([{ id: "a", lat: 0, lng: 0, numero: "" }])
  })

  it("renvoie un numéro vide quand le numéro de vente est absent ou non textuel", () => {
    const points = buildMapPoints([
      tx("a", { latitude: 45, longitude: -72 }),
      tx("b", { latitude: 45, longitude: -72 }, { numero_inscription: 42 }),
    ])
    expect(points.map((p) => p.numero)).toEqual(["", ""])
  })
})

describe("pointsToBounds", () => {
  it("renvoie null quand il n'y a aucun point", () => {
    expect(pointsToBounds([])).toBeNull()
  })

  it("renvoie les coins min/max d'un seul point", () => {
    expect(pointsToBounds([{ lat: 45.88, lng: -72.48 }])).toEqual([
      [45.88, -72.48],
      [45.88, -72.48],
    ])
  })

  it("englobe tous les points dans [[minLat,minLng],[maxLat,maxLng]]", () => {
    const bounds = pointsToBounds([
      { lat: 45.88, lng: -72.48 },
      { lat: 46.22, lng: -72.61 },
      { lat: 45.9, lng: -72.47 },
    ])
    expect(bounds).toEqual([
      [45.88, -72.61],
      [46.22, -72.47],
    ])
  })
})
