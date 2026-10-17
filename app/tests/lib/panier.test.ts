import { describe, it, expect } from "vitest"
import { sortTransactionRows } from "@/lib/panier"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"

function tx(id: string, fields: Record<string, unknown>): SerializedTransaction {
  return {
    id,
    statut: "ANALYSEE",
    fields: fields as SerializedTransaction["fields"],
    latitude: null,
    longitude: null,
    importationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("sortTransactionRows", () => {
  it("trie numériquement un champ de `fields`", () => {
    const rows = [tx("a", { prix_vente: 30 }), tx("b", { prix_vente: 10 })]
    expect(sortTransactionRows(rows, "prix_vente", "asc").map((r) => r.id)).toEqual(["b", "a"])
  })

  it("place les valeurs nulles en fin quel que soit le sens", () => {
    const rows = [tx("a", { prix_vente: null }), tx("b", { prix_vente: 10 })]
    expect(sortTransactionRows(rows, "prix_vente", "asc").map((r) => r.id)).toEqual(["b", "a"])
    expect(sortTransactionRows(rows, "prix_vente", "desc").map((r) => r.id)).toEqual(["b", "a"])
  })

  it("ne mute pas le tableau d'entrée", () => {
    const rows = [tx("a", { prix_vente: 30 }), tx("b", { prix_vente: 10 })]
    sortTransactionRows(rows, "prix_vente", "asc")
    expect(rows.map((r) => r.id)).toEqual(["a", "b"])
  })
})
