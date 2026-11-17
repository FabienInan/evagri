import type { ExportTable } from "@/lib/excel-export"
import { readZip, writeZip, type ZipEntries } from "@/lib/zip-archive"

/**
 * Classeur d'export d'un panier. Le contenu (colonnes, valeurs) vient de l'export par colonnes ; le modèle
 * « Modèle export panier » fournit seulement la mise en forme : police, tailles, couleurs et largeurs des
 * colonnes, et le style de tableau. Un seul onglet, une ligne par transaction.
 */

export const PANIER_TEMPLATE_PATH = "/templates/modele-export-panier.xlsx"

const SHEET_PATH = "xl/worksheets/sheet1.xml"
const TABLE_PATH = "xl/tables/table1.xml"
const HEADER_ROW = 3
const FIRST_DATA_ROW = 4
const BODY_ROW_HEIGHT = 38.45
const HEADER_ROW_HEIGHT = 73.5
const DEFAULT_WIDTH = 18

type CellValue = string | number | null

function colLetter(index: number): string {
  let n = index
  let out = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function cellXml(ref: string, style: number, value: CellValue): string {
  if (value === null || value === "") return `<c r="${ref}" s="${style}"/>`
  if (typeof value === "number") return Number.isFinite(value) ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" s="${style}"/>`
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

/** Style le plus fréquent dans une plage de lignes du modèle (police, taille, couleur, alignement). */
function dominantStyle(sheetXml: string, fromRow: number, toRow: number, column?: string): number | null {
  const counts = new Map<number, number>()
  const pattern = /<c r="([A-Z]+)(\d+)"(?: s="(\d+)")?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(sheetXml))) {
    const row = Number(match[2])
    if (row < fromRow || row > toRow || match[3] === undefined) continue
    if (column !== undefined && match[1] !== column) continue
    counts.set(Number(match[3]), (counts.get(Number(match[3])) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [style, count] of counts) {
    if (count > bestCount) {
      best = style
      bestCount = count
    }
  }
  return best
}

/** Largeur de chaque colonne du modèle, par index (1 = A). */
function templateWidths(sheetXml: string): Map<number, string> {
  const result = new Map<number, string>()
  const block = /<cols>([\s\S]*?)<\/cols>/.exec(sheetXml)?.[1] ?? ""
  for (const m of block.matchAll(/<col ([^>]*)\/>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
    if (attrs.width === undefined) continue
    const min = Number(attrs.min)
    const max = Math.min(Number(attrs.max), 60)
    for (let i = min; i <= max; i++) result.set(i, attrs.width)
  }
  return result
}

/** Noms de colonnes uniques, comme l'exige un tableau Excel (les libellés peuvent se répéter). */
function uniqueHeaders(header: string[]): string[] {
  const seen = new Map<string, number>()
  return header.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    return count === 1 ? name : `${name} (${count})`
  })
}

export async function buildPanierWorkbook(template: Uint8Array, table: ExportTable): Promise<Uint8Array> {
  const entries: ZipEntries = await readZip(template)
  const sheet = new TextDecoder().decode(entries.get(SHEET_PATH))
  const headers = uniqueHeaders(table.header)
  const columnCount = headers.length
  const lastLetter = colLetter(Math.max(columnCount, 1))
  const lastRow = FIRST_DATA_ROW + Math.max(table.rows.length, 1) - 1

  const headerStyle = dominantStyle(sheet, HEADER_ROW, HEADER_ROW) ?? 0
  const bodyStyle = dominantStyle(sheet, FIRST_DATA_ROW, 63) ?? 0
  const widths = templateWidths(sheet)

  const headerCells = headers.map((h, i) => cellXml(`${colLetter(i + 1)}${HEADER_ROW}`, headerStyle, h)).join("")
  const rows: string[] = [`<row r="${HEADER_ROW}" ht="${HEADER_ROW_HEIGHT}" customHeight="1">${headerCells}</row>`]
  const dataRows = table.rows.length > 0 ? table.rows : [[]]
  dataRows.forEach((values, rowIndex) => {
    const r = FIRST_DATA_ROW + rowIndex
    const cells = headers
      .map((_, i) => cellXml(`${colLetter(i + 1)}${r}`, bodyStyle, values[i] ?? null))
      .join("")
    rows.push(`<row r="${r}" ht="${BODY_ROW_HEIGHT}" customHeight="1">${cells}</row>`)
  })

  const cols =
    "<cols>" +
    headers
      .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${widths.get(i + 1) ?? DEFAULT_WIDTH}" customWidth="1"/>`)
      .join("") +
    "</cols>"

  let head = sheet.slice(0, sheet.indexOf("<sheetData"))
  head = head
    .replace(/<cols>[\s\S]*?<\/cols>/, cols)
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A${HEADER_ROW}:${lastLetter}${lastRow}"/>`)
  // Mises en forme conditionnelles du modèle : elles visaient des colonnes fixes, qui ne correspondent plus.
  const tail = sheet
    .slice(sheet.indexOf("</sheetData>") + "</sheetData>".length)
    .replace(/<conditionalFormatting[\s\S]*?<\/conditionalFormatting>/g, "")
  entries.set(SHEET_PATH, new TextEncoder().encode(`${head}<sheetData>${rows.join("")}</sheetData>${tail}`))

  // Tableau : une colonne par colonne exportée, avec les mêmes noms que les en-têtes.
  const tableXml = new TextDecoder().decode(entries.get(TABLE_PATH))
  const tableColumns = headers.map((h, i) => `<tableColumn id="${i + 1}" name="${escapeXml(h)}"/>`).join("")
  const updated = tableXml
    .replace(/<tableColumns [^>]*>[\s\S]*?<\/tableColumns>/, `<tableColumns count="${columnCount}">${tableColumns}</tableColumns>`)
    .replace(/ref="[A-Z]+3:[A-Z]+\d+"/g, `ref="A${HEADER_ROW}:${lastLetter}${lastRow}"`)
  entries.set(TABLE_PATH, new TextEncoder().encode(updated))

  return writeZip(entries)
}
