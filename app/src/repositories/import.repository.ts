import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function findTypologieByCode(
  organisationId: string,
  code: string
) {
  return prisma.typologie.findUnique({
    where: { organisationId_code: { organisationId, code } },
  })
}

export async function createImportation(
  organisationId: string,
  typeSource: string,
  statut: string = "EN_COURS"
) {
  return prisma.importation.create({
    data: {
      organisationId,
      typeSource,
      statut,
      lignesTotal: 0,
      lignesInserees: 0,
      lignesIgnorees: 0,
      lignesErreurs: 0,
    },
  })
}

export interface ImportationResultInput {
  statut: string
  lignesTotal: number
  lignesInserees: number
  lignesIgnorees: number
  lignesErreurs: number
  details?: Prisma.InputJsonValue
}

export async function updateImportationResults(
  importationId: string,
  input: ImportationResultInput
) {
  return prisma.importation.update({
    where: { id: importationId },
    data: {
      statut: input.statut,
      lignesTotal: input.lignesTotal,
      lignesInserees: input.lignesInserees,
      lignesIgnorees: input.lignesIgnorees,
      lignesErreurs: input.lignesErreurs,
      details: input.details,
    },
  })
}

export interface ImportationCounterDelta {
  lignesTotal?: number
  lignesInserees?: number
  lignesIgnorees?: number
  lignesErreurs?: number
}

/** Incremental progress updates so the UI reflects a running import. */
export async function incrementImportationCounters(
  importationId: string,
  delta: ImportationCounterDelta
) {
  return prisma.importation.update({
    where: { id: importationId },
    data: {
      ...(delta.lignesTotal ? { lignesTotal: { increment: delta.lignesTotal } } : {}),
      ...(delta.lignesInserees ? { lignesInserees: { increment: delta.lignesInserees } } : {}),
      ...(delta.lignesIgnorees ? { lignesIgnorees: { increment: delta.lignesIgnorees } } : {}),
      ...(delta.lignesErreurs ? { lignesErreurs: { increment: delta.lignesErreurs } } : {}),
    },
  })
}

export async function markImportationFailed(
  importationId: string,
  error: Error
) {
  return prisma.importation.update({
    where: { id: importationId },
    data: {
      statut: "EN_ECHEC",
      lignesErreurs: 1,
      details: { error: error.message },
    },
  })
}

export async function findImportationById(
  importationId: string,
  organisationId: string
) {
  return prisma.importation.findFirst({
    where: { id: importationId, organisationId },
  })
}

export async function listImports(
  organisationId: string,
  options: { take?: number } = {}
) {
  return prisma.importation.findMany({
    where: { organisationId },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 50,
  })
}

export async function resetImportForRetry(importationId: string) {
  return prisma.importation.update({
    where: { id: importationId },
    data: { statut: "EN_COURS", lignesErreurs: 0, details: {} },
  })
}
