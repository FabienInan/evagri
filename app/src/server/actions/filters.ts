"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function listFilters() {
  return prisma.filtreRecherche.findMany({
    where: { organisationId: process.env.DEFAULT_ORGANISATION_ID || "" },
    orderBy: { ordreAffichage: "asc" },
    include: { champEnrichissable: true },
  })
}

export async function createFilter(formData: FormData) {
  const nomFiltre = formData.get("nomFiltre") as string
  const typeFiltre = formData.get("typeFiltre") as string
  const champEnrichissableId = formData.get("champEnrichissableId") as string
  const operateurs = formData.get("operateurs") as string
  const ordre = Number(formData.get("ordreAffichage") || 0)

  await prisma.filtreRecherche.create({
    data: {
      organisationId: process.env.DEFAULT_ORGANISATION_ID || "",
      nomFiltre,
      typeFiltre,
      champEnrichissableId,
      operateursDisponibles: operateurs ? JSON.parse(operateurs) : null,
      ordreAffichage: ordre,
    },
  })

  revalidatePath("/admin/filters")
}

export async function updateFilterOrder(
  filters: { id: string; ordreAffichage: number; estActif: boolean }[]
) {
  for (const f of filters) {
    await prisma.filtreRecherche.update({
      where: { id: f.id },
      data: { ordreAffichage: f.ordreAffichage, estActif: f.estActif },
    })
  }
  revalidatePath("/admin/filters")
}

export async function deleteFilter(id: string) {
  await prisma.filtreRecherche.delete({ where: { id } })
  revalidatePath("/admin/filters")
}
