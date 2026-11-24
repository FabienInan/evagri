"use server"

import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentAdmin, type CurrentUser } from "@/lib/session"
import { ROLES } from "@/lib/roles"
import {
  DernierAdministrateurError,
  creerUtilisateurAvecJournal,
  findUtilisateurByEmail,
  findUtilisateurById,
  modifierUtilisateurAvecJournal,
} from "@/repositories/utilisateur.repository"
import type { ActionResult } from "@/server/actions/types"

const BCRYPT_COST = 12
const ADMIN_PAGE = "/admin/utilisateurs"
const ACCES_REFUSE = "Accès réservé aux administrateurs"
const COURRIEL_DEJA_UTILISE = "Un utilisateur utilise déjà ce courriel"
const MODIFICATION_CONCURRENTE = "Une autre modification est en cours. Réessayez."
const ECHEC_ENREGISTREMENT = "Impossible d'enregistrer la modification. Réessayez."

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Courriel invalide"),
  nom: z.string().trim().max(200, "Nom trop long").optional(),
  role: z.enum(ROLES, { error: "Rôle invalide" }),
})

const roleSchema = z.enum(ROLES, { error: "Rôle invalide" })

/** 16 characters from the OS random source; shown once to the administrator, never stored in clear. */
function genererMotDePasseTemporaire(): string {
  return randomBytes(12).toString("base64url")
}

function codePrisma(error: unknown): string | undefined {
  return (error as { code?: string }).code
}

async function requireAdmin(): Promise<{ admin: CurrentUser } | { error: string }> {
  const admin = await getCurrentAdmin()
  return admin ? { admin } : { error: ACCES_REFUSE }
}

/** Loads a user only if they belong to the administrator's organisation. */
async function findTargetInOrganisation(id: string, organisationId: string) {
  const cible = await findUtilisateurById(id)
  if (!cible || cible.organisationId !== organisationId) return null
  return cible
}

/** Server actions return `{ ok, error }`: a failure is reported to the screen, never thrown (masked in production). */
function erreurModification(error: unknown): { ok: false; error: string } {
  if (error instanceof DernierAdministrateurError) return { ok: false, error: error.message }
  if (codePrisma(error) === "P2034") return { ok: false, error: MODIFICATION_CONCURRENTE }
  console.error("utilisateurs: échec d'enregistrement", error)
  return { ok: false, error: ECHEC_ENREGISTREMENT }
}

export async function inviteUtilisateur(
  formData: FormData
): Promise<ActionResult<{ motDePasseTemporaire: string }>> {
  const guard = await requireAdmin()
  if ("error" in guard) return { ok: false, error: guard.error }
  const { admin } = guard

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    nom: formData.get("nom") || undefined,
    role: formData.get("role"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" }

  const { email, nom, role } = parsed.data
  if (await findUtilisateurByEmail(admin.organisationId, email)) {
    return { ok: false, error: COURRIEL_DEJA_UTILISE }
  }

  const motDePasseTemporaire = genererMotDePasseTemporaire()
  try {
    await creerUtilisateurAvecJournal(
      {
        organisationId: admin.organisationId,
        email,
        nom: nom || null,
        role,
        passwordHash: await bcrypt.hash(motDePasseTemporaire, BCRYPT_COST),
        // A temporary password is never kept: the invited user must choose their own at first access.
        motDePasseTemporaire: true,
      },
      { utilisateurId: admin.id, action: "INSERT", diff: { email, role } }
    )
  } catch (error) {
    // Two invitations for the same courriel at the same time: the unique index refuses the second.
    if (codePrisma(error) === "P2002") return { ok: false, error: COURRIEL_DEJA_UTILISE }
    return erreurModification(error)
  }

  revalidatePath(ADMIN_PAGE)
  return { ok: true, motDePasseTemporaire }
}

export async function changerRoleUtilisateur(id: string, role: string): Promise<ActionResult> {
  const guard = await requireAdmin()
  if ("error" in guard) return { ok: false, error: guard.error }
  const { admin } = guard

  const parsedRole = roleSchema.safeParse(role)
  if (!parsedRole.success) return { ok: false, error: "Rôle invalide" }

  if (id === admin.id) return { ok: false, error: "Vous ne pouvez pas modifier votre propre rôle" }

  const cible = await findTargetInOrganisation(id, admin.organisationId)
  if (!cible) return { ok: false, error: "Utilisateur introuvable" }
  if (cible.role === parsedRole.data) return { ok: true }

  try {
    await modifierUtilisateurAvecJournal(
      admin.organisationId,
      id,
      { role: parsedRole.data },
      { utilisateurId: admin.id, action: "UPDATE", diff: { role: parsedRole.data, ancienRole: cible.role } }
    )
  } catch (error) {
    return erreurModification(error)
  }

  revalidatePath(ADMIN_PAGE)
  return { ok: true }
}

/**
 * Replaces the user's password with a new temporary one, shown once. The user must choose their own
 * password at next access, and every session opened with the old password stops working.
 */
export async function reinitialiserMotDePasseUtilisateur(
  id: string
): Promise<ActionResult<{ motDePasseTemporaire: string }>> {
  const guard = await requireAdmin()
  if ("error" in guard) return { ok: false, error: guard.error }
  const { admin } = guard

  if (id === admin.id) {
    return { ok: false, error: "Modifiez votre propre mot de passe depuis votre compte" }
  }

  const cible = await findTargetInOrganisation(id, admin.organisationId)
  if (!cible) return { ok: false, error: "Utilisateur introuvable" }

  const motDePasseTemporaire = genererMotDePasseTemporaire()
  try {
    await modifierUtilisateurAvecJournal(
      admin.organisationId,
      id,
      {
        passwordHash: await bcrypt.hash(motDePasseTemporaire, BCRYPT_COST),
        motDePasseTemporaire: true,
      },
      { utilisateurId: admin.id, action: "RESET_MOT_DE_PASSE", diff: { motDePasseTemporaire: true } }
    )
  } catch (error) {
    return erreurModification(error)
  }

  revalidatePath(ADMIN_PAGE)
  return { ok: true, motDePasseTemporaire }
}

export async function definirActiviteUtilisateur(id: string, actif: boolean): Promise<ActionResult> {
  const guard = await requireAdmin()
  if ("error" in guard) return { ok: false, error: guard.error }
  const { admin } = guard

  if (id === admin.id && !actif) {
    return { ok: false, error: "Vous ne pouvez pas désactiver votre propre compte" }
  }

  const cible = await findTargetInOrganisation(id, admin.organisationId)
  if (!cible) return { ok: false, error: "Utilisateur introuvable" }
  if (cible.actif === actif) return { ok: true }

  try {
    await modifierUtilisateurAvecJournal(
      admin.organisationId,
      id,
      { actif },
      { utilisateurId: admin.id, action: "UPDATE", diff: { actif } }
    )
  } catch (error) {
    return erreurModification(error)
  }

  revalidatePath(ADMIN_PAGE)
  return { ok: true }
}
