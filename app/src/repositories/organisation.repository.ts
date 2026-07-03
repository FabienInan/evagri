import { prisma } from "@/lib/prisma"

const DEFAULT_ORGANISATION_ID = process.env.DEFAULT_ORGANISATION_ID || ""

export function getCurrentOrganisationId(): string {
  if (!DEFAULT_ORGANISATION_ID) {
    throw new Error("DEFAULT_ORGANISATION_ID n'est pas configuré")
  }
  return DEFAULT_ORGANISATION_ID
}

export async function findDefaultOrganisation() {
  return prisma.organisation.findFirst({
    where: { id: getCurrentOrganisationId() },
  })
}
