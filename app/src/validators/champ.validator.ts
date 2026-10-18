import { z } from "zod"
import { NATURE_CHAMP, TYPE_DONNEES_CHAMP } from "@/types/champ"

export const CHAMP_FIELD_LABELS: Record<string, string> = {
  codeMachine: "Code machine",
  nomAffichage: "Nom affiché",
  typeDonnees: "Type de données",
  nature: "Nature",
  unite: "Unité",
  plageMin: "Plage minimale",
  plageMax: "Plage maximale",
  optionsListe: "Options de liste",
  regleCalcul: "Règle de calcul",
  applicableATypes: "Types de transaction applicables",
  ordreAffichage: "Ordre d'affichage",
  estAffiche: "Affiché sur la fiche",
  estObligatoire: "Obligatoire",
}

export const champInputSchema = z.object({
  codeMachine: z.string().min(1),
  nomAffichage: z.string().min(1),
  typeDonnees: z.enum(TYPE_DONNEES_CHAMP),
  nature: z.enum(NATURE_CHAMP),
  unite: z.string(),
  plageMin: z.number().nullable(),
  plageMax: z.number().nullable(),
  optionsListe: z.array(z.string()).nullable(),
  regleCalcul: z.string().nullable(),
  applicableATypes: z.array(z.string()),
  ordreAffichage: z.number().int(),
  estAffiche: z.boolean(),
  estObligatoire: z.boolean(),
  estLectureSeule: z.boolean().optional(),
})

export type ChampInput = z.infer<typeof champInputSchema>
