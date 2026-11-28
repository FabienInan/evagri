/**
 * Normalise un classeur de transactions (feuilles Bois, Terre, Ventes érablière) avant import.
 *
 * Usage (depuis app/) :
 *   npx tsx scripts/normalize-excel.ts <classeur-source.xlsx> <classeur-normalise.xlsx>
 *
 * Le rapport (compteurs par champ et par règle) est écrit à côté, sous le nom <sortie>_rapport.json.
 *
 * Règles de sécurité :
 * - une valeur que la règle ne reconnaît pas est conservée telle quelle (et comptée), jamais effacée ;
 * - les erreurs de formule Excel (#DIV/0!, #VALUE!…) deviennent vides : leur valeur est inconnue ;
 * - les coordonnées absentes ou hors du Québec sont recherchées par le géocodage cadastral (Demeter),
 *   à partir du ou des numéros de lot ; sans résultat, elles restent telles quelles et la ligne est
 *   signalée dans « Revue ».
 */
import * as fs from "fs"
import * as path from "path"
import * as XLSX from "xlsx"
import assert from "assert"
import {
  normalizeTopography,
  normalizeFeuillusResineux,
  normalizeZoneAgricoleCptaq,
  normalizeTypeCulture,
  normalizeTypeSol,
  normalizeDensitePlantation,
  normalizeSousClasse,
  discretizeProportion,
} from "../src/lib/normalization/transforms"
import { normalizeCase, toKey } from "../src/lib/normalization/mappings"
import { parseFrenchNumber } from "../src/lib/normalization/parsing"
import { createReport, incrementCounter, type NormalizationReport } from "../src/lib/normalization/report"
import { geocodeLotCadastral, moyenneCoordonnees } from "../src/lib/cadastre"
import { formatNumeroLot } from "../src/lib/lot-cadastral"
import { estDansQuebec } from "../src/lib/lot-cadastral"

type Row = Record<string, unknown>

const TRANSACTION_SHEETS = ["Bois", "Terre", "Ventes erablière"]

/** Colonnes retirées : sources de superficie, redondantes avec la colonne de valeur. */
const DROPPED_COLUMNS = ["Source superficie drainée", "Source superficie cultivée"]

/** Colonnes sans nom (« Colonne1 »…) : jamais de valeur utile dans ce classeur ; leur contenu est compté. */
const REGEX_COLONNE_SANS_NOM = /^colonne\d+$/i

const ERREURS_EXCEL = /^#(DIV\/0!|VALUE!|REF!|N\/A|NAME\?|NUM!|NULL!)$/

/** Colonnes dont la valeur doit être un nombre ; une chaîne qui se lit comme un nombre est convertie. */
const COLONNES_NUMERIQUES = new Set([
  "Prix de vente ($)",
  "Superficie totale (ha)",
  "Superficie boisée (ha)",
  "Superficie boisée",
  "Superficie cultivée (ha)",
  "Superficie drainée (ha)",
  "Zones humides (ha)",
  "Superficie acéricole (ha)",
  "Superficie plantation",
  "Superficie terrain résidentiel (m²)",
  "Nombre d'entailles",
  "Proportion feuillus",
  "Proportion résineux",
  "Latitude",
  "Longitude",
])

/** Colonnes de date : une chaîne ISO (« 2025-07-14 », espaces insécables compris) devient une date. */
const REGEX_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Alias d'en-têtes d'une feuille vers le nom canonique, comparés sur la clé de `toKey` (sans accents, minuscules). */
const ALIAS_ENTETES: Record<string, string> = {
  cptaq: "Zone agricole (CPTAQ)",
  "superficie totale (ha)": "Superficie totale (ha)",
  "adresse complette": "Adresse complète",
  "no d'enregistrement": "No d'enr.",
  "date de l'acte": "Date de l'acte ou de l'avant contrat",
  "proporition resineux": "Proportion résineux",
  "zones humides types)": "Zones humides types",
  densite: "Densité plantation",
}

/** Concurrence des appels au géocodage cadastral : assez pour aller vite, sans saturer le service. */
const CONCURRENCE_DEMETER = 8

function nomCanonique(entete: string): string {
  const cle = toKey(entete)
  if (cle.includes("prix") && cle.includes("vente") && !cle.includes("redress")) return "Prix de vente ($)"
  const alias = ALIAS_ENTETES[cle]
  if (alias) return alias
  return entete.trim()
}

