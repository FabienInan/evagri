import { exigerZonePage } from "@/lib/session"
import { listDossiers } from "@/repositories/dossier.repository"
import { serializeDossier } from "@/serializers/dossier.serializer"
import { DossiersPageClient } from "@/components/dossier/dossiers-page-client"

export const dynamic = "force-dynamic"

export default async function DossiersPage() {
  const utilisateur = await exigerZonePage("evaluation")
  const organisationId = utilisateur.organisationId
  const dossiers = (await listDossiers(organisationId)).map(serializeDossier)
  return <DossiersPageClient dossiers={dossiers} />
}
