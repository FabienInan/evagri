import type { FilterOperator, FilterType } from "@/types/filter"

export const DEFAULT_OPERATEURS: Record<FilterType, FilterOperator[]> = {
  PLAGE_NUMERIQUE: ["=", "+", "-", "entre"],
  PLAGE_DATE: ["=", "+", "-", "entre"],
  LISTE: ["in"],
  MULTI_SELECT: ["in"],
  RECHERCHE_TEXTE: ["contient"],
  BOOLEEN: ["="],
  NUMERO_LOT: ["has"],
  TYPE_TRANSACTION: ["in"],
  STATUT: ["="],
  ZONE_GEO: ["in"],
  REVENTE: ["="],
}
