import type { SerializedTransaction } from "@/serializers/transaction.serializer"
import { computeAdjustedValues, computePrixActualise } from "@/lib/indicateurs-ajustes"
import { readZip, writeZip, type ZipEntries } from "@/lib/zip-archive"

/**
 * Export Excel d'un panier, au format du modèle « Modèle export panier » (un seul onglet, tableau Ventes).
 * Le modèle nettoyé (public/templates) fournit la police, les tailles, les couleurs et les largeurs de colonnes ;
 * les lignes sont générées, une par transaction.
 */

export const PANIER_TEMPLATE_PATH = "/templates/modele-export-panier.xlsx"

/** Nom de fichier du classeur, dérivé du nom du panier. */
export function buildExportFileName(nom: string): string {
  const slug = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `export-${slug || "panier"}.xlsx`
}

const SHEET_PATH = "xl/worksheets/sheet1.xml"
const TABLE_PATH = "xl/tables/table1.xml"
const WORKBOOK_PATH = "xl/workbook.xml"
const HEADER_ROW = 3
const FIRST_DATA_ROW = 4
const BODY_ROW_HEIGHT = 38.45

type CellContent = { v: number | string | null; f?: string }
type Letters = (templateLetter: string) => string | null
type RowContext = { dateEvaluation: string | null; tauxCroissancePct: number | null }
type ColumnSpec = {
  letter: string
  header: string
  content: (t: SerializedTransaction, row: number, ctx: RowContext) => CellContent
  /** Formule Excel si les colonnes sources sont exportées ; sinon la valeur calculée est écrite telle quelle. */
  formula?: (row: number, letters: Letters) => string | null
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function text(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : null
  if (typeof value === "string") return value.trim() === "" ? null : value.trim()
  if (typeof value === "number") return String(value)
  return null
}

/** Numéro de série Excel d'une date AAAA-MM-JJ (ou d'un horodatage ISO commençant par cette date). */
export function excelDateSerial(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return null
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - Date.UTC(1899, 11, 30)
  return ms / 86_400_000
}

function field(t: SerializedTransaction, code: string): unknown {
  return (t.fields as Record<string, unknown>)[code]
}

function prixAjuste(t: SerializedTransaction, ctx: RowContext): number | null {
  if (ctx.dateEvaluation === null || ctx.tauxCroissancePct === null) return null
  return computePrixActualise(t.fields, { dateEvaluation: ctx.dateEvaluation, tauxCroissancePct: ctx.tauxCroissancePct })
}

function adjusted(t: SerializedTransaction, ctx: RowContext): Record<string, number | null> {
  if (ctx.dateEvaluation === null || ctx.tauxCroissancePct === null) return {}
  return computeAdjustedValues(t.fields, { dateEvaluation: ctx.dateEvaluation, tauxCroissancePct: ctx.tauxCroissancePct })
}

const COLUMNS: ColumnSpec[] = [
  { letter: "A", header: "# vente", content: (t) => ({ v: num(field(t, "numero_transaction")) }) },
  { letter: "B", header: "No d'enr.", content: (t) => ({ v: text(field(t, "numero_inscription")) }) },
  { letter: "C", header: "Date de l'acte", content: (t) => ({ v: excelDateSerial(text(field(t, "date_vente"))) }) },
  { letter: "D", header: "Vendeur", content: (t) => ({ v: text(field(t, "vendeur")) }) },
  { letter: "E", header: "Acheteur", content: (t) => ({ v: text(field(t, "acheteur")) }) },
  { letter: "F", header: "Lots", content: (t) => ({ v: text(field(t, "lots_cadastraux")) }) },
  { letter: "G", header: "Prix de vente ($)", content: (t) => ({ v: num(field(t, "prix_vente")) }) },
  {
    letter: "H",
    header: "Prix de vente ajusté ($)",
    content: (t, _row, ctx) => ({ v: prixAjuste(t, ctx) ?? "" }),
    formula: (row, L) =>
      L("G") && L("C") ? `IFERROR(${L("G")}${row}*(1+$B$2/100)^((\$B$1-${L("C")}${row})/365),"")` : null,
  },
  { letter: "I", header: "MRC", content: (t) => ({ v: text(field(t, "mrc")) }) },
  { letter: "J", header: "Municipalité", content: (t) => ({ v: text(field(t, "municipalite")) }) },
  { letter: "K", header: "Adresse complète", content: (t) => ({ v: text(field(t, "adresse")) }) },
  { letter: "L", header: "Latitude", content: (t) => ({ v: num(field(t, "latitude")) }) },
  { letter: "M", header: "Longitude", content: (t) => ({ v: num(field(t, "longitude")) }) },
  { letter: "N", header: "Superficie totale (ha)", content: (t) => ({ v: num(field(t, "superficie_totale_hectare")) }) },
  { letter: "O", header: "Topographie", content: (t) => ({ v: text(field(t, "topographie")) }) },
  { letter: "P", header: "Classe de sol dominante", content: (t) => ({ v: text(field(t, "classe_de_sol_dominante")) }) },
  { letter: "Q", header: "Superficie cultivée (ha)", content: (t) => ({ v: num(field(t, "superficie_cultive_ha")) }) },
  { letter: "R", header: "Superficie drainée (%)", content: (t) => ({ v: num(field(t, "terres_drainees")) }) },
  {
    letter: "S",
    header: "Superficie boisée (%)",
    content: (t) => {
      const boisee = num(field(t, "superficie_boise_ha"))
      const totale = num(field(t, "superficie_totale_hectare"))
      return { v: boisee !== null && totale !== null && totale > 0 ? boisee / totale : null }
    },
  },
  { letter: "T", header: "Observations", content: (t) => ({ v: text(field(t, "observations")) }) },
  { letter: "U", header: "Taux global ($/ha)", content: (t, _row, ctx) => ({ v: adjusted(t, ctx).taux_global_ajuste ?? null }) },
  {
    letter: "V",
    header: "Taux résiduel ($/ha)",
    content: (t, _row, ctx) => {
      const superficie = num(field(t, "superficie_totale_hectare"))
      const prix = prixAjuste(t, ctx)
      return { v: prix !== null && superficie !== null && superficie > 0 ? prix / superficie : "" }
    },
    formula: (row, L) => (L("H") && L("N") ? `IFERROR(${L("H")}${row}/${L("N")}${row},"")` : null),
  },
]

/** Colonnes proposées à l'export, dans l'ordre du modèle. */
export const EXPORT_COLUMN_OPTIONS: { letter: string; header: string }[] = COLUMNS.map((c) => ({
  letter: c.letter,
  header: c.header,
}))

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function cellXml(ref: string, style: number | undefined, content: CellContent | null): string {
  const s = style === undefined ? "" : ` s="${style}"`
  if (!content) return style === undefined ? "" : `<c r="${ref}"${s}/>`
  if (content.f !== undefined) {
    const f = `<f>${escapeXml(content.f)}</f>`
    if (typeof content.v === "number") return `<c r="${ref}"${s}>${f}<v>${content.v}</v></c>`
    return `<c r="${ref}"${s} t="str">${f}<v>${escapeXml(String(content.v ?? ""))}</v></c>`
  }
  if (content.v === null || content.v === "") return style === undefined ? "" : `<c r="${ref}"${s}/>`
  if (typeof content.v === "number") return `<c r="${ref}"${s}><v>${content.v}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(content.v)}</t></is></c>`
}

/** Style le plus fréquent de chaque colonne dans les lignes de données du modèle (police, taille, couleur, format). */
function bodyStyles(sheetXml: string): Map<string, number> {
  const counts = new Map<string, Map<number, number>>()
  const pattern = /<c r="([A-Z]+)(\d+)"(?: s="(\d+)")?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(sheetXml))) {
    const row = Number(match[2])
    if (row < FIRST_DATA_ROW || match[3] === undefined) continue
    const perColumn = counts.get(match[1]) ?? new Map<number, number>()
    perColumn.set(Number(match[3]), (perColumn.get(Number(match[3])) ?? 0) + 1)
    counts.set(match[1], perColumn)
  }
  const result = new Map<string, number>()
  for (const [letter, perColumn] of counts) {
    let best = -1
    let bestCount = -1
    for (const [style, count] of perColumn) {
      if (count > bestCount) {
        best = style
        bestCount = count
      }
    }
    result.set(letter, best)
  }
  return result
}

