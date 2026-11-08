// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"

const addTransactionsToPanier = vi.fn()
let currentPanier: { dossierId: string; dossierNumero?: string; panierId: string; panierNom?: string } | null = null

vi.mock("@/server/actions/dossier", () => ({
  addTransactionsToPanier: (input: unknown) => addTransactionsToPanier(input),
}))

vi.mock("@/components/current-panier-context", () => ({
  useCurrentPanier: () => ({ current: currentPanier, chooseDossier: vi.fn(), choosePanier: vi.fn() }),
}))

beforeEach(() => {
  addTransactionsToPanier.mockReset()
  currentPanier = null
})

describe("AddToPanierDialog", () => {
  it("n'a pas de sélecteur de dossier ni de panier : il ajoute au panier courant", () => {
    currentPanier = { dossierId: "d1", dossierNumero: "25-12-001", panierId: "p1", panierNom: "Comparables" }
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)

    expect(screen.queryByLabelText("Dossier")).toBeNull()
    expect(screen.queryByLabelText("Panier")).toBeNull()
    expect(screen.getByText("Comparables")).toBeTruthy()
    expect(screen.getByText("Dossier 25-12-001")).toBeTruthy()
  })

  it("désactive Ajouter et explique où choisir le panier quand aucun n'est courant", () => {
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)

    expect(screen.getByRole("button", { name: "Ajouter" }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByText(/barre latérale/)).toBeTruthy()
  })

  it("ajoute les transactions au panier courant et ferme la fenêtre", async () => {
    currentPanier = { dossierId: "d1", panierId: "p1", panierNom: "Comparables" }
    addTransactionsToPanier.mockResolvedValue({ ok: true })
    const onOpenChange = vi.fn()
    render(<AddToPanierDialog transactionIds={["t1", "t2"]} open onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(addTransactionsToPanier).toHaveBeenCalledWith({ panierId: "p1", transactionIds: ["t1", "t2"] })
  })

  it("affiche l'erreur serveur et garde la fenêtre ouverte", async () => {
    currentPanier = { dossierId: "d1", panierId: "p1", panierNom: "Comparables" }
    addTransactionsToPanier.mockResolvedValue({ ok: false, error: "Panier introuvable." })
    const onOpenChange = vi.fn()
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }))

    await waitFor(() => expect(screen.getByText("Panier introuvable.")).toBeTruthy())
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
