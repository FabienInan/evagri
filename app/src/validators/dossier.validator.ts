import { z } from "zod"
import { formatZodError } from "@/validators/common"

/** Numéro de dossier au format AA-AA-AAA (§7.7), chiffres uniquement : 2 chiffres, 2 chiffres, 3 chiffres. */
export const NUMERO_DOSSIER_REGEX = /^\d{2}-\d{2}-\d{3}$/

/** Date au format AAAA-MM-JJ (date d'évaluation du dossier). */
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const createDossierSchema = z.object({
  numeroDossier: z
    .string()
    .trim()
    .regex(NUMERO_DOSSIER_REGEX, "Format attendu : AA-AA-AAA, chiffres uniquement (ex. 25-12-001)."),
  nom: z.string().trim().max(200).optional(),
  dateEvaluation: z.string().regex(DATE_ISO_REGEX, "La date d'évaluation est obligatoire."),
})

export const createPanierSchema = z.object({
  dossierId: z.string().min(1),
  nom: z.string().trim().min(1, "Le nom du panier est requis.").max(200),
  typeTransactionId: z.string().min(1).nullable().optional(),
  /** Taux de croissance annuel en pourcentage (ex. 3.25), utilisé à l'export. */
  tauxCroissancePct: z
    .number({ message: "Le taux de croissance est obligatoire." })
    .min(0, "Le taux de croissance ne peut pas être négatif.")
    .max(100, "Le taux de croissance doit être inférieur à 100 %."),
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
