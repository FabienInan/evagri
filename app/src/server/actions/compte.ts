"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { getCurrentUser } from "@/lib/session"
import { findUtilisateurById, modifierUtilisateurAvecJournal } from "@/repositories/utilisateur.repository"
import type { ActionResult } from "@/server/actions/types"

const BCRYPT_COST = 12

const changementSchema = z
  .object({
    actuel: z.string().min(1, "Mot de passe actuel requis"),
    nouveau: z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères").max(200),
    confirmation: z.string(),
  })
  .refine((d) => d.nouveau === d.confirmation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmation"],
  })
  .refine((d) => d.nouveau !== d.actuel, {
    message: "Le nouveau mot de passe doit être différent de l'actuel",
    path: ["nouveau"],
  })

/**
 * The signed-in user changes their own password. The current password is required, so a session
 * left open on a shared computer cannot change it. The caller must sign in again afterwards.
 */
export async function changerMotDePasse(formData: FormData): Promise<ActionResult> {
  // Deliberately not assertZone: a user with a temporary password must be able to reach this action.
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Session expirée, reconnectez-vous" }

  const parsed = changementSchema.safeParse({
    actuel: formData.get("actuel"),
    nouveau: formData.get("nouveau"),
    confirmation: formData.get("confirmation"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" }

  const utilisateur = await findUtilisateurById(user.id)
  if (!utilisateur) return { ok: false, error: "Session expirée, reconnectez-vous" }
  if (!(await bcrypt.compare(parsed.data.actuel, utilisateur.passwordHash))) {
    return { ok: false, error: "Mot de passe actuel incorrect" }
  }

  try {
    await modifierUtilisateurAvecJournal(
      user.organisationId,
      user.id,
      {
        passwordHash: await bcrypt.hash(parsed.data.nouveau, BCRYPT_COST),
        motDePasseTemporaire: false,
      },
      { utilisateurId: user.id, action: "CHANGE_MOT_DE_PASSE", diff: { motDePasseTemporaire: false } }
    )
  } catch (error) {
    console.error("compte: échec du changement de mot de passe", error)
    return { ok: false, error: "Impossible de changer le mot de passe. Réessayez." }
  }

  return { ok: true }
}
