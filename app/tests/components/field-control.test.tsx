// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent, screen } from "@testing-library/react"
import { FieldControl } from "@/components/fiche/field-control"
import type { ChampEnrichissableConfig } from "@/types/champ"

function champ(overrides: Partial<ChampEnrichissableConfig>): ChampEnrichissableConfig {
  return {
    id: "c1",
    codeMachine: "type_de_culture",
    nomAffichage: "Type de culture",
    typeDonnees: "MULTI_SELECT",
    nature: "SAISISSABLE",
    unite: "N/A",
    plageMin: null,
    plageMax: null,
    optionsListe: ["Prairie", "Vigne", "Autres"],
    regleCalcul: null,
    applicableATypes: [],
    ordreAffichage: 0,
    estAffiche: true,
    estObligatoire: false,
    estModifiable: true,
    actif: true,
    ...overrides,
  }
}

function trigger(): HTMLElement {
  return document.querySelector('[aria-haspopup="listbox"]') as HTMLElement
}

describe("FieldControl MULTI_SELECT", () => {
  it("renders as a select-shaped trigger showing the selected values, not a textarea", async () => {
    render(<FieldControl champ={champ({})} valeur="Prairie, Vigne" onChange={() => {}} />)
    expect(trigger().textContent).toContain("Prairie, Vigne")
    fireEvent.click(trigger())
    expect((await screen.findByRole("option", { name: "Prairie" })).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("option", { name: "Vigne" }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("option", { name: "Autres" }).getAttribute("aria-selected")).toBe("false")
    expect(document.querySelector("textarea")).toBeNull()
  })

  it("keeps an out-of-list value selectable in the list", async () => {
    render(<FieldControl champ={champ({})} valeur="Friche" onChange={() => {}} />)
    expect(trigger().textContent).toContain("Friche")
    fireEvent.click(trigger())
    expect((await screen.findByRole("option", { name: "Friche" })).getAttribute("aria-selected")).toBe("true")
    // The catalogued options are still offered for new selections.
    expect(screen.getByRole("option", { name: "Prairie" }).getAttribute("aria-selected")).toBe("false")
  })

  it("adds a clicked option, preserving order, and reports the joined value", async () => {
    const onChange = vi.fn()
    render(<FieldControl champ={champ({})} valeur="Prairie" onChange={onChange} />)
    fireEvent.click(trigger())
    fireEvent.click(await screen.findByRole("option", { name: "Vigne" }))
    expect(onChange).toHaveBeenCalledWith("Prairie, Vigne")
  })

  it("removes a selected option and clears the field when the last one goes", async () => {
    const onChange = vi.fn()
    render(<FieldControl champ={champ({})} valeur="Prairie" onChange={onChange} />)
    fireEvent.click(trigger())
    fireEvent.click(await screen.findByRole("option", { name: "Prairie" }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("disables the trigger when the champ is not modifiable", () => {
    render(<FieldControl champ={champ({ estModifiable: false })} valeur="Prairie" onChange={() => {}} />)
    expect((trigger() as HTMLButtonElement).disabled).toBe(true)
  })
})
