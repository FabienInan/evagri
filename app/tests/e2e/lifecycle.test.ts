import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { rm } from "node:fs/promises"
import { prisma } from "@/lib/prisma"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"

// The "use server" actions call revalidatePath; outside a Next request there is no cache store to revalidate.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Non-regression coverage of the unified model end to end, across the server-action layer: an Excel import
// flows through search, the fiche (values + recalculated indicator + status), PDF actes, and the map, while
// the admin champs/filters/layout actions are exercised on the same organisation. Unit tests cover the pure
// helpers; this file is the backstop that they are still wired to a real database.
//
// It runs against the real Postgres (see vitest.config.ts — no global setup), so it builds its own isolated
// organisation and tears everything down afterwards. DEFAULT_ORGANISATION_ID is read at module load by the
// organisation repository, so it must be set before any action is imported (imports happen inside tests).

let orgId = ""
let txId = ""
let typeTransactionChampId = ""

const previousOrganisationId = process.env.DEFAULT_ORGANISATION_ID
const fixturePath = join(__dirname, "../fixtures/minimal.xlsx")
const numeroInscription = "22309676"
const uploadedFilesRoot = join(process.cwd(), "uploads", "actes")

const TYPOLOGIES = [
  { code: "TERRES_CULTIVEES", nom: "Terres cultivées", ordre: 1 },
  { code: "TERRES_BOISEES", nom: "Terres boisées", ordre: 2 },
  { code: "ERABLIERES", nom: "Érablières", ordre: 3 },
  { code: "BATIMENTS_AGRICOLES", nom: "Bâtiments agricoles", ordre: 4 },
  { code: "FERME", nom: "Ferme", ordre: 5 },
]

/** Loads the shared Excel fixture as a File the way a browser upload would deliver it. */
function loadFixtureFile(): File {
  const buffer = readFileSync(fixturePath)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  return new File([arrayBuffer], "minimal.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function fixtureFormData(): FormData {
  const formData = new FormData()
  formData.append("file", loadFixtureFile())
  return formData
}

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test E2E Org" } })
  orgId = org.id
  process.env.DEFAULT_ORGANISATION_ID = orgId

  for (const t of TYPOLOGIES) {
    await prisma.typologie.create({ data: { organisationId: orgId, ...t, estFeuille: true } })
  }

  // Imported fields: nature IMPORTE, read-only by default, applicable everywhere (mirrors prisma/seed.ts).
  const importedChampIds: string[] = []
  for (const [index, f] of IMPORTED_FIELDS.entries()) {
    const champ = await prisma.champ.create({
      data: {
        organisationId: orgId,
        codeMachine: f.code,
        nomAffichage: f.label,
        typeDonnees: f.typeDonnees,
        typeFiltreRecommande: f.typeFiltreRecommande,
        nature: "IMPORTE",
        unite: f.numeric ? (f.code.startsWith("superficie") ? "ha" : f.code === "prix_vente" ? "$" : "°") : "N/A",
        entetesImport: f.entetesImport,
        applicableATypes: [],
        ordreAffichage: index,
        estAffiche: true,
        estLectureSeule: true,
      },
    })
    importedChampIds.push(champ.id)
  }

  const typeTransaction = await prisma.champ.create({
    data: {
      organisationId: orgId,
      codeMachine: "typeTransaction",
      nomAffichage: "Type de transaction",
      typeDonnees: "LISTE",
      nature: "SAISISSABLE",
      unite: "N/A",
      applicableATypes: [],
      estLectureSeule: false,
      optionsListe: TYPOLOGIES.map((t) => t.nom),
    },
  })
  typeTransactionChampId = typeTransaction.id

  // One CALCULE indicator referenced by the fiche validation/recompute path.
  await prisma.champ.create({
    data: {
      organisationId: orgId,
      codeMachine: "taux_global",
      nomAffichage: "Taux global",
      typeDonnees: "ENTIER",
      nature: "CALCULE",
      unite: "$/ha",
      regleCalcul: "prix_vente / superficie_totale_hectare",
      applicableATypes: [],
    },
  })

  // Saved fiche layout: the imported fields are the only ones placed, hence the only visible ones.
  await prisma.vueFicheEvaluation.create({
    data: {
      organisationId: orgId,
      typeVue: "FICHE_TRANSACTION",
      contenu: {
        sections: [{ id: "00000000-0000-0000-0000-0000000000e1", nom: "Données de l'acte", ordre: 0, champs: importedChampIds }],
      },
    },
  })
})

