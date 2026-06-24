import { Prisma } from "@prisma/client"

export interface FilterInput {
  id: string
  typeFiltre: string
  field: string
  operator: string
  value: string
}

export function buildWhereClause(filters: FilterInput[]): Prisma.TransactionSourceWhereInput {
  const andClauses: Prisma.TransactionSourceWhereInput[] = []

  for (const f of filters) {
    if (!f.value && f.value !== "0") continue

    const field = f.field as keyof Prisma.TransactionSourceWhereInput
    let clause: Prisma.TransactionSourceWhereInput = {}

    switch (f.typeFiltre) {
      case "RECHERCHE_TEXTE":
        clause = {
          OR: [
            { numeroInscription: { contains: f.value, mode: "insensitive" } },
            { vendeur: { contains: f.value, mode: "insensitive" } },
            { acheteur: { contains: f.value, mode: "insensitive" } },
            { municipalite: { contains: f.value, mode: "insensitive" } },
          ],
        }
        break
      case "PLAGE_NUMERIQUE":
        if (f.operator === "entre") {
          const [min, max] = f.value.split("-").map(Number)
          clause = { [field]: { gte: min, lte: max } }
        } else if (f.operator === "+") {
          clause = { [field]: { gte: Number(f.value) } }
        } else if (f.operator === "-") {
          clause = { [field]: { lte: Number(f.value) } }
        } else {
          clause = { [field]: { equals: Number(f.value) } }
        }
        break
      case "PLAGE_DATE":
        if (f.operator === "entre") {
          const [start, end] = f.value.split(",").map((s) => new Date(s.trim()))
          clause = { [field]: { gte: start, lte: end } }
        } else if (f.operator === "+") {
          clause = { [field]: { gte: new Date(f.value) } }
        } else if (f.operator === "-") {
          clause = { [field]: { lte: new Date(f.value) } }
        } else {
          clause = { [field]: { equals: new Date(f.value) } }
        }
        break
      case "LISTE":
      case "MULTI_SELECT":
        clause = { [field]: { in: f.value.split(",") } }
        break
      case "BOOLEEN":
        clause = { [field]: f.value === "true" }
        break
      case "NUMERO_LOT":
        clause = { lotsCadastraux: { has: f.value } }
        break
    }

    andClauses.push(clause)
  }

  return andClauses.length > 0 ? { AND: andClauses } : {}
}
