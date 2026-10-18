import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

let orgId = ""
let analyseeId = ""
let recentId = ""
let undatedId = ""
const previousOrganisationId = process.env.DEFAULT_ORGANISATION_ID

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Transaction Search Org" } })
  orgId = org.id
  // getCurrentOrganisationId lit l'environnement au chargement du module : le définir avant l'import.
  process.env.DEFAULT_ORGANISATION_ID = orgId

  const [numero, date, prix, lots] = await Promise.all([
    prisma.champ.create({ data: { organisationId: orgId, codeMachine: "numero_inscription", nomAffichage: "N°", typeDonnees: "TEXTE", nature: "IMPORTE" } }),
    prisma.champ.create({ data: { organisationId: orgId, codeMachine: "date_vente", nomAffichage: "Date", typeDonnees: "DATE", nature: "IMPORTE" } }),
    prisma.champ.create({ data: { organisationId: orgId, codeMachine: "prix_vente", nomAffichage: "Prix", typeDonnees: "DECIMAL", nature: "IMPORTE" } }),
    prisma.champ.create({ data: { organisationId: orgId, codeMachine: "lots_cadastraux", nomAffichage: "Lots", typeDonnees: "TEXTE", nature: "IMPORTE" } }),
  ])

  const analysee = await prisma.transaction.create({
    data: {
      organisationId: orgId,
      systemeSource: "TEST",
      statut: "ANALYSEE",
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
      valeurs: { create: [
        { champId: numero.id, valeurTexte: "A" },
        { champId: date.id, valeurDate: new Date("2024-01-01T00:00:00.000Z") },
        { champId: prix.id, valeurNombre: "100" },
        { champId: lots.id, valeurTexteMultiple: ["L1"] },
      ] },
    },
  })
  analyseeId = analysee.id

  const recent = await prisma.transaction.create({
    data: {
      organisationId: orgId,
      systemeSource: "TEST",
      statut: "NON_ANALYSEE",
      createdAt: new Date("2024-01-03T00:00:00.000Z"),
      valeurs: { create: [
        { champId: numero.id, valeurTexte: "B" },
        { champId: date.id, valeurDate: new Date("2024-03-01T00:00:00.000Z") },
        { champId: prix.id, valeurNombre: "200" },
        { champId: lots.id, valeurTexteMultiple: ["L1"] },
      ] },
    },
  })
  recentId = recent.id

  const undated = await prisma.transaction.create({
    data: {
      organisationId: orgId,
      systemeSource: "TEST",
      statut: "NON_ANALYSEE",
      createdAt: new Date("2024-01-04T00:00:00.000Z"),
      valeurs: { create: [
        { champId: numero.id, valeurTexte: "C" },
        { champId: prix.id, valeurNombre: "300" },
        { champId: lots.id, valeurTexteMultiple: ["L2"] },
      ] },
    },
  })
  undatedId = undated.id
})

afterAll(async () => {
  await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
  if (previousOrganisationId === undefined) delete process.env.DEFAULT_ORGANISATION_ID
  else process.env.DEFAULT_ORGANISATION_ID = previousOrganisationId
})

describe("searchTransactions", () => {
  it("trie toutes les lignes, pagine, et renvoie les valeurs complètes de la page", async () => {
    const { searchTransactions } = await import("@/server/actions/transaction")
    const first = await searchTransactions({ page: 1, pageSize: 2 })

    expect(first.total).toBe(3)
    expect(first.totalPages).toBe(2)
    expect(first.transactions.map((t) => t.id)).toEqual([recentId, analyseeId])
    // `prix_vente` ne sert pas au tri : il doit tout de même être présent dans la page renvoyée.
    expect(first.transactions[0].fields.prix_vente).toBe(200)

    const second = await searchTransactions({ page: 2, pageSize: 2 })
    expect(second.transactions.map((t) => t.id)).toEqual([undatedId])
  })

  it("trie par un autre champ et respecte l'ordre demandé", async () => {
    const { searchTransactions } = await import("@/server/actions/transaction")
    const page = await searchTransactions({ page: 1, pageSize: 1, sortField: "numero_inscription", sortOrder: "asc" })
    expect(page.transactions[0].id).toBe(analyseeId)

    const next = await searchTransactions({ page: 2, pageSize: 1, sortField: "numero_inscription", sortOrder: "asc" })
    expect(next.transactions[0].id).toBe(recentId)
  })

  it("applique les filtres SQL avant le tri et la pagination", async () => {
    const { searchTransactions } = await import("@/server/actions/transaction")
    const result = await searchTransactions({
      page: 1,
      pageSize: 25,
      filters: [{ id: "statut", typeFiltre: "STATUT", field: "statut", operator: "=", value: "ANALYSEE" }],
    })
    expect(result.total).toBe(1)
    expect(result.transactions.map((t) => t.id)).toEqual([analyseeId])
  })

  it("conserve le regroupement vente/revente quand le filtre REVENTE est actif", async () => {
    const { searchTransactions } = await import("@/server/actions/transaction")
    const result = await searchTransactions({
      page: 1,
      pageSize: 25,
      filters: [{ id: "rente", typeFiltre: "REVENTE", field: "lots_cadastraux", operator: "=", value: "true" }],
    })
    expect(result.total).toBe(2)
    expect(result.transactions.map((t) => t.id)).toEqual([recentId, analyseeId])
  })
})
