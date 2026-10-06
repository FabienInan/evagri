"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
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
import { MultiSelect } from "@/components/ui/multi-select"
import { Switch } from "@/components/ui/switch"
import type { FilterConfig, FilterInput } from "@/types/filter"
import { isSourceFieldCode } from "@/lib/transaction-source-fields"
import { parseMultiValue } from "@/lib/multi-value"
import { cn } from "@/lib/utils"

type VirtualOption = { label: string; value: string }

const VIRTUAL_FILTER_OPTIONS: Record<string, VirtualOption[]> = {
  statut: [
    { label: "Analysée", value: "Analysée" },
    { label: "A analyser", value: "A analyser" },
  ],
}

const VIRTUAL_FILTER_OPERATORS: Record<string, string[]> = {
  statut: ["="],
}

function filterLabel(f: FilterInput, config?: FilterConfig): string {
  if (f.id === "zone-geo") return "Zone géographique"
  if (f.id === "revente") return "Reventes"
  if (config) return config.nomFiltre
  return f.field || f.id
}

function filterDisplayValue(f: FilterInput, config?: FilterConfig): string {
  if (f.id === "zone-geo") return "polygone"
  if (f.id === "revente") return "lots vendus 2 fois"
  if (f.typeFiltre === "BOOLEEN") return f.value === "true" ? "Oui" : "Non"
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
  scrollable = false,
}: {
  filtersConfig: FilterConfig[]
  onSearch: (filters: FilterInput[]) => void
  initialFilters?: FilterInput[]
  /** Sur desktop, la carte remplit la hauteur disponible et seule la zone des champs défile :
   *  les boutons Rechercher/Réinitialiser restent visibles, hors du scroll. */
  scrollable?: boolean
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
    let revente = false
    for (const f of initialFilters) {
      if (f.id === "revente") {
        revente = true
      } else {
        const config = filtersConfig.find((c) => c.id === f.id)
        const displayValue =
          config?.codeMachine && VIRTUAL_FILTER_OPTIONS[config.codeMachine]
            ? VIRTUAL_FILTER_OPTIONS[config.codeMachine].find((o) => o.value === f.value)?.label ?? f.value
            : f.value
        values[f.id] = { operator: f.operator || defaultOperator(defaultTypeFiltre(config)), value: displayValue }
      }
    }
    return { values, revente }
  }, [initialFilters, filtersConfig])

  const [values, setValues] = useState(initialValues.values)
  const [revente, setRevente] = useState(initialValues.revente)
  const [activeFilters, setActiveFilters] = useState<FilterInput[]>(initialFilters)

  // Resync with the URL-backed filters: a filter applied elsewhere (e.g. a map geo selection) would
  // otherwise never appear as a chip, because state is only seeded from the prop on first render.
  useEffect(() => {
    setValues(initialValues.values)
    setRevente(initialValues.revente)
    setActiveFilters(initialFilters)
  }, [initialValues, initialFilters])

  function buildFilters(
    nextValues: Record<string, { operator: string; value: string }>,
    nextRevente: boolean,
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

    if (nextRevente) {
      active.push({
        id: "revente",
        typeFiltre: "REVENTE",
        field: "revente",
        operator: "=",
        value: "true",
      })
    }

    return [...active, ...preserveGeo]
  }

  function handleSearch() {
    const geoFilters = activeFilters.filter((f) => f.id === "zone-geo")
    const next = buildFilters(values, revente, geoFilters)
    setActiveFilters(next)
    onSearch(next)
  }

  function removeFilter(id: string) {
    const nextActive = activeFilters.filter((f) => f.id !== id)
    setActiveFilters(nextActive)

    if (id === "revente") {
      setRevente(false)
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
      id === "revente"
        ? values
        : { ...values, [id]: { operator: values[id]?.operator || defaultOperator(defaultTypeFiltre(filtersConfig.find((c) => c.id === id))), value: "" } }
    const next = buildFilters(nextValues, id === "revente" ? false : revente, geoFilters)
    onSearch(next)
  }

  function handleReset() {
    setValues({})
    setRevente(false)
    setActiveFilters([])
    onSearch([])
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    handleSearch()
  }

  return (
    <Card className={cn(scrollable && "lg:h-full lg:min-h-0")}>
      <CardHeader className={cn(scrollable && "shrink-0")}>
        <CardTitle className="text-base">Filtres</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "space-y-4",
          scrollable && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"
        )}
      >
      <form
        onSubmit={handleFormSubmit}
        className={cn("space-y-4", scrollable && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col")}
      >
      <div className={cn("space-y-4", scrollable && "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1")}>
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
            const isVirtual = !!f.codeMachine && !isSourceFieldCode(f.codeMachine)
            const rawOptions = isVirtual
              ? VIRTUAL_FILTER_OPTIONS[f.codeMachine as string] || []
              : Array.isArray(f.optionsListe)
                ? f.optionsListe
                    .filter((o): o is string => typeof o === "string")
                    .map((o) => ({ label: o, value: o }))
                : []
            const operators = isVirtual
              ? VIRTUAL_FILTER_OPERATORS[f.codeMachine as string] || [defaultOperator(f.typeFiltre)]
              : f.operateursDisponibles || [defaultOperator(f.typeFiltre)]
            const currentOperator = values[f.id]?.operator || defaultOperator(f.typeFiltre)
            // Seuls les filtres de type MULTI_SELECT acceptent plusieurs valeurs (jointes par des
            // virgules) ; un filtre LISTE reste mono-valeur même avec l'opérateur « in ».
            const isMultiple = f.typeFiltre === "MULTI_SELECT" && rawOptions.length > 0
            const isBoolean = f.typeFiltre === "BOOLEEN"
            return (
              <div key={f.id} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{f.nomFiltre}</Label>
                <div className="flex min-w-0 gap-2">
                  {!isBoolean && (
                    <select
                      className="h-9 w-16 shrink-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={currentOperator}
                      onChange={(e) => {
                        const nextOperator = e.target.value
                        setValues((prev) => {
                          const previous = prev[f.id] ?? { operator: nextOperator, value: "" }
                          // En quittant « in », on ne garde que la première valeur pour ne pas envoyer
                          // "a,b" comme valeur unique d'un opérateur mono-valeur.
                          const value =
                            nextOperator === "in"
                              ? previous.value
                              : previous.value.split(",")[0] ?? ""
                          return { ...prev, [f.id]: { operator: nextOperator, value } }
                        })
                      }}
                    >
                      {operators.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}
                  {rawOptions.length > 0 ? (
                    isMultiple ? (
                      <MultiSelect
                        className="h-9 min-w-0 flex-1"
                        options={rawOptions.map((option) => option.label)}
                        selected={parseMultiValue(values[f.id]?.value)}
                        onChange={(selected) =>
                          setValues((prev) => ({
                            ...prev,
                            [f.id]: { ...(prev[f.id] || { operator: currentOperator }), value: selected.join(",") },
                          }))
                        }
                      />
                    ) : (
                      <select
                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    )
                  ) : isBoolean ? (
                    <select
                      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={values[f.id]?.value || ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [f.id]: { ...(prev[f.id] || { operator: defaultOperator(f.typeFiltre) }), value: e.target.value },
                        }))
                      }
                    >
                      <option value="">Tous</option>
                      <option value="true">Oui</option>
                      <option value="false">Non</option>
                    </select>
                  ) : (
                    <Input
                      className="min-w-0 flex-1 text-sm"
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

        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="filtre-revente"
            className="text-xs font-medium text-muted-foreground"
          >
            Reventes (lots vendus 2 fois)
          </Label>
          <Switch id="filtre-revente" checked={revente} onCheckedChange={setRevente} />
        </div>
      </div>

        <div className="flex shrink-0 gap-2 pt-2">
          <Button type="submit" className="flex-1 gap-2">
            <Search className="h-4 w-4" />
            Rechercher
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={handleReset} aria-label="Réinitialiser les filtres">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </form>
      </CardContent>
    </Card>
  )
}
