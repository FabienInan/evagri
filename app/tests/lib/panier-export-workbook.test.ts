import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import * as XLSX from "xlsx"
import { buildPanierWorkbook } from "@/lib/panier-export-workbook"
import { readZip, writeZip } from "@/lib/zip-archive"

const TEMPLATE = new Uint8Array(readFileSync(resolve(__dirname, "../../public/templates/modele-export-panier.xlsx")))

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
  const table = {
    header: ["N° d'inscription", "Prix à l'acte", "Superficie boisée", "Superficie boisée"],
    rows: [
      ["E2E-001", 100000, 0.2, "Oui"],
      ["E2E-002", null, 0.5, "Non"],
    ],
  }

  it("écrit un seul onglet avec les en-têtes puis les valeurs, sans changer l'ordre des colonnes", async () => {
    const wb = XLSX.read(await buildPanierWorkbook(TEMPLATE, table))
    expect(wb.SheetNames).toHaveLength(1)
    const ws = wb.Sheets[wb.SheetNames[0]]
    expect(ws.A3.v).toBe("N° d'inscription")
    expect(ws.B3.v).toBe("Prix à l'acte")
    expect(ws.A4.v).toBe("E2E-001")
    expect(ws.B4.v).toBe(100000)
    expect(ws.B5).toBeUndefined()
    expect(ws.D4.v).toBe("Oui")
  })

  it("rend les noms de colonnes uniques, comme le tableau Excel l'exige", async () => {
    const wb = XLSX.read(await buildPanierWorkbook(TEMPLATE, table))
    const ws = wb.Sheets[wb.SheetNames[0]]
    expect(ws.C3.v).toBe("Superficie boisée")
    expect(ws.D3.v).toBe("Superficie boisée (2)")
  })

  it("garde les styles d'en-tête et de cellule du modèle", async () => {
    const bytes = await buildPanierWorkbook(TEMPLATE, table)
    const sheet = new TextDecoder().decode((await readZip(bytes)).get("xl/worksheets/sheet1.xml"))
    const templateSheet = new TextDecoder().decode((await readZip(TEMPLATE)).get("xl/worksheets/sheet1.xml"))
    const headerStyle = /<c r="B3" s="(\d+)"/.exec(templateSheet)?.[1]
    expect(headerStyle).toBeDefined()
    expect(sheet).toContain(`<c r="A3" s="${headerStyle}"`)
  })

  it("étend le tableau à toutes les lignes et à toutes les colonnes", async () => {
    const many = { header: ["A", "B"], rows: Array.from({ length: 80 }, (_, i) => [`t${i}`, i]) }
    const entries = await readZip(await buildPanierWorkbook(TEMPLATE, many))
    const tableXml = new TextDecoder().decode(entries.get("xl/tables/table1.xml"))
    expect(tableXml).toContain('ref="A3:B83"')
    expect(tableXml).toContain('<tableColumn id="2" name="B"/>')
  })

  it("accepte une liste vide sans casser le fichier", async () => {
    const wb = XLSX.read(await buildPanierWorkbook(TEMPLATE, { header: ["X"], rows: [] }))
    expect(wb.Sheets[wb.SheetNames[0]].A3.v).toBe("X")
  })
})
