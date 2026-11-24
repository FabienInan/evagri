import { describe, it, expect, vi, beforeEach } from "vitest"

// Prisma stand-in: $transaction runs its callback against `tx`, the client a real transaction would receive.
const db = vi.hoisted(() => {
  const tx = {
    utilisateur: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
    journalAudit: { create: vi.fn() },
  }
  return {
    tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: db }))

import { Prisma } from "@prisma/client"
import {
  DernierAdministrateurError,
  modifierUtilisateurAvecJournal,
} from "@/repositories/utilisateur.repository"

const ORG = "org-1"
const journal = { utilisateurId: "admin-1", action: "UPDATE", diff: { actif: false } }

function cible(role: string, actif = true) {
  db.tx.utilisateur.findFirst.mockResolvedValue({ id: "cible", organisationId: ORG, role, actif })
}

describe("garde du dernier administrateur (repository)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.tx.utilisateur.update.mockResolvedValue({ id: "cible" })
  })

  it("retire les droits d'un administrateur quand un autre administrateur actif reste", async () => {
    cible("ADMIN")
    db.tx.utilisateur.count.mockResolvedValue(1)

    await modifierUtilisateurAvecJournal(ORG, "cible", { role: "EVALUATEUR" }, { ...journal, diff: { role: "EVALUATEUR" } })

    expect(db.tx.utilisateur.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cible" } }))
    expect(db.tx.journalAudit.create).toHaveBeenCalledTimes(1)
  })

  it("refuse de retirer le dernier administrateur actif, sans rien écrire ni journaliser", async () => {
    cible("ADMIN")
    db.tx.utilisateur.count.mockResolvedValue(0)

    await expect(
      modifierUtilisateurAvecJournal(ORG, "cible", { actif: false }, journal)
    ).rejects.toBeInstanceOf(DernierAdministrateurError)
    expect(db.tx.utilisateur.update).not.toHaveBeenCalled()
    expect(db.tx.journalAudit.create).not.toHaveBeenCalled()
  })

  it("compte les autres administrateurs actifs, en excluant la cible", async () => {
    cible("ADMIN")
    db.tx.utilisateur.count.mockResolvedValue(2)

    await modifierUtilisateurAvecJournal(ORG, "cible", { actif: false }, journal)

    expect(db.tx.utilisateur.count).toHaveBeenCalledWith({
      where: { organisationId: ORG, role: "ADMIN", actif: true, NOT: { id: "cible" } },
    })
  })

  it("ne fait aucun contrôle pour un utilisateur qui n'est pas administrateur", async () => {
    cible("EVALUATEUR")

    await modifierUtilisateurAvecJournal(ORG, "cible", { actif: false }, journal)

    expect(db.tx.utilisateur.count).not.toHaveBeenCalled()
    expect(db.tx.utilisateur.update).toHaveBeenCalled()
  })

  it("ne fait aucun contrôle pour un administrateur déjà inactif", async () => {
    cible("ADMIN", false)

    await modifierUtilisateurAvecJournal(ORG, "cible", { role: "EVALUATEUR" }, journal)

    expect(db.tx.utilisateur.count).not.toHaveBeenCalled()
  })

  it("ne fait aucun contrôle quand l'administrateur garde son rôle", async () => {
    cible("ADMIN")

    await modifierUtilisateurAvecJournal(ORG, "cible", { passwordHash: "h", motDePasseTemporaire: true }, journal)

    expect(db.tx.utilisateur.count).not.toHaveBeenCalled()
  })

  it("exécute la transaction en isolation sérialisable (deux rétrogradations simultanées ne passent pas ensemble)", async () => {
    cible("ADMIN")
    db.tx.utilisateur.count.mockResolvedValue(1)

    await modifierUtilisateurAvecJournal(ORG, "cible", { actif: false }, journal)

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it("écrit l'entrée de journal avec le client de la transaction, pas le client global", async () => {
    cible("EVALUATEUR")

    await modifierUtilisateurAvecJournal(ORG, "cible", { actif: false }, journal)

    expect(db.tx.journalAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableCible: "utilisateur", enregistrementId: "cible", action: "UPDATE" }),
    })
  })
})
