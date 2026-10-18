// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"

const listDossiers = vi.fn()
const listPaniersForDossier = vi.fn()
const addTransactionsToPanier = vi.fn()

vi.mock("@/server/actions/dossier", () => ({
  listDossiers: () => listDossiers(),
  listPaniersForDossier: (id: string) => listPaniersForDossier(id),
  addTransactionsToPanier: (input: unknown) => addTransactionsToPanier(input),
}))

beforeEach(() => {
  localStorage.clear()
  listDossiers.mockReset()
  listPaniersForDossier.mockReset()
  addTransactionsToPanier.mockReset()
  listDossiers.mockResolvedValue([
    { id: "d1", numeroDossier: "25-AB-001", nom: "Essai", createdAt: "2026-01-01T00:00:00.000Z", panierCount: 1 },
  ])
  listPaniersForDossier.mockResolvedValue([
    { id: "p1", nom: "Comparables", dossierId: "d1", numeroDossier: "25-AB-001", typeTransactionId: null, typeTransactionNom: null, createdAt: "2026-01-01T00:00:00.000Z", transactionCount: 0 },
  ])
})

describe("AddToPanierDialog", () => {
  it("charge les dossiers à l'ouverture", async () => {
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)
    await waitFor(() => expect(listDossiers).toHaveBeenCalled())
  })

  it("ajoute les transactions au panier choisi puis referme la modale", async () => {
    addTransactionsToPanier.mockResolvedValue({ ok: true, added: 1 })
    const onOpenChange = vi.fn()
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={onOpenChange} />)
    await waitFor(() => expect(listDossiers).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText("Dossier"), { target: { value: "d1" } })
    await waitFor(() => expect(listPaniersForDossier).toHaveBeenCalledWith("d1"))
    fireEvent.change(screen.getByLabelText("Panier"), { target: { value: "p1" } })
    fireEvent.click(screen.getByRole("button", { name: /ajouter/i }))

    await waitFor(() =>
      expect(addTransactionsToPanier).toHaveBeenCalledWith({ panierId: "p1", transactionIds: ["t1"] })
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("préremplit le dialogue avec le dernier couple dossier/panier", async () => {
    localStorage.setItem(
      "evagri:current-panier",
      JSON.stringify({ dossierId: "d1", panierId: "p1" })
    )
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)

    await waitFor(() =>
      expect((screen.getByLabelText("Dossier") as HTMLSelectElement).value).toBe("d1")
    )
    await waitFor(() =>
      expect((screen.getByLabelText("Panier") as HTMLSelectElement).value).toBe("p1")
    )
  })

  it("affiche une erreur si aucun panier n'est choisi", async () => {
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)
    await waitFor(() => expect(listDossiers).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: /ajouter/i }))
    expect(await screen.findByText(/Sélectionnez un panier/i)).toBeTruthy()
    expect(addTransactionsToPanier).not.toHaveBeenCalled()
  })
})
