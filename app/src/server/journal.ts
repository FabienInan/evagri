import { createAuditLog } from "@/repositories/audit.repository"

export type EntreeJournal = {
  tableCible: string
  enregistrementId?: string
  action: string
  diff?: Record<string, string | number | boolean | null>
}

/**
 * Records one business change in the audit journal, attributed to the user who made it.
 * Call it after the change has been written, so the journal never describes a change that did not happen.
 */
export async function journaliser(utilisateur: { id: string; organisationId: string }, entree: EntreeJournal) {
  await createAuditLog({
    organisationId: utilisateur.organisationId,
    utilisateurId: utilisateur.id,
    ...entree,
  })
}
