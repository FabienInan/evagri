import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { getPanierNavigation, getTransactionNavigation } from "@/server/transaction-order"
import type { FilterInput } from "@/types/filter"

let orgId = ""
let analyseeOldId = ""
let analyseeRecentId = ""
let nonAnalyseeId = ""
let panierId = ""

const analyseeFilter: FilterInput[] = [
  { id: "statut", typeFiltre: "STATUT", field: "statut", operator: "=", value: "ANALYSEE" },
]

async function createTransaction(statut: "ANALYSEE" | "NON_ANALYSEE", dateVente: Date, dateChampId: string) {
  return prisma.transaction.create({
    data: {
      organisationId: orgId,
      systemeSource: "TEST",
      statut,
      valeurs: { create: [{ champId: dateChampId, valeurDate: dateVente }] },
    },
  })
}

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Transaction Navigation Org" } })
  orgId = org.id
  const date = await prisma.champ.create({
    data: {
      organisationId: orgId,
      codeMachine: "date_vente",
      nomAffichage: "Date de vente",
      typeDonnees: "DATE",
      nature: "IMPORTE",
    },
  })

  // Tri date_vente desc : récente, ancienne, non analysée (écartée par le filtre statut).
  analyseeRecentId = (await createTransaction("ANALYSEE", new Date("2024-03-01T00:00:00.000Z"), date.id)).id
  analyseeOldId = (await createTransaction("ANALYSEE", new Date("2024-01-01T00:00:00.000Z"), date.id)).id
  nonAnalyseeId = (await createTransaction("NON_ANALYSEE", new Date("2024-02-01T00:00:00.000Z"), date.id)).id

  // Panier ne contenant que les deux transactions analysées : la navigation s'y limite.
  const dossier = await prisma.dossier.create({
    data: { organisationId: orgId, numeroDossier: "DOS-NO-NAV" },
  })
  const panier = await prisma.panier.create({
    data: { organisationId: orgId, dossierId: dossier.id, nom: "Panier de navigation" },
  })
  panierId = panier.id
  await prisma.panierTransaction.createMany({
    data: [
      { panierId: panier.id, transactionId: analyseeRecentId },
      { panierId: panier.id, transactionId: analyseeOldId },
    ],
  })
})

afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panierId } })
  await prisma.panier.deleteMany({ where: { organisationId: orgId } })
  await prisma.dossier.deleteMany({ where: { organisationId: orgId } })
  await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
})

describe("getTransactionNavigation", () => {
  it("retourne les voisins dans l'ordre de la liste filtrée", async () => {
    const navigation = await getTransactionNavigation({
      organisationId: orgId,
      currentId: analyseeOldId,
      filters: analyseeFilter,
      sortField: "date_vente",
      sortOrder: "desc",
    })

    expect(navigation).toEqual({ prevId: analyseeRecentId, nextId: null, index: 1, total: 2 })
  })

  it("désactive précédent sur la première ligne", async () => {
    const navigation = await getTransactionNavigation({
      organisationId: orgId,
      currentId: analyseeRecentId,
      filters: analyseeFilter,
      sortField: "date_vente",
      sortOrder: "desc",
    })

    expect(navigation).toEqual({ prevId: null, nextId: analyseeOldId, index: 0, total: 2 })
  })

  it("navigue dans la liste complète quand aucun filtre n'est actif", async () => {
    const navigation = await getTransactionNavigation({
      organisationId: orgId,
      currentId: analyseeOldId,
      filters: [],
      sortField: "date_vente",
      sortOrder: "desc",
    })

    // Liste complète, date desc : récente, non analysée, ancienne.
    expect(navigation).toEqual({ prevId: nonAnalyseeId, nextId: null, index: 2, total: 3 })
  })

  it("renvoie null quand la fiche est hors de la liste filtrée", async () => {
    const navigation = await getTransactionNavigation({
      organisationId: orgId,
      currentId: nonAnalyseeId,
      filters: analyseeFilter,
      sortField: "date_vente",
      sortOrder: "desc",
    })

    expect(navigation).toBeNull()
  })
})

describe("getPanierNavigation", () => {
  it("limite la navigation aux transactions du panier, dans l'ordre de tri", async () => {
    const navigation = await getPanierNavigation({
      organisationId: orgId,
      panierId,
      currentId: analyseeOldId,
      sortField: "date_vente",
      sortOrder: "desc",
    })

    // Le panier ne contient pas la transaction non analysée : 2 lignes seulement.
    expect(navigation).toEqual({ prevId: analyseeRecentId, nextId: null, index: 1, total: 2 })
  })

  it("désactive précédent sur la première ligne du panier", async () => {
    const navigation = await getPanierNavigation({
      organisationId: orgId,
      panierId,
      currentId: analyseeRecentId,
      sortField: "date_vente",
      sortOrder: "desc",
    })

    expect(navigation).toEqual({ prevId: null, nextId: analyseeOldId, index: 0, total: 2 })
  })

  it("renvoie null quand la transaction n'est pas dans le panier", async () => {
    const navigation = await getPanierNavigation({
      organisationId: orgId,
      panierId,
      currentId: nonAnalyseeId,
      sortField: "date_vente",
      sortOrder: "desc",
    })

    expect(navigation).toBeNull()
  })
})
