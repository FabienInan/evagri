import { prisma } from "@/lib/prisma"

export type EntreeJournalAffichee = {
  id: string
  createdAt: Date
  utilisateurEmail: string | null
  tableCible: string
  enregistrementId: string | null
  action: string
  diff: unknown
}

/** Most recent audit entries of one organisation, with the author's courriel resolved. */
export async function listJournalByOrganisation(
  organisationId: string,
  limit = 200
): Promise<EntreeJournalAffichee[]> {
  const entrees = await prisma.journalAudit.findMany({
    where: { organisationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const ids = [...new Set(entrees.map((e) => e.utilisateurId).filter((id): id is string => !!id))]
  const utilisateurs = ids.length
    ? await prisma.utilisateur.findMany({
        where: { id: { in: ids }, organisationId },
        select: { id: true, email: true },
      })
    : []
  const emailParId = new Map(utilisateurs.map((u) => [u.id, u.email]))

  return entrees.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    utilisateurEmail: e.utilisateurId ? emailParId.get(e.utilisateurId) ?? null : null,
    tableCible: e.tableCible,
    enregistrementId: e.enregistrementId,
    action: e.action,
    diff: e.diff,
  }))
}
