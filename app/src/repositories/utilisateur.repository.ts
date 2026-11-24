import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createAuditLog, type AuditLogInput } from "@/repositories/audit.repository"

/** Fields safe to send to the browser: never the password hash. */
export const utilisateurPublicSelect = {
  id: true,
  organisationId: true,
  email: true,
  nom: true,
  role: true,
  actif: true,
  createdAt: true,
  consentementPolitiqueAt: true,
} as const

export function findUtilisateurById(id: string) {
  return prisma.utilisateur.findUnique({ where: { id } })
}

export function findUtilisateurByEmail(organisationId: string, email: string) {
  return prisma.utilisateur.findFirst({ where: { organisationId, email } })
}

export function listUtilisateursByOrganisation(organisationId: string) {
  return prisma.utilisateur.findMany({
    where: { organisationId },
    orderBy: [{ actif: "desc" }, { createdAt: "asc" }],
    select: utilisateurPublicSelect,
  })
}

export type CreationUtilisateur = {
  organisationId: string
  email: string
  nom: string | null
  role: string
  passwordHash: string
  motDePasseTemporaire?: boolean
}

export type ModificationUtilisateur = {
  role?: string
  actif?: boolean
  passwordHash?: string
  motDePasseTemporaire?: boolean
}

/** Entrée de journal rattachée à la modification : elle est écrite dans la même transaction. */
export type JournalModificationUtilisateur = Omit<AuditLogInput, "organisationId" | "tableCible">

/** Thrown when a change would leave the organisation without an active administrator. */
export class DernierAdministrateurError extends Error {
  constructor() {
    super("Au moins un administrateur actif doit rester dans l'organisation")
    this.name = "DernierAdministrateurError"
  }
}

/** Creates a user and records the entry in the same transaction. */
export function creerUtilisateurAvecJournal(
  data: CreationUtilisateur,
  journal: JournalModificationUtilisateur
) {
  return prisma.$transaction(
    async (tx) => {
      const utilisateur = await tx.utilisateur.create({ data, select: utilisateurPublicSelect })
      await createAuditLog(
        { ...journal, organisationId: data.organisationId, tableCible: "utilisateur", enregistrementId: utilisateur.id },
        tx
      )
      return utilisateur
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}

/**
 * Changes a user and records the entry in the same transaction. A change that removes an active administrator's
 * rights is refused when no other active administrator would remain. Serializable isolation: two administrators
 * demoting each other at the same time cannot both commit, since the second check would no longer hold.
 */
export function modifierUtilisateurAvecJournal(
  organisationId: string,
  id: string,
  changes: ModificationUtilisateur,
  journal: JournalModificationUtilisateur
) {
  return prisma.$transaction(
    async (tx) => {
      const cible = await tx.utilisateur.findFirst({ where: { id, organisationId } })
      if (!cible) throw new Error("Utilisateur introuvable")

      const retireDroitAdmin =
        cible.role === "ADMIN" &&
        cible.actif &&
        ((changes.role !== undefined && changes.role !== "ADMIN") || changes.actif === false)
      if (retireDroitAdmin) {
        const autres = await tx.utilisateur.count({
          where: { organisationId, role: "ADMIN", actif: true, NOT: { id } },
        })
        if (autres === 0) throw new DernierAdministrateurError()
      }

      const utilisateur = await tx.utilisateur.update({
        where: { id },
        data: changes,
        select: utilisateurPublicSelect,
      })
      await createAuditLog(
        { ...journal, organisationId, tableCible: "utilisateur", enregistrementId: id },
        tx
      )
      return utilisateur
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}

/**
 * Counts a failed sign-in. The increment is atomic in the database, so parallel attempts are all counted.
 * Returns the number of failures since the last successful sign-in.
 */
export async function enregistrerEchecConnexion(id: string): Promise<number> {
  const { echecsConnexion } = await prisma.utilisateur.update({
    where: { id },
    data: { echecsConnexion: { increment: 1 } },
    select: { echecsConnexion: true },
  })
  return echecsConnexion
}

/** Locks the account until `jusqua`; the failure counter restarts when the lock ends. */
export function verrouillerUtilisateur(id: string, jusqua: Date) {
  return prisma.utilisateur.update({
    where: { id },
    data: { verrouilleJusqua: jusqua, echecsConnexion: 0 },
  })
}

/** A successful sign-in clears the failure counter and any expired lock. */
export function reinitialiserEchecsConnexion(id: string) {
  return prisma.utilisateur.update({
    where: { id },
    data: { echecsConnexion: 0, verrouilleJusqua: null },
  })
}

/** Records the privacy-policy acceptance and its audit entry in one transaction. */
export function enregistrerConsentementAvecJournal(
  organisationId: string,
  id: string,
  date: Date,
  journal: JournalModificationUtilisateur
) {
  return prisma.$transaction(async (tx) => {
    await tx.utilisateur.update({ where: { id }, data: { consentementPolitiqueAt: date } })
    await createAuditLog({ ...journal, organisationId, tableCible: "utilisateur", enregistrementId: id }, tx)
  })
}