function estVide(valeur: unknown): boolean {
  return valeur === null || valeur === undefined || (typeof valeur === "string" && valeur.replace(/ /g, " ").trim() === "")
}

function estLigneVide(row: Row): boolean {
  return Object.values(row).every(estVide)
}

function nettoyerEntetes(row: Row): Row {
  const result: Row = {}
  for (const [key, value] of Object.entries(row)) {
    const cle = key.trim()
    if (!cle || /^__EMPTY/i.test(cle)) continue
    result[cle] = value
  }
  return result
}

function ajouterRevue(row: Row, texte: string) {
  row["Revue"] = row["Revue"] ? `${String(row["Revue"])}; ${texte}` : texte
}

function enregistrerColonneRetiree(report: NormalizationReport, feuille: string, colonne: string) {
  report.columnsDropped[feuille] ??= []
  if (!report.columnsDropped[feuille].includes(colonne)) report.columnsDropped[feuille].push(colonne)
}

/** Valeur d'une cellule : erreur Excel → vide ; texte numérique dans une colonne numérique → nombre ; date ISO → date. */
function normaliserValeur(canonique: string, valeur: unknown, feuille: string, report: NormalizationReport): unknown {
  if (typeof valeur === "string" && ERREURS_EXCEL.test(valeur.trim())) {
    incrementCounter(report, canonique, "erreur_excel_vidée")
    return null
  }
  if (typeof valeur !== "string") return valeur
  const texte = valeur.replace(/ /g, " ").trim()
  if (texte === "") return null
  if (COLONNES_NUMERIQUES.has(canonique)) {
    const nombre = parseFrenchNumber(texte)
    if (nombre !== null) {
      incrementCounter(report, canonique, "texte_converti_en_nombre")
      return nombre
    }
    incrementCounter(report, canonique, "non_numerique_conservé")
    return valeur
  }
  const iso = REGEX_DATE_ISO.exec(texte)
  if (iso && canonique.toLowerCase().includes("date")) {
    incrementCounter(report, canonique, "texte_converti_en_date")
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
  }
  void feuille
  return valeur
}

