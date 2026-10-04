import { z } from "zod"
import { FILTER_OPERATORS, FILTER_TYPES } from "@/types/filter"
import { TRANSACTION_SOURCE_FIELDS } from "@/lib/transaction-source-fields"

/** Only columns flagged sortable in the table are accepted: an arbitrary field name would otherwise reach
 *  Prisma's orderBy and fail (or sort on an unexpected relation) at query time. */
const SORTABLE_FIELDS = TRANSACTION_SOURCE_FIELDS.filter((f) => f.sortable).map((f) => f.key)

export const filterInputSchema = z.object({
  id: z.string().min(1),
  typeFiltre: z.enum(FILTER_TYPES),
  field: z.string().min(1),
  operator: z.enum(FILTER_OPERATORS),
  value: z.string(),
})

export type FilterInputSchema = z.infer<typeof filterInputSchema>

export const filterArraySchema = z.array(filterInputSchema)

export const filterSearchParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Bounded so a hand-crafted pageSize cannot ask the database for an unbounded page.
  pageSize: z.coerce.number().int().positive().max(200).default(25),
  sortField: z
    .string()
    .refine((value) => SORTABLE_FIELDS.includes(value), { message: "Champ de tri invalide." })
    .default("dateVente"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  filters: z
    .string()
    .default("[]")
    .transform((s) => {
      try {
        return JSON.parse(s)
      } catch {
        return []
      }
    })
    .pipe(filterArraySchema),
})

export const filterMapParamsSchema = z.object({
  filters: z
    .string()
    .default("[]")
    .transform((s) => {
      try {
        return JSON.parse(s)
      } catch {
        return []
      }
    })
    .pipe(filterArraySchema),
})

export function parseFilterArray(raw: unknown): import("@/types/filter").FilterInput[] {
  if (typeof raw === "string") {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    const result = filterArraySchema.safeParse(parsed)
    return result.success ? result.data : []
  }

  const result = filterArraySchema.safeParse(raw)
  return result.success ? result.data : []
}
