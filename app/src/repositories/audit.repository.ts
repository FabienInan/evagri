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

export async function createAuditLog(data: AuditLogInput) {
  const { organisationId, diff, ...rest } = data
  const createData: Prisma.JournalAuditCreateInput = {
    ...rest,
    ...(diff !== undefined ? { diff } : {}),
    organisation: { connect: { id: organisationId } },
  }
  await prisma.journalAudit.create({ data: createData })
}