function normaliserLigne(row: Row, feuille: string, report: NormalizationReport): Row {
  const normalized: Row = {}
  const aSuperficieHa = row["Superficie boisée (ha)"] !== undefined

  for (const [entete, valeurBrute] of Object.entries(row)) {
    const canonique = nomCanonique(entete)

    if (DROPPED_COLUMNS.includes(canonique)) {
      enregistrerColonneRetiree(report, feuille, canonique)
      continue
    }
    if (REGEX_COLONNE_SANS_NOM.test(canonique)) {
      if (!estVide(valeurBrute)) incrementCounter(report, feuille, `${canonique}_valeurs_ignorées`)
      enregistrerColonneRetiree(report, feuille, canonique)
      continue
    }
    if (canonique === "Superficie boisée" && aSuperficieHa) {
      enregistrerColonneRetiree(report, feuille, canonique)
      continue
    }

    const valeur = normaliserValeur(canonique, valeurBrute, feuille, report)

    switch (canonique) {
      case "Topographie": {
        const resultat = normalizeTopography(valeur)
        normalized[canonique] = resultat.normalized
        if (resultat.hasCombination) {
          normalized["Topographie (combiné brute)"] = resultat.detail
          incrementCounter(report, "topographie", "combinaison_signalée")
        }
        if (resultat.normalized && toKey(resultat.normalized) !== toKey(valeur)) {
          incrementCounter(report, "topographie", "alias_normalisé")
        }
        break
      }
      case "Feuillus/Résineux": {
        const proportion = discretizeProportion(row["Proportion feuillus"])
        const resultat = normalizeFeuillusResineux(valeur, proportion)
        normalized[canonique] = resultat ?? valeur
        if (resultat && toKey(resultat) !== toKey(valeur)) incrementCounter(report, "feuillus_resineux", "alias_normalisé")
        break
      }
      case "Proportion feuillus":
      case "Proportion résineux": {
        const proportion = discretizeProportion(valeur)
        if (proportion === null && !estVide(valeur)) {
          normalized[canonique] = valeur
          incrementCounter(report, canonique, "non_convertie_conservée")
        } else {
          normalized[canonique] = proportion
        }
        break
      }
      case "Zone agricole (CPTAQ)": {
        const resultat = normalizeZoneAgricoleCptaq(valeur)
        if (resultat.zone === null && !estVide(valeur)) {
          normalized[canonique] = valeur
          incrementCounter(report, "zone_agricole_cptaq", "non_reconnue_conservée")
        } else {
          normalized[canonique] = resultat.zone
          if (resultat.zone && toKey(resultat.zone) !== toKey(valeur)) {
            incrementCounter(report, "zone_agricole_cptaq", "alias_normalisé")
          }
        }
        if (resultat.autorisations && resultat.autorisations.length > 0) {
          normalized["Autorisation CPTAQ"] = resultat.autorisations.join(" / ")
          incrementCounter(report, "zone_agricole_cptaq", "autorisation_extraite")
        }
        break
      }
      case "Sous-classe dominante": {
        const resultat = normalizeSousClasse(valeur)
        if (resultat === null && !estVide(valeur)) {
          // Valeur hors règle (plus de deux lettres, « G », « O », chiffres) : conservée telle quelle.
          normalized[canonique] = valeur
          incrementCounter(report, "sous_classe_dominante", "non_reconnue_conservée")
        } else {
          normalized[canonique] = resultat
          if (resultat !== null && resultat !== valeur) incrementCounter(report, "sous_classe_dominante", "normalisée")
        }
        break
      }
      case "Type de culture": {
        const resultat = normalizeTypeCulture(valeur)
        normalized[canonique] = resultat ?? valeur
        if (resultat && toKey(resultat) !== toKey(valeur)) incrementCounter(report, "type_de_culture", "alias_normalisé")
        break
      }
      case "Densité plantation": {
        const resultat = normalizeDensitePlantation(valeur)
        if (resultat === null && !estVide(valeur)) {
          normalized[canonique] = valeur
          incrementCounter(report, "densite_plantation", "non_convertie_conservée")
        } else {
          normalized[canonique] = resultat
          if (resultat !== valeur) incrementCounter(report, "densite_plantation", "convertie_en_nombre")
        }
        break
      }
      case "Type de sol": {
        const resultat = normalizeTypeSol(valeur)
        if (resultat === null && !estVide(valeur)) {
          normalized[canonique] = valeur
          incrementCounter(report, "type_de_sol", "non_reconnu_conservé")
        } else {
          normalized[canonique] = resultat
          if (resultat && toKey(resultat) !== toKey(valeur)) incrementCounter(report, "type_de_sol", "alias_normalisé")
        }
        break
      }
      case "No d'enr.": {
        normalized[canonique] =
          typeof valeur === "string" || typeof valeur === "number" ? String(valeur).replace(/\s+/g, "") : valeur
        break
      }
      default: {
        normalized[canonique] = typeof valeur === "string" ? normalizeCase(valeur.replace(/\s+/g, " ").trim()) : valeur
      }
    }
  }

  if (estVide(normalized["Ville/Municipalité"]) && estVide(normalized["Adresse complète"])) {
    ajouterRevue(normalized, "Localisation manquante")
    incrementCounter(report, "_ligne", "localisation_manquante")
  }

  return normalized
}

function nombreOuNull(valeur: unknown): number | null {
  if (estVide(valeur)) return null
  return parseFrenchNumber(valeur)
}

/** Numéros de lot d'une cellule « Lots » : séparés par virgule, point-virgule, barre, retour à la ligne ou « et ». */
function lotsDeLaCellule(valeur: unknown): string[] {
  if (estVide(valeur)) return []
  return String(valeur)
    .split(/[,;\n/]|\bet\b/i)
    .map((s) => s.trim())
    .filter((s) => s.replace(/\D/g, "").length >= 5)
}

async function enParallele<T>(elements: T[], concurrence: number, traiter: (element: T) => Promise<void>) {
  let suivant = 0
  const travailleurs = Array.from({ length: Math.min(concurrence, elements.length) }, async () => {
    while (suivant < elements.length) {
      const element = elements[suivant]
      suivant += 1
      await traiter(element)
    }
  })
  await Promise.all(travailleurs)
}

/** Cache disque des réponses Demeter : une relance ne refait pas les appels déjà faits. Clé : numéro de lot formaté. */
let cacheDemeter: Record<string, { latitude: number; longitude: number } | null> = {}
let cheminCacheDemeter = ""

