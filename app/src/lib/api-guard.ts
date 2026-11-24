import { NextResponse } from "next/server"
import { getCurrentUser, peutAcceder, type Zone } from "@/lib/session"

/**
 * Backend guard for route handlers. Call it first in every handler that reads or writes data:
 * it returns a 401 without a valid session, a 403 when a password change is due or the role lacks
 * the zone, and null when the handler may proceed.
 */
export async function gardeApi(zone: Zone): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  if (user.motDePasseTemporaire) {
    return NextResponse.json({ error: "Changement de mot de passe requis" }, { status: 403 })
  }
  if (!peutAcceder(user.role, zone)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
  return null
}
