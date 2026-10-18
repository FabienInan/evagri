import { filterByPolygon, findGeoFilter, findRenteFilter, orderRenteTransactions } from "@/lib/filters"
import {
  buildTransactionWhere,
  findRenteLotNumbers,
  findTransactionsForSorting,
  withRenteLots,
} from "@/repositories/transaction.repository"
import { listTransactionsOfPanier } from "@/repositories/dossier.repository"
import { serializeTransaction, serializeTransactionSummary } from "@/serializers/transaction.serializer"
import { sortTransactionRows } from "@/lib/transaction-sort"
import type { FilterInput } from "@/types/filter"
import type { TransactionNavigation } from "@/types/transaction"

/**
 * Identifiants de toutes les transactions correspondant aux filtres, dans l'ordre d'affichage de la
 * liste (tri, puis filtres géo et regroupement vente/revente). Partagé par la recherche paginée et
 * par la navigation contextuelle de la fiche, pour que les deux voient exactement la même liste.
 */
export async function getOrderedTransactionIds(
  organisationId: string,
  filters: FilterInput[],
  sortField: string,
  sortOrder: "asc" | "desc"
): Promise<string[]> {
  const geoFilter = findGeoFilter(filters)
  const duplicatedLots = findRenteFilter(filters) ? await findRenteLotNumbers(organisationId) : null

  let where = buildTransactionWhere(filters, organisationId)
  if (duplicatedLots) where = withRenteLots(where, duplicatedLots)

  // Seuls les codes utiles au tri et aux post-filtres sont chargés : la fiche n'a besoin que de l'ordre.
  const codes = new Set<string>([sortField])
  if (geoFilter) {
    codes.add("latitude")
    codes.add("longitude")
  }
  if (duplicatedLots) codes.add("lots_cadastraux")

  let ordered = sortTransactionRows(
    (await findTransactionsForSorting(organisationId, where, [...codes])).map(serializeTransactionSummary),
    sortField,
    sortOrder
  )

  if (geoFilter) ordered = filterByPolygon(ordered, geoFilter.value)
  if (duplicatedLots) {
    const withLots = ordered.map((row) => ({
      ...row,
      lotsCadastraux: Array.isArray(row.fields.lots_cadastraux) ? row.fields.lots_cadastraux : [],
    }))
    ordered = orderRenteTransactions(withLots, new Set(duplicatedLots))
  }

  return ordered.map((row) => row.id)
}

/**
 * Voisins de la transaction courante dans la liste filtrée. Renvoie null sans filtre actif :
 * la navigation contextuelle n'a de sens que dans une liste restreinte.
 */
export async function getTransactionNavigation(input: {
  organisationId: string
  currentId: string
  filters: FilterInput[]
  sortField: string
  sortOrder: "asc" | "desc"
}): Promise<TransactionNavigation | null> {
  if (input.filters.length === 0) return null

  const ids = await getOrderedTransactionIds(
    input.organisationId,
    input.filters,
    input.sortField,
    input.sortOrder
  )
  const index = ids.indexOf(input.currentId)
  if (index === -1) return null

  return {
    prevId: index > 0 ? ids[index - 1] : null,
    nextId: index < ids.length - 1 ? ids[index + 1] : null,
    index,
    total: ids.length,
  }
}

/**
 * Navigation dans un panier : uniquement parmi les transactions déjà présentes dans ce panier,
 * dans l'ordre d'affichage de sa liste (même tri que l'écran).
 */
export async function getPanierNavigation(input: {
  organisationId: string
  panierId: string
  currentId: string
  sortField: string
  sortOrder: "asc" | "desc"
}): Promise<TransactionNavigation | null> {
  const rows = await listTransactionsOfPanier(input.organisationId, input.panierId)
  const ordered = sortTransactionRows(
    rows.map(serializeTransaction),
    input.sortField,
    input.sortOrder
  )
  const index = ordered.findIndex((row) => row.id === input.currentId)
  if (index === -1) return null

  return {
    prevId: index > 0 ? ordered[index - 1].id : null,
    nextId: index < ordered.length - 1 ? ordered[index + 1].id : null,
    index,
    total: ordered.length,
  }
}