function headerStyles(sheetXml: string): Map<string, number> {
  const result = new Map<string, number>()
  const pattern = new RegExp(`<c r="([A-Z]+)${HEADER_ROW}"(?: s="(\\d+)")?`, "g")
  let match: RegExpExecArray | null
  while ((match = pattern.exec(sheetXml))) {
    if (match[2] !== undefined) result.set(match[1], Number(match[2]))
  }
  return result
}

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

/** Colonnes du modèle (A..V) qui ont une largeur ou un style dans la feuille modèle, indexées par lettre. */
function templateCols(sheetXml: string): Map<number, { width?: string; style?: string }> {
  const result = new Map<number, { width?: string; style?: string }>()
  const block = /<cols>([\s\S]*?)<\/cols>/.exec(sheetXml)?.[1] ?? ""
  for (const m of block.matchAll(/<col ([^>]*)\/>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
    const min = Number(attrs.min)
    const max = Math.min(Number(attrs.max), 40)
    for (let i = min; i <= max; i++) result.set(i, { width: attrs.width, style: attrs.style })
  }
  return result
}

function rowsXml(
  transactions: SerializedTransaction[],
  ctx: RowContext,
  columns: ColumnSpec[],
  headers: Map<string, number>,
  bodies: Map<string, number>
): { rows: string; lastRow: number; letters: Map<string, string> } {
  const letters = new Map(columns.map((c, i) => [c.letter, colLetter(i + 1)]))
  const L: Letters = (templateLetter) => letters.get(templateLetter) ?? null
  const parts: string[] = []

  // Lignes 1 et 2 : paramètres de calcul, en B1 (date d'évaluation) et B2 (taux de croissance %), lus par les formules.
  const labelStyle = bodies.get("B")
  parts.push(
    `<row r="1" ht="20" customHeight="1">` +
      cellXml("A1", labelStyle, { v: "Date d'évaluation" }) +
      cellXml("B1", 7, { v: excelDateSerial(ctx.dateEvaluation) }) +
      `</row>`,
    `<row r="2" ht="20" customHeight="1">` +
      cellXml("A2", labelStyle, { v: "Taux de croissance (%)" }) +
      cellXml("B2", 10, { v: ctx.tauxCroissancePct }) +
      `</row>`
  )

  const headerCells = columns.map((c, i) => cellXml(`${colLetter(i + 1)}${HEADER_ROW}`, headers.get(c.letter), { v: c.header }))
  parts.push(`<row r="${HEADER_ROW}" ht="73.5" customHeight="1">${headerCells.join("")}</row>`)

  const rowCount = Math.max(transactions.length, 1)
  for (let i = 0; i < rowCount; i++) {
    const r = FIRST_DATA_ROW + i
    const transaction = transactions[i]
    const cells = columns.map((c, index) => {
      const ref = `${colLetter(index + 1)}${r}`
      if (!transaction) return cellXml(ref, bodies.get(c.letter), null)
      const content = c.content(transaction, r, ctx)
      const formula = c.formula?.(r, L) ?? null
      return cellXml(ref, bodies.get(c.letter), formula ? { v: content.v, f: formula } : { v: content.v })
    })
    parts.push(`<row r="${r}" ht="${BODY_ROW_HEIGHT}" customHeight="1">${cells.join("")}</row>`)
  }
  return { rows: parts.join(""), lastRow: FIRST_DATA_ROW + rowCount - 1, letters }
}

/**
 * Classeur du panier. `selected` : lettres des colonnes du modèle à exporter (toutes par défaut), gardées dans
 * l'ordre du modèle. Les formules ne sont écrites que si leurs colonnes sources sont exportées.
 */
export async function buildPanierWorkbook(
  template: Uint8Array,
  transactions: SerializedTransaction[],
  ctx: RowContext,
  selected: readonly string[] = COLUMNS.map((c) => c.letter)
): Promise<Uint8Array> {
  const chosen = COLUMNS.filter((c) => selected.includes(c.letter))
  if (chosen.length === 0) throw new Error("Sélectionnez au moins une colonne.")

  const entries: ZipEntries = await readZip(template)
  const sheet = new TextDecoder().decode(entries.get(SHEET_PATH))
  const bodies = bodyStyles(sheet)
  const headers = headerStyles(sheet)
  const widths = templateCols(sheet)

  const { rows, lastRow } = rowsXml(transactions, ctx, chosen, headers, bodies)
  const lastLetter = colLetter(chosen.length)

  // Largeurs : chaque colonne exportée garde la largeur de sa colonne dans le modèle.
  const colsXml =
    "<cols>" +
    chosen
      .map((c, i) => {
        const templateIndex = COLUMNS.findIndex((x) => x.letter === c.letter) + 1
        const w = widths.get(templateIndex)?.width
        return w ? `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>` : ""
      })
      .join("") +
    "</cols>"

  let head = sheet.slice(0, sheet.indexOf("<sheetData"))
  head = head.replace(/<cols>[\s\S]*?<\/cols>/, colsXml).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${lastLetter}${lastRow}"/>`)
  // Mises en forme conditionnelles du modèle : elles visaient des lettres de colonnes qui changent avec la sélection.
  const tail = sheet
    .slice(sheet.indexOf("</sheetData>") + "</sheetData>".length)
    .replace(/<conditionalFormatting[\s\S]*?<\/conditionalFormatting>/g, "")
  entries.set(SHEET_PATH, new TextEncoder().encode(head + `<sheetData>${rows}</sheetData>` + tail))

  // Tableau : une colonne par colonne exportée, dans le même ordre ; les noms doivent suivre les en-têtes.
  const table = new TextDecoder().decode(entries.get(TABLE_PATH))
  const tableColumns = chosen
    .map((c, i) => `<tableColumn id="${i + 1}" name="${escapeXml(c.header)}"/>`)
    .join("")
  const withColumns = table
    .replace(/<tableColumns [^>]*>[\s\S]*?<\/tableColumns>/, `<tableColumns count="${chosen.length}">${tableColumns}</tableColumns>`)
    .replace(/ref="[A-Z]+3:[A-Z]+\d+"/g, `ref="A3:${lastLetter}${lastRow}"`)
  entries.set(TABLE_PATH, new TextEncoder().encode(withColumns))

  // Recalcul complet à l'ouverture : les formules se calculent avec les paramètres réels.
  const workbook = new TextDecoder().decode(entries.get(WORKBOOK_PATH))
  entries.set(WORKBOOK_PATH, new TextEncoder().encode(workbook.replace('<calcPr calcId="191029"/>', '<calcPr calcId="191029" fullCalcOnLoad="1"/>')))

  return writeZip(entries)
}
