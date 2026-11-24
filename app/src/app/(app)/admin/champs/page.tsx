export const dynamic = "force-dynamic"

import { exigerZonePage } from "@/lib/session"
import { ChampsPageClient } from "@/components/champs-page-client"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { getEffectiveFicheLayout } from "@/server/fiche-layout"

export default async function ChampsAdminPage() {
  const utilisateur = await exigerZonePage("configuration")
  const orgId = utilisateur.organisationId

  const [champs, typologies, sections] = await Promise.all([
    listChampsEnrichissablesByOrganisation(orgId),
    listTypologiesByOrganisation(orgId),
    getEffectiveFicheLayout(orgId),
  ])

  return <ChampsPageClient champs={champs} typologies={typologies} initialSections={sections} />
}