function chargerCacheDemeter(chemin: string) {
  cheminCacheDemeter = chemin
  if (fs.existsSync(chemin)) cacheDemeter = JSON.parse(fs.readFileSync(chemin, "utf8"))
}

function sauverCacheDemeter() {
  if (cheminCacheDemeter) fs.writeFileSync(cheminCacheDemeter, JSON.stringify(cacheDemeter))
}

async function geocoderLot(lot: string) {
  const cle = formatNumeroLot(lot)
  if (cle in cacheDemeter) return cacheDemeter[cle]
  const resultat = await geocodeLotCadastral(lot)
  cacheDemeter[cle] = resultat
  if (Object.keys(cacheDemeter).length % 100 === 0) sauverCacheDemeter()
  return resultat
}

/** Coordonnées absentes ou hors du Québec : géocodage cadastral (Demeter) à partir des lots.
 * Une coordonnée trouvée remplace la valeur ; l'originale est conservée dans « … d'origine ».
 */
async function resoudreCoordonnees(rows: Row[], feuille: string, report: NormalizationReport) {
  const aVerifier = rows.filter((row) => {
    const lat = nombreOuNull(row["Latitude"])
    const lon = nombreOuNull(row["Longitude"])
    return lat === null || lon === null || !estDansQuebec(lat, lon)
  })
  let traites = 0
  await enParallele(aVerifier, CONCURRENCE_DEMETER, async (row) => {
    const lat0 = nombreOuNull(row["Latitude"])
    const lon0 = nombreOuNull(row["Longitude"])
    const raison = lat0 === null && lon0 === null ? "absentes" : "incoherentes"
    if (lat0 !== null && lon0 !== null && !estDansQuebec(lat0, lon0)) {
      // Lat et lon échangées ? Compté seulement : la correction passe par Demeter.
      if (estDansQuebec(lon0, lat0)) incrementCounter(report, `coordonnees_${feuille}`, "inversees_signalées")
    }
    const lots = lotsDeLaCellule(row["Lots"])
    if (lots.length === 0) {
      incrementCounter(report, `coordonnees_${feuille}`, `${raison}_sans_lot`)
      ajouterRevue(row, "Coordonnées à valider")
      return
    }
    const moyenne = moyenneCoordonnees(
      (await Promise.all(lots.slice(0, 5).map(geocoderLot))).filter((c): c is { latitude: number; longitude: number } => c !== null)
    )
    if (!moyenne) {
      incrementCounter(report, `coordonnees_${feuille}`, `${raison}_non_trouvées_au_cadastre`)
      ajouterRevue(row, "Coordonnées à valider")
      return
    }
    if (lat0 !== null || lon0 !== null) {
      row["Latitude d'origine"] = row["Latitude"]
      row["Longitude d'origine"] = row["Longitude"]
    }
    row["Latitude"] = moyenne.latitude
    row["Longitude"] = moyenne.longitude
    incrementCounter(report, `coordonnees_${feuille}`, `${raison}_remplacées_par_demeter`)
    traites += 1
    if (traites % 200 === 0) console.log(`  ${feuille} : ${traites} coordonnées géocodées…`)
  })
}

/** Nombres non finis, dates hors de la plage d'Excel (1900-9999) et textes trop longs ne s'écrivent pas : nettoyés avant écriture. */
function nettoyerCellules(row: Row): Row {
  const propre: Row = {}
  for (const [cle, valeur] of Object.entries(row)) {
    if (typeof valeur === "number" && !Number.isFinite(valeur)) propre[cle] = null
    else if (valeur instanceof Date && (Number.isNaN(valeur.getTime()) || valeur.getUTCFullYear() < 1900 || valeur.getUTCFullYear() > 9999))
      propre[cle] = null
    else if (typeof valeur === "string" && valeur.length > 32767) propre[cle] = valeur.slice(0, 32767)
    else propre[cle] = valeur
  }
  return propre
}

function normaliserFeuille(rows: Row[], feuille: string, report: NormalizationReport): Row[] {
  report.sheetTotals[feuille] = rows.length
  const nettoyees = rows.map(nettoyerEntetes).filter((r) => !estLigneVide(r))
  report.rowsDropped[feuille] = rows.length - nettoyees.length
  return nettoyees.map((row) => normaliserLigne(row, feuille, report))
}

