import { z } from "zod"

const valeurSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])

export const saveFicheSchema = z.object({
  id: z.string().min(1),
  typeTransactionCode: z.string().nullable(),
  valeurs: z.record(z.string(), valeurSchema),
  /** L'évaluateur a confirmé les avertissements non bloquants (§7.8.3). */
  forcerSauvegarde: z.boolean().optional(),
})

export type SaveFicheInput = z.infer<typeof saveFicheSchema>
