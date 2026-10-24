import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/**
 * Transactions of the organisation holding at least one of the given champs, with only those values: the
 * calculation pass reads the operands of the rules and the stored CALCULE values, nothing else.
 */
export async function listTransactionValeursByOrganisation(organisationId: string, champIds: string[]) {
  return prisma.transaction.findMany({
    where: { organisationId, valeurs: { some: { champId: { in: champIds } } } },
    select: {
      id: true,
      valeurs: {
        where: { champId: { in: champIds } },
        select: { champId: true, valeurNombre: true, champ: { select: { codeMachine: true } } },
      },
    },
  })
}

export interface ValeurCalculee {
  transactionId: string
  champId: string
  /** null removes the stored value (the calculation no longer yields a result). */
  valeurNombre: number | null
}

/** Writes calculated values in one database transaction per call, so a half-applied batch cannot persist. */
export async function applyValeursCalculees(valeurs: ValeurCalculee[]): Promise<void> {
  if (valeurs.length === 0) return
  const operations: Prisma.PrismaPromise<unknown>[] = valeurs.map((v) =>
    v.valeurNombre === null
      ? prisma.valeurChamp.deleteMany({ where: { transactionId: v.transactionId, champId: v.champId } })
      : prisma.valeurChamp.upsert({
          where: { transactionId_champId: { transactionId: v.transactionId, champId: v.champId } },
          create: { transactionId: v.transactionId, champId: v.champId, valeurNombre: v.valeurNombre },
          update: { valeurNombre: v.valeurNombre },
        })
  )
  await prisma.$transaction(operations)
}
