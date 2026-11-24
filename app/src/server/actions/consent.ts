"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/session"
import { enregistrerConsentementAvecJournal } from "@/repositories/utilisateur.repository"
import type { ActionResult } from "@/server/actions/types"

/** Records the current user's acceptance of the privacy policy (Loi 25). Idempotent. */
export async function accepterPolitiqueConfidentialite(): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Session expirée, reconnectez-vous" }
  if (user.consentementPolitiqueAt) return { ok: true }

  try {
    await enregistrerConsentementAvecJournal(user.organisationId, user.id, new Date(), {
      utilisateurId: user.id,
      action: "CONSENT_POLITIQUE",
      diff: { politique: "confidentialite" },
    })
  } catch (error) {
    console.error("consent: échec d'enregistrement", error)
    return { ok: false, error: "Impossible d'enregistrer votre acceptation. Réessayez." }
  }

  revalidatePath("/", "layout")
  return { ok: true }
}
