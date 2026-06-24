"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type FilterConfig = {
  id: string
  nomFiltre: string
  typeFiltre: string
  estActif: boolean
  champEnrichissable?: { codeMachine: string; typeDonnees: string } | null
  operateursDisponibles?: string[] | null
  ordreAffichage: number
}

export function TransactionFilters({
  filtersConfig,
  onSearch,
}: {
  filtersConfig: FilterConfig[]
  onSearch: (filters: any[]) => void
}) {
  const [values, setValues] = useState<Record<
    string,
    { operator: string; value: string }
  >>({})
  const [lotValue, setLotValue] = useState("")

  const defaultOperator = (type: string) => {
    switch (type) {
      case "PLAGE_NUMERIQUE":
      case "PLAGE_DATE":
        return "="
      case "LISTE":
      case "MULTI_SELECT":
        return "in"
      case "BOOLEEN":
        return "="
      case "RECHERCHE_TEXTE":
      default:
        return "contient"
    }
  }

  function handleSearch() {
    const active = Object.entries(values)
      .filter(([_, v]) => v.value !== "")
      .map(([id, v]) => {
        const config = filtersConfig.find((f) => f.id === id)
        const field = config?.champEnrichissable?.codeMachine || id
        return {
          id,
          typeFiltre: config?.typeFiltre || "RECHERCHE_TEXTE",
          field,
          operator: v.operator,
          value: v.value,
        }
      })

    const lot = lotValue.trim()
    if (lot) {
      active.push({
        id: "lot",
        typeFiltre: "NUMERO_LOT",
        field: "lotsCadastraux",
        operator: "has",
        value: lot,
      })
    }

    onSearch(active)
  }

  return (
    <div className="space-y-3 mb-4">
      <p className="font-medium">Filtres</p>
      {filtersConfig
        .filter((f) => f.estActif)
        .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
        .map((f) => {
          const operators = f.operateursDisponibles || [defaultOperator(f.typeFiltre)]
          return (
            <div key={f.id} className="flex gap-2 items-center">
              <span className="w-40 text-sm">{f.nomFiltre}</span>
              <select
                className="border rounded p-1 text-sm"
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
            </div>
          )
        })}
      <div className="flex gap-2 items-center">
        <span className="w-40 text-sm">N° de lot (revente)</span>
        <Input
          className="flex-1 text-sm"
          placeholder="ex: 123"
          value={lotValue}
          onChange={(e) => setLotValue(e.target.value)}
        />
      </div>
      <Button onClick={handleSearch}>Rechercher</Button>
    </div>
  )
}
