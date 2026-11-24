import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"
import { isRole, pageAccueil, peutAcceder, type Role, type Zone } from "@/lib/roles"
import { findUtilisateurById } from "@/repositories/utilisateur.repository"

export { ROLES, isRole, peutAcceder, pageAccueil, ZONES, ZONES_PAR_ROLE } from "@/lib/roles"
export type { Role, Zone } from "@/lib/roles"

/** Page where a user must choose a new password before anything else. */
export const PAGE_CHANGEMENT_MOT_DE_PASSE = "/compte/mot-de-passe"

export type CurrentUser = {
  id: string
  email: string
  nom: string | null
  organisationId: string
  role: Role
  consentementPolitiqueAt: Date | null
  /** Set by an administrator's reset: the user must change the password before using the application. */
  motDePasseTemporaire: boolean
}

/**
 * The user behind the current session, re-read from the database on every call: a deactivated
 * account, a role change or a password reset applies immediately. A session issued before the
 * last password change is refused.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth()
  const id = session?.user?.id
  const empreinte = session?.user?.empreinte
  if (!id || !empreinte) return null

  const utilisateur = await findUtilisateurById(id)
  if (!utilisateur || !utilisateur.actif || !isRole(utilisateur.role)) return null
  if (empreinteMotDePasse(utilisateur.passwordHash) !== empreinte) return null

  return {
    id: utilisateur.id,
    email: utilisateur.email,
    nom: utilisateur.nom,
    organisationId: utilisateur.organisationId,
    role: utilisateur.role,
    consentementPolitiqueAt: utilisateur.consentementPolitiqueAt,
    motDePasseTemporaire: utilisateur.motDePasseTemporaire,
  }
}

export async function getCurrentAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser()
  return user?.role === "ADMIN" && !user.motDePasseTemporaire ? user : null
}

export const MESSAGE_ACCES_NON_AUTORISE = "Accès non autorisé"

export type VerificationZone = { ok: true; utilisateur: CurrentUser } | { ok: false; error: string }

/**
 * For server actions that return `{ ok, error }`: the caller when signed in, past any forced password change, and
 * holding the zone; otherwise an error result. Never throws: a thrown action error is masked in production.
 */
export async function verifierZone(zone: Zone): Promise<VerificationZone> {
  const user = await getCurrentUser()
  if (!user || user.motDePasseTemporaire || !peutAcceder(user.role, zone)) {
    return { ok: false, error: MESSAGE_ACCES_NON_AUTORISE }
  }
  return { ok: true, utilisateur: user }
}

/** For server-rendered pages: redirects instead of rendering content outside the caller's zones. */
export async function exigerZonePage(zone: Zone): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.motDePasseTemporaire) redirect(PAGE_CHANGEMENT_MOT_DE_PASSE)
  if (!peutAcceder(user.role, zone)) redirect(pageAccueil(user.role))
  return user
}

/** Zones granted to the current user, for building navigation. Empty when signed out or when a password change is due. */
export async function zonesDeLUtilisateur(): Promise<Zone[]> {
  const user = await getCurrentUser()
  if (!user || user.motDePasseTemporaire) return []
  return (["evaluation", "configuration", "administration"] as const).filter((z) => peutAcceder(user.role, z))
}

/** The current user when their role has the zone and no password change is due, otherwise null. For reads that degrade to empty rather than fail. */
export async function utilisateurPourZone(zone: Zone): Promise<CurrentUser | null> {
  const user = await getCurrentUser()
  if (!user || user.motDePasseTemporaire || !peutAcceder(user.role, zone)) return null
  return user
}
