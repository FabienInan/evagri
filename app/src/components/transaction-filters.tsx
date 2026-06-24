"use client"

import { useState } from "react"
import { Search, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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

  function handleReset() {
    setValues({})
    setLotValue("")
    onSearch([])
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filtres</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtersConfig
          .filter((f) => f.estActif)
          .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
          .map((f) => {
            const operators = f.operateursDisponibles || [defaultOperator(f.typeFiltre)]
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
