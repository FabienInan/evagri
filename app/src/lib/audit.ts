import { prisma } from "./prisma"

export async function logAudit(data: {
  organisationId: string
  tableCible: string
  enregistrementId?: string
  utilisateurId?: string
  action: string
  diff?: Record<string, string | number | boolean | null>
  adresseIp?: string
}) {
  const { diff, ...rest } = data
  await prisma.journalAudit.create({
    data: diff === undefined ? rest : { ...rest, diff },
  })
}
