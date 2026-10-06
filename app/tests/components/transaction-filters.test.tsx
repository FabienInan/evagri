// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent, screen } from "@testing-library/react"
import { TransactionFilters } from "@/components/transaction-filters"
import type { FilterConfig, FilterInput } from "@/types/filter"

// jsdom n'implémente pas ResizeObserver, dont dépendent les primitives Radix (le Switch « Reventes »).
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

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
const BOOL_CONFIG = [
  makeFilter({ typeFiltre: "BOOLEEN", operateursDisponibles: ["="], optionsListe: null }),
]
const NO_FILTERS: FilterInput[] = []
const NO_CONFIG: FilterConfig[] = []

function findMultiSelectTrigger() {
  return document.querySelector('[aria-haspopup="listbox"]') as HTMLElement | null
}

function findBooleanSelect() {
  return Array.from(document.querySelectorAll("select")).find((s) =>
    Array.from(s.options).some((o) => o.value === "true")
  )
}

describe("TransactionFilters multi-sélection", () => {
  it("rend un select multiple (dropdown) pour un filtre MULTI_SELECT", async () => {
    render(
      <TransactionFilters
        filtersConfig={MULTI_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={() => {}}
      />
    )

    const trigger = findMultiSelectTrigger()
    expect(trigger).toBeTruthy()
    // Ce n'est pas un <select multiple> natif mais un dropdown : une option par valeur, sans « Tous ».
    expect(Array.from(document.querySelectorAll("select")).some((s) => s.multiple)).toBe(false)
    fireEvent.click(trigger as HTMLElement)
    expect(document.querySelectorAll('[role="listbox"] [role="option"]')).toHaveLength(3)
  })

  it("ne rend PAS de select multiple pour un filtre LISTE, même avec l'opérateur « in »", () => {
    render(
      <TransactionFilters
        filtersConfig={LISTE_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={() => {}}
      />
    )
    expect(findMultiSelectTrigger()).toBeFalsy()
  })

  it("joint les valeurs sélectionnées par des virgules à la recherche", async () => {
    const onSearch = vi.fn()
    render(
      <TransactionFilters
        filtersConfig={MULTI_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={onSearch}
      />
    )

    fireEvent.click(findMultiSelectTrigger() as HTMLElement)
    fireEvent.click(await screen.findByRole("option", { name: "Argile" }))
    fireEvent.click(screen.getByRole("option", { name: "Limon" }))

    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    expect(onSearch).toHaveBeenCalledTimes(1)
    const filters = onSearch.mock.calls[0][0]
    const f = filters.find((x: { id: string }) => x.id === "f1")
    expect(f.value).toBe("Argile,Limon")
    expect(f.operator).toBe("in")
  })
})

describe("TransactionFilters booléen", () => {
  it("rend un select Oui/Non (et non un champ texte) pour un filtre BOOLEEN", () => {
    render(
      <TransactionFilters
        filtersConfig={BOOL_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={() => {}}
      />
    )

    const boolean = findBooleanSelect()
    expect(boolean).toBeTruthy()
    const labels = Array.from(boolean!.options).map((o) => o.textContent)
    expect(labels).toEqual(["Tous", "Oui", "Non"])
    // Filtre pur booléen : ni champ texte de valeur, ni sélecteur d'opérateur.
    expect(document.querySelector("input[placeholder='valeur']")).toBeFalsy()
    expect(document.querySelectorAll("select")).toHaveLength(1)
  })

  it("envoie « true » pour Oui et « false » pour Non", () => {
    const onSearch = vi.fn()
    render(
      <TransactionFilters
        filtersConfig={BOOL_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={onSearch}
      />
    )

    const boolean = findBooleanSelect() as HTMLSelectElement
    fireEvent.change(boolean, { target: { value: "true" } })
    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    expect(onSearch).toHaveBeenCalledTimes(1)
    const f = onSearch.mock.calls[0][0].find((x: { id: string }) => x.id === "f1")
    expect(f.value).toBe("true")
    expect(f.typeFiltre).toBe("BOOLEEN")
    expect(f.operator).toBe("=")
  })
})

describe("TransactionFilters reventes", () => {
  it("n'ajoute aucun filtre revente tant que l'interrupteur est éteint", () => {
    const onSearch = vi.fn()
    render(
      <TransactionFilters
        filtersConfig={NO_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={onSearch}
      />
    )

    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)
    expect(onSearch).toHaveBeenCalledWith([])
  })

  it("pousse un filtre REVENTE quand l'interrupteur est activé", () => {
    const onSearch = vi.fn()
    render(
      <TransactionFilters
        filtersConfig={NO_CONFIG}
        initialFilters={NO_FILTERS}
        onSearch={onSearch}
      />
    )

    const toggle = document.querySelector('[data-slot="switch"]') as HTMLElement
    expect(toggle).toBeTruthy()
    fireEvent.click(toggle)
    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    expect(onSearch).toHaveBeenCalledTimes(1)
    const filters = onSearch.mock.calls[0][0]
    expect(filters).toHaveLength(1)
    expect(filters[0]).toMatchObject({ id: "revente", typeFiltre: "REVENTE", value: "true" })
  })

  it("réactive l'interrupteur quand la recherche initiale contient un filtre revente", () => {
    const init: FilterInput[] = [
      { id: "revente", typeFiltre: "REVENTE", field: "revente", operator: "=", value: "true" },
    ]
    render(
      <TransactionFilters filtersConfig={NO_CONFIG} initialFilters={init} onSearch={() => {}} />
    )

    const toggle = document.querySelector('[data-slot="switch"]') as HTMLElement
    expect(toggle.getAttribute("data-state")).toBe("checked")
  })
})
