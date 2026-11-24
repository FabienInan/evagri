"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { findDefaultOrganisation } from "@/repositories/organisation.repository"
import { createAuditLog } from "@/repositories/audit.repository"
import type { AuthActionResult } from "@/server/actions/auth"

const BCRYPT_COST = 12

const setupSchema = z
  .object({
    nom: z.string().trim().min(1, "Le nom est requis").max(200),
    email: z.string().trim().toLowerCase().email("Courriel invalide"),
    password: z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères").max(200),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmation"],
  })

class SetupDejaFait extends Error {}

/** Creates the first administrator in the existing organisation. Refused once any user exists. */
export async function createPremierAdministrateur(formData: FormData): Promise<AuthActionResult> {
  const parsed = setupSchema.safeParse({
    nom: formData.get("nom"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" }
  }

  const organisation = await findDefaultOrganisation()
  if (!organisation) {
    return { ok: false, error: "Organisation introuvable : vérifiez DEFAULT_ORGANISATION_ID" }
  }

  const { nom, email, password } = parsed.data
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

  try {
    const admin = await prisma.$transaction(
      async (tx) => {
        if ((await tx.utilisateur.count()) > 0) throw new SetupDejaFait()
        return tx.utilisateur.create({
          data: { organisationId: organisation.id, email, nom, role: "ADMIN", passwordHash },
        })
      },
      { isolationLevel: "Serializable" }
    )

    await createAuditLog({
      organisationId: organisation.id,
      tableCible: "utilisateur",
      enregistrementId: admin.id,
      utilisateurId: admin.id,
      action: "CREATE_PREMIER_ADMINISTRATEUR",
      diff: { role: "ADMIN", email },
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof SetupDejaFait) {
      return { ok: false, error: "La configuration initiale est déjà faite." }
    }
    throw error
  }
}
