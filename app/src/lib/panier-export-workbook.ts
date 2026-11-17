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
type RowContext = { dateEvaluation: string | null; tauxCroissancePct: number | null }
type ColumnSpec = { letter: string; header: string; content: (t: SerializedTransaction, row: number, ctx: RowContext) => CellContent }

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
    content: (t, row, ctx) => ({
      v: prixAjuste(t, ctx) ?? "",
      f: `IFERROR(G${row}*(1+$C$2/100)^(($C$1-C${row})/365),"")`,
    }),
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
    content: (t, row, ctx) => {
      const superficie = num(field(t, "superficie_totale_hectare"))
      const prix = prixAjuste(t, ctx)
      return {
        v: prix !== null && superficie !== null && superficie > 0 ? prix / superficie : "",
        f: `IFERROR(H${row}/N${row},"")`,
      }
    },
  },
]

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

function rowsXml(
  transactions: SerializedTransaction[],
  ctx: RowContext,
  headers: Map<string, number>,
  bodies: Map<string, number>
): { rows: string; lastRow: number } {
  const parts: string[] = []
  // Lignes 1 et 2 : paramètres de calcul, en C1 (date d'évaluation) et C2 (taux de croissance %), lus par les formules.
  const labelStyle = bodies.get("B")
  const dateStyle = 7
  const numberStyle = 10
  parts.push(
    `<row r="1" ht="20" customHeight="1">` +
      cellXml("B1", labelStyle, { v: "Date d'évaluation" }) +
      cellXml("C1", dateStyle, { v: excelDateSerial(ctx.dateEvaluation) }) +
      `</row>`,
    `<row r="2" ht="20" customHeight="1">` +
      cellXml("B2", labelStyle, { v: "Taux de croissance (%)" }) +
      cellXml("C2", numberStyle, { v: ctx.tauxCroissancePct }) +
      `</row>`
  )

  parts.push(
    `<row r="${HEADER_ROW}" ht="73.5" customHeight="1">` +
      COLUMNS.map((c) => cellXml(`${c.letter}${HEADER_ROW}`, headers.get(c.letter), { v: c.header })).join("") +
      `</row>`
  )

  const rowCount = Math.max(transactions.length, 1)
  for (let i = 0; i < rowCount; i++) {
    const r = FIRST_DATA_ROW + i
    const transaction = transactions[i]
    const cells = COLUMNS.map((c) =>
      cellXml(`${c.letter}${r}`, bodies.get(c.letter), transaction ? c.content(transaction, r, ctx) : null)
    )
    parts.push(`<row r="${r}" ht="${BODY_ROW_HEIGHT}" customHeight="1">${cells.join("")}</row>`)
  }
  return { rows: parts.join(""), lastRow: FIRST_DATA_ROW + rowCount - 1 }
}

export async function buildPanierWorkbook(
  template: Uint8Array,
  transactions: SerializedTransaction[],
  ctx: RowContext
): Promise<Uint8Array> {
  const entries: ZipEntries = await readZip(template)
  const sheet = new TextDecoder().decode(entries.get(SHEET_PATH))
  const bodies = bodyStyles(sheet)
  const headers = headerStyles(sheet)

  const { rows, lastRow } = rowsXml(transactions, ctx, headers, bodies)
  const head = sheet.slice(0, sheet.indexOf("<sheetData"))
  const tail = sheet.slice(sheet.indexOf("</sheetData>") + "</sheetData>".length)
  const newSheet = head.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:V${lastRow}"/>`) +
    `<sheetData>${rows}</sheetData>` + tail
  entries.set(SHEET_PATH, new TextEncoder().encode(newSheet))

  const table = new TextDecoder().decode(entries.get(TABLE_PATH))
  entries.set(TABLE_PATH, new TextEncoder().encode(table.split("B3:V63").join(`B3:V${lastRow}`)))

  // Recalcul complet à l'ouverture : les formules se calculent avec les paramètres réels.
  const workbook = new TextDecoder().decode(entries.get(WORKBOOK_PATH))
  entries.set(WORKBOOK_PATH, new TextEncoder().encode(workbook.replace("<calcPr calcId=\"191029\"/>", "<calcPr calcId=\"191029\" fullCalcOnLoad=\"1\"/>")))

  return writeZip(entries)
}
