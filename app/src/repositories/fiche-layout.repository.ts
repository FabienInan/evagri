import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import type { FicheSection } from "@/types/champ"

const TYPE_VUE_FICHE_TRANSACTION = "FICHE_TRANSACTION"

interface FicheLayoutContenu {
  sections: FicheSection[]
}

export async function findFicheLayout(organisationId: string): Promise<FicheSection[]> {
  const vue = await prisma.vueFicheEvaluation.findFirst({
    where: { organisationId, typeVue: TYPE_VUE_FICHE_TRANSACTION },
  })
  const contenu = vue?.contenu as FicheLayoutContenu | undefined
  return contenu?.sections ?? []
}

export async function saveFicheLayout(organisationId: string, sections: FicheSection[]): Promise<void> {
  const contenu = { sections } as unknown as Prisma.InputJsonValue

  // updateMany (not findFirst+update): it both updates every row for this org/type and reports how many
  // existed, so a create is attempted only when there is genuinely nothing to update — avoiding the
  // duplicate-row race the previous findFirst+create opened. VueFicheEvaluation has no unique constraint
  // to lean on, so the count is the guard.
  const result = await prisma.vueFicheEvaluation.updateMany({
    where: { organisationId, typeVue: TYPE_VUE_FICHE_TRANSACTION },
    data: { contenu },
  })

  if (result.count === 0) {
    await prisma.vueFicheEvaluation.create({
      data: { organisationId, typeVue: TYPE_VUE_FICHE_TRANSACTION, contenu },
    })
  }
}
