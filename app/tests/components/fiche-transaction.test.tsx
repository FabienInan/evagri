// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, fireEvent, screen, waitFor } from "@testing-library/react"

const saveFiche = vi.fn().mockResolvedValue({ ok: true })
const setFicheStatut = vi.fn().mockResolvedValue({ ok: true })
vi.mock("@/server/actions/fiche", () => ({
  saveFiche: (...args: unknown[]) => saveFiche(...args),
  setFicheStatut: (...args: unknown[]) => setFicheStatut(...args),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { FicheTransactionClient } from "@/components/fiche/fiche-transaction"
import type { SerializedFiche } from "@/serializers/fiche.serializer"
import type { ChampEnrichissableConfig } from "@/types/champ"

function champ(overrides: Partial<ChampEnrichissableConfig>): ChampEnrichissableConfig {
  return {
    id: "c1",
    codeMachine: "observations",
    nomAffichage: "Observations",
    typeDonnees: "TEXTE",
    nature: "SAISISSABLE",
    unite: "N/A",
    plageMin: null,
    plageMax: null,
    optionsListe: null,
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

function fiche(overrides: Partial<SerializedFiche> = {}): SerializedFiche {
  const c = champ({})
  return {
    transaction: {
      id: "t1",
      numeroInscription: "28780582",
      dateVente: null,
      prixVente: null,
      superficieTotaleHectare: null,
      latitude: null,
      longitude: null,
      vendeur: null,
      acheteur: null,
      lotsCadastraux: [],
      mrc: null,
      municipalite: null,
      adresse: null,
      importationId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      enrichment: {},
      enrichie: { statut: "A analyser" },
    },
    champs: [c],
    sections: [{ id: "s1", nom: "Section 1", ordre: 0, champs: [c.id] }],
    typologies: [],
    documents: [],
    statut: "A analyser",
    mode: "edition",
    ...overrides,
  }
}

describe("FicheTransactionClient — enregistrement", () => {
  beforeEach(() => {
    saveFiche.mockClear()
    setFicheStatut.mockClear()
  })

  it("sends the typed value to saveFiche when Enregistrer is clicked", async () => {
    render(<FicheTransactionClient fiche={fiche()} />)

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/i }))

    await waitFor(() => expect(saveFiche).toHaveBeenCalledTimes(1))
    const arg = saveFiche.mock.calls[0][0] as { valeurs: Record<string, unknown> }
    expect(arg.valeurs.observations).toBe("hello")
  })

  it("still sends the value when the field never fired a blur", async () => {
    render(<FicheTransactionClient fiche={fiche()} />)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "without-blur" } })
    // no blur
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/i }))
    await waitFor(() => expect(saveFiche).toHaveBeenCalledTimes(1))
    const arg = saveFiche.mock.calls[0][0] as { valeurs: Record<string, unknown> }
    expect(arg.valeurs.observations).toBe("without-blur")
  })

  it("surfaces a blocking validation error under the offending field", async () => {
    saveFiche.mockResolvedValueOnce({
      ok: false,
      error: "bloqué",
      errors: [{ code: "V-OBLIG", champ: "observations", message: "Le champ « Observations » est obligatoire." }],
    })
    render(<FicheTransactionClient fiche={fiche()} />)
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/i }))
    expect(await screen.findByText("Le champ « Observations » est obligatoire.")).toBeTruthy()
  })
})