afterAll(async () => {
  await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.documentActe.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.importation.deleteMany({ where: { organisationId: orgId } })
  await prisma.filtreRecherche.deleteMany({ where: { organisationId: orgId } })
  await prisma.vueFicheEvaluation.deleteMany({ where: { organisationId: orgId } })
  await prisma.journalAudit.deleteMany({ where: { organisationId: orgId } })
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.typologie.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })

  await rm(join(uploadedFilesRoot, orgId), { recursive: true, force: true })

  if (previousOrganisationId === undefined) delete process.env.DEFAULT_ORGANISATION_ID
  else process.env.DEFAULT_ORGANISATION_ID = previousOrganisationId
})

async function readSingleTransaction() {
  const { searchTransactions } = await import("@/server/actions/transaction")
  const result = await searchTransactions({})
  return result.transactions[0]
}

describe("E2E — cycle de vie import → recherche → fiche → statut → actes → carte", () => {
  it("importe le classeur Excel et crée une transaction analysable", async () => {
    const { importExcel } = await import("@/server/actions/import")
    const result = await importExcel(fixtureFormData())
    expect(result).toEqual({ ok: true, totalRows: 1, inserted: 1, ignored: 0, errors: [] })

    const transaction = await readSingleTransaction()
    expect(transaction).toBeDefined()
    txId = transaction.id
    expect(transaction.statut).toBe("NON_ANALYSEE")
  })

  it("expose les champs plats de la transaction importée", async () => {
    const transaction = await readSingleTransaction()
    expect(transaction.fields.numero_inscription).toBe(numeroInscription)
    expect(transaction.fields.prix_vente).toBe(36000)
    expect(transaction.fields.superficie_totale_hectare).toBe(6.25)
    expect(transaction.fields.lots_cadastraux).toEqual(["5433069"])
    expect(transaction.fields.municipalite).toBe("Baie-du-Febvre")
  })

  it("ignore un ré-import du même fichier (déduplication par n° d'inscription normalisé)", async () => {
    const { importExcel } = await import("@/server/actions/import")
    const result = await importExcel(fixtureFormData())
    expect(result).toEqual({ ok: true, totalRows: 1, inserted: 0, ignored: 1, errors: [] })
  })

  it("enregistre la fiche : valeurs modifiées, indicateur recalculé et type de transaction", async () => {
    const { saveFiche } = await import("@/server/actions/fiche")
    const transaction = await readSingleTransaction()

    // The fiche form posts every visible value; build the payload from the current fields so the save does
    // not drop the imported fields (the repository replaces all ValeurChamp rows for the transaction).
    const valeurs = {
      ...transaction.fields,
      prix_vente: 40000,
      typeTransaction: "TERRES_CULTIVEES",
      taux_global: 6400,
    }

    const result = await saveFiche({ id: txId, typeTransactionCode: "TERRES_CULTIVEES", valeurs })
    expect(result).toEqual({ ok: true })

    const updated = await readSingleTransaction()
    expect(updated.fields.prix_vente).toBe(40000)
    expect(updated.fields.taux_global).toBe(6400)
    expect(updated.fields.typeTransaction).toBe("TERRES_CULTIVEES")
  })

  it("rejette une fiche sans type de transaction (règle bloquante V-TYPE)", async () => {
    const { saveFiche } = await import("@/server/actions/fiche")
    const result = await saveFiche({ id: txId, typeTransactionCode: null, valeurs: { prix_vente: 40000 } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("type de transaction")
  })

  it("passe le statut de la fiche à Analysée", async () => {
    const { setFicheStatut } = await import("@/server/actions/fiche")
    const result = await setFicheStatut(txId, "ANALYSEE")
    expect(result).toEqual({ ok: true })

    const updated = await readSingleTransaction()
    expect(updated.statut).toBe("ANALYSEE")
  })

  it("réouvre une fiche analysée sans perdre le contributeur ni la date d'analyse", async () => {
    const { setFicheStatut } = await import("@/server/actions/fiche")
    const analysedAt = new Date("2026-01-15T12:00:00.000Z")
    await prisma.transaction.update({
      where: { id: txId },
      data: { contributeurId: "contributeur-historique", dateStatut: analysedAt },
    })

    const result = await setFicheStatut(txId, "NON_ANALYSEE")
    expect(result).toEqual({ ok: true })

    const updated = await prisma.transaction.findUniqueOrThrow({ where: { id: txId } })
    expect(updated.statut).toBe("NON_ANALYSEE")
    expect(updated.contributeurId).toBe("contributeur-historique")
    expect(updated.dateStatut?.toISOString()).toBe(analysedAt.toISOString())
  })

  it("associe un acte PDF au numéro d'inscription", async () => {
    const { importActesPDF } = await import("@/server/actions/actes")
    const formData = new FormData()
    formData.append("files", new File([Buffer.from("%PDF-1.4 acte de test")], `${numeroInscription}.pdf`, { type: "application/pdf" }))

    const result = await importActesPDF(formData)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error)
    expect(result.matchedCount).toBe(1)
    expect(result.matched[0].transactionId).toBe(txId)

    const document = await prisma.documentActe.findFirst({ where: { transactionId: txId } })
    expect(document?.nomFichier).toBe(`${numeroInscription}.pdf`)
  })

  it("alimente la carte avec les coordonnées de la transaction", async () => {
    const { findTransactionsForMap } = await import("@/repositories/transaction.repository")
    const rows = await findTransactionsForMap([], orgId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: txId,
      numeroInscription,
      // The coordinates column is Decimal(18,4), so the file's 6-decimal values are rounded on write.
      latitude: 46.1543,
      longitude: -72.7061,
      municipalite: "Baie-du-Febvre",
    })
  })
})

