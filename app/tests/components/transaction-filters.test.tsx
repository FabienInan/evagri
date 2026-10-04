// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { TransactionFilters } from "@/components/transaction-filters"
import type { FilterConfig, FilterInput } from "@/types/filter"

function makeFilter(overrides: Partial<FilterConfig> = {}): FilterConfig {
  return {
    id: "f1",
    nomFiltre: "Type de sol",
    typeFiltre: "MULTI_SELECT",
    estActif: true,
    codeMachine: null,
    operateursDisponibles: ["in"],
    optionsListe: ["Argile", "Sable", "Limon"],
    ordreAffichage: 1,
    ...overrides,
  }
}

// Références stables au niveau module : des props inline recréées à chaque rendu
// re-déclenchent l'effet de resynchronisation du composant → boucle de rendu infinie.
const MULTI_CONFIG = [makeFilter()]
const LISTE_CONFIG = [makeFilter({ typeFiltre: "LISTE" })]
const NO_FILTERS: FilterInput[] = []

function findMultipleSelect() {
  return Array.from(document.querySelectorAll("select")).find((s) => s.multiple)
}

describe("TransactionFilters multi-sélection", () => {
  it("rend un select multiple pour un filtre MULTI_SELECT", () => {
    render(
      <TransactionFilters
        filtersConfig={MULTI_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={() => {}}
      />
    )

    const multiple = findMultipleSelect()
    expect(multiple).toBeTruthy()
    // Une option par valeur, sans option vide « Tous » en mode multiple.
    expect(multiple!.querySelectorAll("option")).toHaveLength(3)
  })

  it("ne rend PAS de select multiple pour un filtre LISTE, même avec l'opérateur « in »", () => {
    render(
      <TransactionFilters
        filtersConfig={LISTE_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={() => {}}
      />
    )
    expect(findMultipleSelect()).toBeFalsy()
  })

  it("joint les valeurs sélectionnées par des virgules à la recherche", () => {
    const onSearch = vi.fn()
    render(
      <TransactionFilters
        filtersConfig={MULTI_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={onSearch}
      />
    )

    const multiple = findMultipleSelect() as HTMLSelectElement
    multiple.options[0].selected = true // Argile
    multiple.options[2].selected = true // Limon
    fireEvent.change(multiple)

    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    expect(onSearch).toHaveBeenCalledTimes(1)
    const filters = onSearch.mock.calls[0][0]
    const f = filters.find((x: { id: string }) => x.id === "f1")
    expect(f.value).toBe("Argile,Limon")
    expect(f.operator).toBe("in")
  })
})
