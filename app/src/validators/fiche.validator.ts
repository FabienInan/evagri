import { z } from "zod"

const valeurSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])

export const saveFicheSchema = z.object({
  id: z.string().min(1),
  typeTransactionCode: z.string().nullable(),
  valeurs: z.record(z.string(), valeurSchema),
})

export type SaveFicheInput = z.infer<typeof saveFicheSchema>
