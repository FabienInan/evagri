import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listDossiers } from "@/repositories/dossier.repository"
import { serializeDossier } from "@/serializers/dossier.serializer"
import { DossiersPageClient } from "@/components/dossier/dossiers-page-client"

export const dynamic = "force-dynamic"

export default async function DossiersPage() {
  const organisationId = getCurrentOrganisationId()
  const dossiers = (await listDossiers(organisationId)).map(serializeDossier)
  return <DossiersPageClient dossiers={dossiers} />
}
