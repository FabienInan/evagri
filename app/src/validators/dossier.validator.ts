import { z } from "zod"
import { formatZodError } from "@/validators/common"

/** Numéro de dossier au format AA-AA-AAA (§7.7), chiffres uniquement : 2 chiffres, 2 chiffres, 3 chiffres. */
export const NUMERO_DOSSIER_REGEX = /^\d{2}-\d{2}-\d{3}$/

export const createDossierSchema = z.object({
  numeroDossier: z
    .string()
    .trim()
    .regex(NUMERO_DOSSIER_REGEX, "Format attendu : AA-AA-AAA, chiffres uniquement (ex. 25-12-001)."),
  nom: z.string().trim().max(200).optional(),
})

export const createPanierSchema = z.object({
  dossierId: z.string().min(1),
  nom: z.string().trim().min(1, "Le nom du panier est requis.").max(200),
  typeTransactionId: z.string().min(1).nullable().optional(),
})

export const addTransactionsSchema = z.object({
  panierId: z.string().min(1),
  transactionIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins une transaction."),
})

export type CreateDossierInput = z.infer<typeof createDossierSchema>
export type CreatePanierInput = z.infer<typeof createPanierSchema>
export type AddTransactionsInput = z.infer<typeof addTransactionsSchema>

/** Aplatit un ZodError en une phrase lisible (motif `formatChampInputErrors` de `lib/champs.ts`). */
export function formatDossierInputErrors(error: z.ZodError): string {
  return formatZodError(error, { preferIssueMessage: true, fallback: "Entrée invalide." })
}
