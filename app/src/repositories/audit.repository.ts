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
  const { diff, ...rest } = data
  const createData: Prisma.JournalAuditCreateInput = {
    ...rest,
    ...(diff !== undefined ? { diff } : {}),
    organisation: { connect: { id: data.organisationId } },
  }
  await prisma.journalAudit.create({ data: createData })
}
