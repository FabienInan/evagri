export const dynamic = "force-dynamic"

import { UtilisateursAdmin } from "@/components/utilisateurs-admin"
import { exigerZonePage } from "@/lib/session"
import { listUtilisateursByOrganisation } from "@/repositories/utilisateur.repository"

export default async function UtilisateursAdminPage() {
  const admin = await exigerZonePage("administration")

  const utilisateurs = await listUtilisateursByOrganisation(admin.organisationId)
  return (
    <UtilisateursAdmin
      utilisateurs={utilisateurs.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      currentUserId={admin.id}
    />
  )
}
