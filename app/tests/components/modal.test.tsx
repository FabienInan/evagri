// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { createPortal } from "react-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import { Modal } from "@/components/dossier/modal"

describe("Modal", () => {
  it("se ferme avec la croix, le fond et la touche Échap", () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" onClose={onClose}>
        <p>contenu</p>
      </Modal>
    )

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
    fireEvent.click(screen.getByRole("dialog", { name: "Test" }).parentElement as HTMLElement)
    fireEvent.keyDown(window, { key: "Escape" })

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it("ne se ferme pas quand on clique dans son contenu", () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" onClose={onClose}>
        <button type="button">action</button>
      </Modal>
    )

    fireEvent.click(screen.getByRole("button", { name: "action" }))

    expect(onClose).not.toHaveBeenCalled()
  })

  // Régression : les listes déroulantes (Radix Select) rendent leurs options dans un portail, hors de la fenêtre.
  // Un clic sur une option remonte l'arbre React : il ne doit ni fermer la fenêtre ni être perdu.
  it("ne se ferme pas quand on clique dans un contenu rendu par portail (options de liste)", () => {
    const onClose = vi.fn()
    const onPick = vi.fn()
    const Portal = () =>
      createPortal(
        <button type="button" role="option" onClick={onPick}>
          Terres cultivées
        </button>,
        document.body
      )
    render(
      <Modal title="Test" onClose={onClose}>
        <Portal />
      </Modal>
    )

    fireEvent.click(screen.getByRole("option", { name: "Terres cultivées" }))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
