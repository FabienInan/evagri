import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export interface AuditLogInput {
  organisationId: string
  tableCible: string
  enregistrementId?: string
  utilisateurId?: string
  action: string
  diff?: Record<string, string | number | boolean | null>
  adresseIp?: string
}

/** `client` lets the entry join the transaction of the change it records: both commit or neither does. */
export async function createAuditLog(data: AuditLogInput, client: Prisma.TransactionClient = prisma) {
  const { organisationId, diff, ...rest } = data
  const createData: Prisma.JournalAuditCreateInput = {
    ...rest,
    ...(diff !== undefined ? { diff } : {}),
    organisation: { connect: { id: organisationId } },
  }
  await client.journalAudit.create({ data: createData })
}

/** Entrée de journal sans organisation : l'organisation vient de la modification elle-même. */
export type JournalBase = Omit<AuditLogInput, "organisationId">

/**
 * Runs a change and its journal entry in one transaction: both are written, or neither is. `operation` returns
 * the value for the caller, plus the entry to record when the change really happened (none when nothing matched).
 */
export async function ecrireAvecJournal<T>(
  organisationId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<{ resultat: T; journal?: JournalBase }>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const { resultat, journal } = await operation(tx)
    if (journal) await createAuditLog({ ...journal, organisationId }, tx)
    return resultat
  })
}
