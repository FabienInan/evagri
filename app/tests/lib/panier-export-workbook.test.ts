import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import * as XLSX from "xlsx"
import { buildExportFileName, buildPanierWorkbook, excelDateSerial } from "@/lib/panier-export-workbook"
import { readZip, writeZip } from "@/lib/zip-archive"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"

const TEMPLATE = new Uint8Array(readFileSync(resolve(__dirname, "../../public/templates/modele-export-panier.xlsx")))

const transaction = {
  id: "t1",
  fields: {
    numero_transaction: 1,
    numero_inscription: "E2E-001",
    date_vente: "2024-06-15T00:00:00.000Z",
    vendeur: "Vendeur A",
    acheteur: "Acheteur B",
    lots_cadastraux: ["1234567", "2345678"],
    prix_vente: 100000,
    mrc: "Arthabaska",
    municipalite: "Victoriaville",
    adresse: "1 rue test",
    latitude: 46.05,
    longitude: -71.95,
    superficie_totale_hectare: 20,
    topographie: "Plat",
    classe_de_sol_dominante: "2",
    superficie_cultive_ha: 10,
    terres_drainees: 5,
    superficie_boise_ha: 4,
    observations: "RAS",
  },
} as unknown as SerializedTransaction

describe("archive ZIP", () => {
  it("relit exactement ce qu'elle a écrit", async () => {
    const entries = new Map([
      ["a.txt", new TextEncoder().encode("bonjour évaluation ".repeat(50))],
      ["dossier/b.xml", new TextEncoder().encode("<x/>")],
    ])
    const back = await readZip(await writeZip(entries))
    expect([...back.keys()]).toEqual(["a.txt", "dossier/b.xml"])
    expect(new TextDecoder().decode(back.get("a.txt"))).toBe("bonjour évaluation ".repeat(50))
  })

  it("lit le modèle nettoyé", async () => {
    const entries = await readZip(TEMPLATE)
    expect(entries.has("xl/worksheets/sheet1.xml")).toBe(true)
    expect(entries.has("xl/externalLinks/externalLink1.xml")).toBe(false)
  })
})

describe("classeur du panier", () => {
  it("génère un seul onglet, avec en-têtes, paramètres et une ligne par transaction", async () => {
    const bytes = await buildPanierWorkbook(TEMPLATE, [transaction, { ...transaction, id: "t2" }], {
      dateEvaluation: "2026-01-01",
      tauxCroissancePct: 5,
    })
    const wb = XLSX.read(bytes)
    expect(wb.SheetNames).toHaveLength(1)
    const ws = wb.Sheets[wb.SheetNames[0]]

    expect(ws.A3.v).toBe("# vente")
    expect(ws.B3.v).toBe("No d'enr.")
    expect(ws.V3.v).toBe("Taux résiduel ($/ha)")
    expect(ws.A1.v).toBe("Date d'évaluation")
    expect(ws.B1.v).toBe(excelDateSerial("2026-01-01"))
    expect(ws.B2.v).toBe(5)

    expect(ws.B4.v).toBe("E2E-001")
    expect(ws.F4.v).toBe("1234567, 2345678")
    expect(ws.G4.v).toBe(100000)
    expect(ws.C4.v).toBe(excelDateSerial("2024-06-15"))
    expect(ws.S4.v).toBeCloseTo(0.2)
    expect(ws.B5.v).toBe("E2E-001")
  })

  it("calcule le prix ajusté et le taux résiduel en formule, avec la valeur en cache", async () => {
    const bytes = await buildPanierWorkbook(TEMPLATE, [transaction], {
      dateEvaluation: "2026-01-01",
      tauxCroissancePct: 5,
    })
    const ws = XLSX.read(bytes, { cellFormula: true }).Sheets["Panier"] ?? XLSX.read(bytes, { cellFormula: true }).Sheets[XLSX.read(bytes).SheetNames[0]]
    expect(ws.H4.f).toBe('IFERROR(G4*(1+$B$2/100)^(($B$1-C4)/365),"")')
    expect(ws.H4.v).toBeCloseTo(107844.97, 1)
    expect(ws.V4.f).toBe('IFERROR(H4/N4,"")')
    expect(ws.V4.v).toBeCloseTo(107844.97 / 20, 1)
  })

  it("étend le tableau à toutes les lignes", async () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ ...transaction, id: `t${i}` }) as SerializedTransaction)
    const bytes = await buildPanierWorkbook(TEMPLATE, many, { dateEvaluation: "2026-01-01", tauxCroissancePct: 5 })
    const table = new TextDecoder().decode((await readZip(bytes)).get("xl/tables/table1.xml"))
    expect(table).toContain('ref="A3:V83"')
  })
})

describe("tableau du classeur", () => {
  it("a des noms de colonnes identiques aux en-têtes de la ligne 3", async () => {
    const bytes = await buildPanierWorkbook(TEMPLATE, [transaction], { dateEvaluation: "2026-01-01", tauxCroissancePct: 5 })
    const table = new TextDecoder().decode((await readZip(bytes)).get("xl/tables/table1.xml"))
    const names = [...table.matchAll(/<tableColumn [^>]*name="([^"]*)"/g)].map((m) =>
      m[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    )
    const ws = XLSX.read(bytes).Sheets[XLSX.read(bytes).SheetNames[0]]
    const headers = "ABCDEFGHIJKLMNOPQRSTUV".split("").map((c) => String(ws[`${c}3`].v))
    expect(names).toEqual(headers)
  })
})

describe("nom du fichier", () => {
  it("dérive un nom de fichier propre du nom du panier", () => {
    expect(buildExportFileName("Terres été 2026 / test")).toBe("export-terres-ete-2026-test.xlsx")
    expect(buildExportFileName("   ")).toBe("export-panier.xlsx")
  })
})

describe("choix des colonnes", () => {
  it("n'exporte que les colonnes choisies, dans l'ordre du modèle, et recalcule les références", async () => {
    const bytes = await buildPanierWorkbook(
      TEMPLATE,
      [transaction],
      { dateEvaluation: "2026-01-01", tauxCroissancePct: 5 },
      ["B", "C", "G", "H"]
    )
    const ws = XLSX.read(bytes, { cellFormula: true }).Sheets[XLSX.read(bytes).SheetNames[0]]
    expect(ws.A3.v).toBe("No d'enr.")
    expect(ws.D3.v).toBe("Prix de vente ajusté ($)")
    expect(ws.E3).toBeUndefined()
    expect(ws.D4.f).toBe('IFERROR(C4*(1+$B$2/100)^(($B$1-B4)/365),"")')
  })

  it("écrit la valeur calculée quand une colonne source n'est pas exportée", async () => {
    const bytes = await buildPanierWorkbook(
      TEMPLATE,
      [transaction],
      { dateEvaluation: "2026-01-01", tauxCroissancePct: 5 },
      ["B", "H"]
    )
    const ws = XLSX.read(bytes, { cellFormula: true }).Sheets[XLSX.read(bytes).SheetNames[0]]
    expect(ws.B4.f).toBeUndefined()
    expect(ws.B4.v).toBeCloseTo(107844.97, 1)
  })

  it("refuse une sélection vide", async () => {
    await expect(
      buildPanierWorkbook(TEMPLATE, [transaction], { dateEvaluation: "2026-01-01", tauxCroissancePct: 5 }, [])
    ).rejects.toThrow()
  })
})
