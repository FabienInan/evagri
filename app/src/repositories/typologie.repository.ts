import { prisma } from "@/lib/prisma"

export interface TypologieOption {
  id: string
  code: string
  nom: string
  parentId: string | null
}

export async function listTypologiesByOrganisation(organisationId: string): Promise<TypologieOption[]> {
  const typologies = await prisma.typologie.findMany({
    where: { organisationId, actif: true },
    orderBy: { ordre: "asc" },
    select: { id: true, code: true, nom: true, parentId: true },
  })
  return typologies
}

