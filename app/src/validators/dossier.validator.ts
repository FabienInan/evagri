import { z } from "zod"
import { formatZodError } from "@/validators/common"
import { NUMERO_LOT_REGEX, estDansQuebec, formatNumeroLot } from "@/lib/lot-cadastral"

/** Numéro de dossier au format AA-AA-AAA (§7.7), chiffres uniquement : 2 chiffres, 2 chiffres, 3 chiffres. */
export const NUMERO_DOSSIER_REGEX = /^\d{2}-\d{2}-\d{3}$/

/** Date au format AAAA-MM-JJ (date d'évaluation du dossier). */
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Lots d'un dossier : même format que l'import (chiffres, espaces facultatifs), stockés groupés par trois. */
export const lotsCadastrauxSchema = z
  .array(
    z
      .string()
      .trim()
      .regex(NUMERO_LOT_REGEX, "Numéro de lot invalide : chiffres uniquement (ex. 4 128 182).")
      .transform(formatNumeroLot)
  )
  .min(1, "Saisissez au moins un numéro de lot.")
  .max(5, "Un dossier accepte au plus 5 numéros de lot.")
  .transform((lots) => Array.from(new Set(lots)))

export const createDossierSchema = z.object({
  numeroDossier: z
    .string()
    .trim()
    .regex(NUMERO_DOSSIER_REGEX, "Format attendu : AA-AA-AAA, chiffres uniquement (ex. 25-12-001)."),
  nom: z.string().trim().max(200).optional(),
  dateEvaluation: z.string().regex(DATE_ISO_REGEX, "La date d'évaluation est obligatoire."),
  lotsCadastraux: lotsCadastrauxSchema,
  /** Coordonnées saisies à la main, utilisées seulement si aucun lot n'est trouvé dans le cadastre. */
  latitude: z.number({ message: "Latitude invalide." }).min(-90).max(90).optional(),
  longitude: z.number({ message: "Longitude invalide." }).min(-180).max(180).optional(),
}).superRefine((d, ctx) => {
  if ((d.latitude === undefined) !== (d.longitude === undefined)) {
    ctx.addIssue({ code: "custom", message: "Saisissez la latitude et la longitude ensemble.", path: ["latitude"] })
  } else if (d.latitude !== undefined && d.longitude !== undefined && !estDansQuebec(d.latitude, d.longitude)) {
    ctx.addIssue({ code: "custom", message: "Coordonnées hors du territoire québécois.", path: ["latitude"] })
  }
})

export const previewLotsSchema = z.object({ lotsCadastraux: lotsCadastrauxSchema })

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
