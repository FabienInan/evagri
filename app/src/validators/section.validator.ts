import { z } from "zod"

export const sectionSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  ordre: z.number().int(),
  champs: z.array(z.string()),
})

export const sectionsSchema = z.array(sectionSchema)

export type SectionInput = z.infer<typeof sectionSchema>
