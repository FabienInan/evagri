"use client"

import { useMemo, useState } from "react"
import { Search, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { FilterConfig, FilterInput } from "@/types/filter"

type VirtualOption = { label: string; value: string }

const VIRTUAL_FILTER_OPTIONS: Record<string, VirtualOption[]> = {
  statut: [
    { label: "Analysée", value: "ANALYSEE" },
    { label: "À analyser", value: "NON_ANALYSEE" },
  ],
}

const VIRTUAL_FILTER_OPERATORS: Record<string, string[]> = {
  statut: ["="],
}

function filterLabel(f: FilterInput, config?: FilterConfig): string {
  if (f.id === "zone-geo") return "Zone géographique"
  if (f.id === "lot") return `Lot ${f.value}`
  if (config) return config.nomFiltre
  return f.field || f.id
}

function filterDisplayValue(f: FilterInput, config?: FilterConfig): string {
  if (f.id === "zone-geo") return "polygone"
  if (f.id === "lot") return f.value
  if (config?.codeMachine && VIRTUAL_FILTER_OPTIONS[config.codeMachine]) {
    const option = VIRTUAL_FILTER_OPTIONS[config.codeMachine].find((o) => o.value === f.value)
    return option?.label ?? f.value
  }
  return f.value
}

export function TransactionFilters({
  filtersConfig,
  onSearch,
  initialFilters = [],
}: {
  filtersConfig: FilterConfig[]
  onSearch: (filters: FilterInput[]) => void
  initialFilters?: FilterInput[]
}) {
  const defaultOperator = (type: FilterConfig["typeFiltre"]) => {
    switch (type) {
      case "PLAGE_NUMERIQUE":
      case "PLAGE_DATE":
        return "="
      case "LISTE":
      case "MULTI_SELECT":
        return "in"
      case "BOOLEEN":
      case "STATUT":
        return "="
      case "NUMERO_LOT":
        return "has"
      case "RECHERCHE_TEXTE":
      default:
        return "contient"
    }
  }

  const defaultTypeFiltre = (config?: FilterConfig): FilterInput["typeFiltre"] => {
    if (config?.codeMachine === "statut") return "STATUT"
    if (config?.champEnrichissable?.codeMachine === "typeTransaction") return "TYPE_TRANSACTION"
    if (config?.typeFiltre) {
      return config.typeFiltre as FilterInput["typeFiltre"]
    }
    return "RECHERCHE_TEXTE"
  }

  const initialValues = useMemo(() => {
    const values: Record<string, { operator: string; value: string }> = {}
    let lot = ""
    for (const f of initialFilters) {
      if (f.id === "lot") {
        lot = f.value
      } else {
        const config = filtersConfig.find((c) => c.id === f.id)
        const displayValue =
          config?.codeMachine && VIRTUAL_FILTER_OPTIONS[config.codeMachine]
            ? VIRTUAL_FILTER_OPTIONS[config.codeMachine].find((o) => o.value === f.value)?.label ?? f.value
            : f.value
        values[f.id] = { operator: f.operator || defaultOperator(defaultTypeFiltre(config)), value: displayValue }
      }
    }
    return { values, lot }
  }, [initialFilters, filtersConfig])

  const [values, setValues] = useState(initialValues.values)
  const [lotValue, setLotValue] = useState(initialValues.lot)
  const [activeFilters, setActiveFilters] = useState<FilterInput[]>(initialFilters)

  function buildFilters(
    nextValues: Record<string, { operator: string; value: string }>,
    nextLot: string,
    preserveGeo: FilterInput[] = []
  ): FilterInput[] {
    const active: FilterInput[] = Object.entries(nextValues)
      .filter(([_, v]) => v.value !== "")
      .map(([id, v]) => {
        const config = filtersConfig.find((f) => f.id === id)
        const field = config?.codeMachine || config?.champEnrichissable?.codeMachine || id
        const typeFiltre = defaultTypeFiltre(config)
        const virtualOptions = config?.codeMachine ? VIRTUAL_FILTER_OPTIONS[config.codeMachine] : undefined
        const virtualValue = virtualOptions?.find((o) => o.label === v.value)?.value
        return {
          id,
          typeFiltre,
          field,
          operator: v.operator as FilterInput["operator"],
          value: virtualValue ?? v.value,
        }
      })

    const lot = nextLot.trim()
    if (lot) {
      active.push({
        id: "lot",
        typeFiltre: "NUMERO_LOT",
        field: "lotsCadastraux",
        operator: "has",
        value: lot,
      })
    }

    return [...active, ...preserveGeo]
  }

  function handleSearch() {
    const geoFilters = activeFilters.filter((f) => f.id === "zone-geo")
    const next = buildFilters(values, lotValue, geoFilters)
    setActiveFilters(next)
    onSearch(next)
  }

  function removeFilter(id: string) {
    const nextActive = activeFilters.filter((f) => f.id !== id)
    setActiveFilters(nextActive)

    if (id === "lot") {
      setLotValue("")
    } else if (id === "zone-geo") {
      // geo filter is already removed above
    } else {
      setValues((prev) => ({
        ...prev,
        [id]: { operator: prev[id]?.operator || defaultOperator(defaultTypeFiltre(filtersConfig.find((c) => c.id === id))), value: "" },
      }))
    }

    const geoFilters = nextActive.filter((f) => f.id === "zone-geo")
    const nextValues =
      id === "lot"
        ? values
        : { ...values, [id]: { operator: values[id]?.operator || defaultOperator(defaultTypeFiltre(filtersConfig.find((c) => c.id === id))), value: "" } }
    const next = buildFilters(nextValues, id === "lot" ? "" : lotValue, geoFilters)
    onSearch(next)
  }

  function handleReset() {
    setValues({})
    setLotValue("")
    setActiveFilters([])
    onSearch([])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filtres</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f) => {
              const config = filtersConfig.find((c) => c.id === f.id)
              return (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs"
                >
                  <span className="font-medium">{filterLabel(f, config)}</span>
                  <span className="text-muted-foreground">{filterDisplayValue(f, config)}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter(f.id)}
                    className="ml-1 rounded-full p-0.5 hover:bg-background"
                    aria-label={`Retirer le filtre ${filterLabel(f, config)}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {filtersConfig
          .filter((f) => f.estActif)
          .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
          .map((f) => {
            const rawOptions = f.codeMachine
              ? VIRTUAL_FILTER_OPTIONS[f.codeMachine] || []
              : Array.isArray(f.champEnrichissable?.optionsListe)
                ? f.champEnrichissable.optionsListe.filter((o): o is string => typeof o === "string").map((o) => ({ label: o, value: o }))
                : []
            const operators = f.codeMachine
              ? VIRTUAL_FILTER_OPERATORS[f.codeMachine] || [defaultOperator(f.typeFiltre)]
              : f.operateursDisponibles || [defaultOperator(f.typeFiltre)]
            return (
              <div key={f.id} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{f.nomFiltre}</Label>
                <div className="flex gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={values[f.id]?.operator || defaultOperator(f.typeFiltre)}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [f.id]: { ...(prev[f.id] || { value: "" }), operator: e.target.value },
                      }))
                    }
                  >
                    {operators.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  {rawOptions.length > 0 ? (
                    <select
                      className="flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={values[f.id]?.value || ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [f.id]: { ...(prev[f.id] || { operator: defaultOperator(f.typeFiltre) }), value: e.target.value },
                        }))
                      }
                    >
                      <option value="">Tous</option>
                      {rawOptions.map((option) => (
                        <option key={option.value} value={option.label}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="flex-1 text-sm"
                      placeholder="valeur"
                      value={values[f.id]?.value || ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [f.id]: { ...(prev[f.id] || { operator: defaultOperator(f.typeFiltre) }), value: e.target.value },
                        }))
                      }
                    />
                  )}
                </div>
              </div>
            )
          })}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">N° de lot (revente)</Label>
          <Input
            placeholder="ex: 123"
            value={lotValue}
            onChange={(e) => setLotValue(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSearch} className="flex-1 gap-2">
            <Search className="h-4 w-4" />
            Rechercher
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset} aria-label="Réinitialiser les filtres">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
