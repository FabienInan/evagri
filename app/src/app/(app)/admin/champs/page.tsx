export const dynamic = "force-dynamic"

import { ChampsPageClient } from "@/components/champs-page-client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { findFicheLayout } from "@/repositories/fiche-layout.repository"

export default async function ChampsAdminPage() {
  const orgId = getCurrentOrganisationId()

  const [champs, typologies, sections] = await Promise.all([
    listChampsEnrichissablesByOrganisation(orgId),
    listTypologiesByOrganisation(orgId),
    findFicheLayout(orgId),
  ])

  return <ChampsPageClient champs={champs} typologies={typologies} initialSections={sections} />
}
