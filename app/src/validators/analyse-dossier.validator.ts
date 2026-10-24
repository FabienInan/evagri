import { z } from "zod"
import { formatZodError } from "@/validators/common"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const optionalMontant = z.number().nonnegative("Une valeur de référence ne peut pas être négative.").nullable()

export const analyseDossierSchema = z.object({
  dossierId: z.string().min(1),
  dateEvaluation: z
    .string()
    .regex(DATE_REGEX, "La date d'évaluation est obligatoire.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "La date d'évaluation est invalide."),
  tauxCroissancePct: z
    .number({ message: "Le taux de croissance doit être un nombre." })
    .gt(-100, "Le taux de croissance doit être supérieur à -100 %.")
    .lte(100, "Le taux de croissance doit être inférieur ou égal à 100 %."),
  tauxBoiseRef: optionalMontant,
  tauxCultiveRef: optionalMontant,
  valeurBatimentRef: optionalMontant,
  valeurMaisonRef: optionalMontant,
  valeurTerrainResidentielRef: optionalMontant,
})

export const updateAnalyseDossierSchema = analyseDossierSchema.omit({ dossierId: true }).extend({
  id: z.string().min(1),
})

export type AnalyseDossierInput = z.infer<typeof analyseDossierSchema>
export type UpdateAnalyseDossierInput = z.infer<typeof updateAnalyseDossierSchema>

export function formatAnalyseDossierInputErrors(error: z.ZodError): string {
  return formatZodError(error, { preferIssueMessage: true, fallback: "Entrée invalide." })
}