describe("E2E — upload et suppression de document", () => {
  it("téléverse puis supprime un document de la fiche", async () => {
    const { uploadDocument, deleteDocument } = await import("@/server/actions/fiche")

    const formData = new FormData()
    formData.append("file", new File([Buffer.from("%PDF-1.7 document")], "document.pdf", { type: "application/pdf" }))
    expect(await uploadDocument(txId, formData)).toEqual({ ok: true })

    const document = await prisma.documentActe.findFirst({ where: { transactionId: txId, nomFichier: "document.pdf" } })
    expect(document).not.toBeNull()

    expect(await deleteDocument(document!.id)).toEqual({ ok: true })
    expect(await prisma.documentActe.findUnique({ where: { id: document!.id } })).toBeNull()
  })

  it("refuse un fichier qui n'est pas un PDF", async () => {
    const { uploadDocument } = await import("@/server/actions/fiche")
    const formData = new FormData()
    formData.append("file", new File([Buffer.from("texte")], "note.txt", { type: "text/plain" }))
    const result = await uploadDocument(txId, formData)
    expect(result.ok).toBe(false)
  })
})

describe("E2E — administration des champs", () => {
  it("crée, met à jour et désactive un champ saisissable", async () => {
    const { createChamp, updateChamp, toggleChampActif, listChamps, listTypologies } = await import(
      "@/server/actions/champs"
    )

    const created = await createChamp({
      codeMachine: "commentaire_e2e",
      nomAffichage: "Commentaire E2E",
      typeDonnees: "TEXTE",
      nature: "SAISISSABLE",
      unite: "N/A",
      plageMin: null,
      plageMax: null,
      optionsListe: null,
      regleCalcul: null,
      applicableATypes: ["TERRES_CULTIVEES"],
      ordreAffichage: 99,
      estAffiche: true,
      estObligatoire: false,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) throw new Error(created.error)

    const afterCreate = await listChamps()
    const champ = afterCreate.find((c) => c.codeMachine === "commentaire_e2e")
    expect(champ).toBeDefined()
    expect(champ?.nature).toBe("SAISISSABLE")
    expect(champ?.estLectureSeule).toBe(false)

    const updated = await updateChamp(champ!.id, {
      codeMachine: "commentaire_e2e",
      nomAffichage: "Commentaire E2E modifié",
      typeDonnees: "TEXTE",
      nature: "SAISISSABLE",
      unite: "N/A",
      plageMin: null,
      plageMax: null,
      optionsListe: null,
      regleCalcul: null,
      applicableATypes: ["TERRES_CULTIVEES"],
      ordreAffichage: 99,
      estAffiche: true,
      estObligatoire: true,
    })
    expect(updated).toEqual({ ok: true })

    const toggled = await toggleChampActif(champ!.id, false)
    expect(toggled).toEqual({ ok: true })

    const typologies = await listTypologies()
    expect(typologies.map((t) => t.code)).toContain("TERRES_CULTIVEES")
    expect((await listChamps()).find((c) => c.codeMachine === "commentaire_e2e")?.actif).toBe(false)
  })

  it("refuse une règle de calcul référencant un champ inconnu", async () => {
    const { createChamp } = await import("@/server/actions/champs")
    const result = await createChamp({
      codeMachine: "indicateur_invalide_e2e",
      nomAffichage: "Indicateur invalide",
      typeDonnees: "ENTIER",
      nature: "CALCULE",
      unite: "$",
      plageMin: null,
      plageMax: null,
      optionsListe: null,
      regleCalcul: "champ_inexistant_xyz * 2",
      applicableATypes: ["TERRES_CULTIVEES"],
      ordreAffichage: 100,
      estAffiche: true,
      estObligatoire: false,
    })
    expect(result.ok).toBe(false)
  })
})

describe("E2E — filtres", () => {
  it("crée, publie puis supprime un filtre", async () => {
    const { createFilter, listFilters, publishFilters, deleteFilter } = await import("@/server/actions/filters")

    const created = await createFilter({
      nomFiltre: "Filtre E2E",
      typeFiltre: "LISTE",
      champId: typeTransactionChampId,
      codeMachine: null,
      operateurs: ["="],
      ordreAffichage: 5,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) throw new Error(created.error)

    const filters = await listFilters()
    const filter = filters.find((f) => f.nomFiltre === "Filtre E2E")
    expect(filter).toBeDefined()

    expect(await publishFilters([{ id: filter!.id, ordreAffichage: 7, estActif: false }])).toEqual({ ok: true })
    expect(await deleteFilter(filter!.id)).toEqual({ ok: true })
    expect((await listFilters()).find((f) => f.nomFiltre === "Filtre E2E")).toBeUndefined()
  })
})

describe("E2E — disposition de la fiche", () => {
  it("enregistre puis relit la disposition des sections", async () => {
    const { saveFicheLayout, getFicheLayout } = await import("@/server/actions/sections")

    const saved = await saveFicheLayout([
      { id: "section-e2e", nom: "Section E2E", ordre: 0, champs: [typeTransactionChampId] },
    ])
    expect(saved).toEqual({ ok: true })

    const layout = await getFicheLayout()
    expect(layout).toHaveLength(1)
    expect(layout[0]).toMatchObject({ id: "section-e2e", nom: "Section E2E", champs: [typeTransactionChampId] })
  })
})
