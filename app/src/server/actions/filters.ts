"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import type { FilterConfig, FilterOperator, FilterType } from "@/types/filter"
import { createFilterSchema, type CreateFilterInput } from "@/validators/filter.validator"

export type { CreateFilterInput } from "@/validators/filter.validator"
import {
  createFilter as createFilterRepo,
  deleteFilter as deleteFilterRepo,
  findChampsByOrganisation,
  findFilterByChampId,
  findFilterByCodeMachine,
  findFiltersByOrganisation,
  updateFiltersOrder,
  type CreateFilterRepositoryInput,
} from "@/repositories/filters.repository"
import { findChampForOrganisation } from "@/repositories/champs.repository"

export async function listFilters() {
  const organisationId = getCurrentOrganisationId()
  return findFiltersByOrganisation(organisationId)
}

export async function listChamps() {
  const organisationId = getCurrentOrganisationId()
  return findChampsByOrganisation(organisationId)
}

/** Server actions return errors instead of throwing them: in production Next.js masks the message of a
 *  thrown action error, so a validation message would reach the user as a generic error. */
export type FilterActionResult = { ok: true } | { ok: false; error: string }

/** A creation returns the created filter so callers can update local state without reloading. */
export type CreateFilterResult =
  | { ok: true; filter: FilterConfig & { champId: string | null } }
  | { ok: false; error: string }

export async function createFilter(input: CreateFilterInput): Promise<CreateFilterResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = createFilterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Données invalides." }
  }

  if (parsed.data.champId) {
    const champ = await findChampForOrganisation(organisationId, parsed.data.champId)
    if (!champ) {
      return { ok: false, error: "Champ introuvable." }
    }

    const existing = await findFilterByChampId(organisationId, parsed.data.champId)
    if (existing) {
      return { ok: false, error: "Un filtre existe déjà pour ce champ." }
    }
  }

  if (parsed.data.codeMachine) {
    const existing = await findFilterByCodeMachine(organisationId, parsed.data.codeMachine)
    if (existing) {
      return { ok: false, error: "Un filtre existe déjà pour ce code virtuel." }
    }
  }

  // Typed as the repository's checked create input: `champ` is a relation (nested connect), not the raw
  // `champId` FK, which Prisma rejects at runtime. The annotation keeps that mistake a compile error.
  const data: CreateFilterRepositoryInput = {
    organisation: { connect: { id: organisationId } },
    nomFiltre: parsed.data.nomFiltre,
    typeFiltre: parsed.data.typeFiltre,
    champ: parsed.data.champId ? { connect: { id: parsed.data.champId } } : undefined,
    codeMachine: parsed.data.codeMachine,
    operateursDisponibles:
      parsed.data.operateurs as CreateFilterRepositoryInput["operateursDisponibles"],
    ordreAffichage: parsed.data.ordreAffichage,
  }

  let created
  try {
    created = await createFilterRepo(data)
  } catch (error) {
    // A concurrent request can win the uniqueness race after the pre-checks above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: parsed.data.champId
          ? "Un filtre existe déjà pour ce champ."
          : "Un filtre existe déjà pour ce code virtuel.",
      }
    }
    throw error
  }

  revalidatePath("/admin/filters")
  return {
    ok: true,
    filter: {
      id: created.id,
      nomFiltre: created.nomFiltre,
      typeFiltre: created.typeFiltre as FilterType,
      champId: created.champId,
      codeMachine: created.codeMachine,
      operateursDisponibles: (created.operateursDisponibles as FilterOperator[] | null) ?? null,
      ordreAffichage: created.ordreAffichage,
      estActif: created.estActif,
      champ: created.champ,
    },
  }
}

export async function publishFilters(
  filters: {
    id: string
    ordreAffichage: number
    estActif: boolean
    typeFiltre?: FilterType
    operateursDisponibles?: FilterOperator[] | null
  }[]
): Promise<FilterActionResult> {
  const organisationId = getCurrentOrganisationId()
  await updateFiltersOrder(organisationId, filters)
  revalidatePath("/admin/filters")
  return { ok: true }
}

export async function deleteFilter(id: string): Promise<FilterActionResult> {
  const organisationId = getCurrentOrganisationId()
  const deleted = await deleteFilterRepo(organisationId, id)
  if (!deleted) {
    return { ok: false, error: "Filtre introuvable." }
  }
  revalidatePath("/admin/filters")
  return { ok: true }
}