function verifierSortie(sortie: string, rapport: NormalizationReport) {
  const wb = XLSX.read(fs.readFileSync(sortie), { type: "buffer", cellDates: true })
  for (const feuille of TRANSACTION_SHEETS) {
    assert.ok(wb.Sheets[feuille], `Feuille absente de la sortie : ${feuille}`)
    const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[feuille], { raw: true })
    for (const colonne of Object.keys(rows[0] ?? {})) {
      assert.ok(!REGEX_COLONNE_SANS_NOM.test(colonne), `Colonne sans nom restante : ${colonne}`)
    }
    for (const row of rows) {
      for (const [colonne, valeur] of Object.entries(row)) {
        if (typeof valeur === "string") {
          assert.ok(!ERREURS_EXCEL.test(valeur.trim()), `Erreur Excel restante : ${feuille} / ${colonne}`)
        }
      }
      const lat = nombreOuNull(row["Latitude"])
      const lon = nombreOuNull(row["Longitude"])
      if (lat !== null && lon !== null) {
        assert.ok(estDansQuebec(lat, lon), `Coordonnée hors Québec restante : ${feuille} ${lat}, ${lon}`)
      }
    }
  }
  for (const feuille of ["Feuil1", "Listes valeurs", "_Listes", "Registre des recherches"]) {
    if (wb.Sheets[feuille]) console.log(`  feuille conservée telle quelle : ${feuille}`)
  }
  console.log("Vérifications de sortie : OK")
  console.log(`Compteurs : ${Object.keys(rapport.fieldChanges).length} champs suivis, détail dans le rapport`)
}

async function main() {
  const [entree, sortie] = process.argv.slice(2)
  if (!entree || !sortie) {
    console.error("Usage : npx tsx scripts/normalize-excel.ts <classeur-source.xlsx> <classeur-normalise.xlsx>")
    process.exit(2)
  }
  const INPUT = path.resolve(entree)
  const OUTPUT = path.resolve(sortie)
  const REPORT = OUTPUT.replace(/\.xlsx$/i, "") + "_rapport.json"
  if (!fs.existsSync(INPUT)) throw new Error(`Fichier introuvable : ${INPUT}`)

  chargerCacheDemeter(OUTPUT.replace(/\.xlsx$/i, "") + "_cache_demeter.json")
  const workbook = XLSX.read(fs.readFileSync(INPUT), { type: "buffer", cellDates: true })
  const report = createReport()
  const feuillesSorties: Record<string, Row[]> = {}

  for (const feuille of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[feuille], { raw: true, defval: null })
    if (TRANSACTION_SHEETS.includes(feuille)) {
      const normalisees = normaliserFeuille(rows, feuille, report)
      await resoudreCoordonnees(normalisees, feuille, report)
      feuillesSorties[feuille] = normalisees
    } else {
      feuillesSorties[feuille] = rows
    }
  }

  const sortieClasseur = XLSX.utils.book_new()
  for (const [feuille, rows] of Object.entries(feuillesSorties)) {
    XLSX.utils.book_append_sheet(sortieClasseur, XLSX.utils.json_to_sheet(rows.map(nettoyerCellules)), feuille)
  }
  sauverCacheDemeter()
  try {
    fs.writeFileSync(OUTPUT, XLSX.write(sortieClasseur, { type: "buffer", bookType: "xlsx" }))
  } catch (erreur) {
    for (const [feuille, rows] of Object.entries(feuillesSorties)) {
      const seule = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(seule, XLSX.utils.json_to_sheet(rows.map(nettoyerCellules)), feuille)
      try {
        XLSX.write(seule, { type: "buffer", bookType: "xlsx" })
      } catch {
        console.error(`  feuille non écrivable : ${feuille}`)
      }
    }
    try {
      XLSX.write(sortieClasseur, { type: "buffer", bookType: "xlsx" })
      console.error("  classeur complet écrit en mémoire : échec du seul écrivain de fichier")
    } catch (detail) {
      console.error(`  détail d'écriture : ${(detail as Error).stack?.split("\n").slice(0, 4).join(" | ")}`)
    }
    throw new Error(`Écriture impossible vers ${OUTPUT} : ${(erreur as Error).message}`)
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))

  console.log(`Classeur normalisé : ${OUTPUT}`)
  console.log(`Rapport : ${REPORT}`)
  verifierSortie(OUTPUT, report)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
