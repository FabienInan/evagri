import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  verifierZone: vi.fn(),
  findTransactionFiche: vi.fn(),
  saveFicheValuesAvecJournal: vi.fn(),
  updateFicheStatutAvecJournal: vi.fn(),
  listChampsEnrichissablesByOrganisation: vi.fn(),
  buildStorageEntries: vi.fn(),
  validateFiche: vi.fn(),
  warningsFiche: vi.fn(),
  withRecomputedIndicateurs: vi.fn(),
}))

vi.mock("@/lib/session", () => ({ verifierZone: mocks.verifierZone }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/server/journal", () => ({ journaliser: vi.fn() }))
vi.mock("@/repositories/fiche.repository", () => ({
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  findTransactionFiche: mocks.findTransactionFiche,
  saveFicheValuesAvecJournal: mocks.saveFicheValuesAvecJournal,
  updateFicheStatutAvecJournal: mocks.updateFicheStatutAvecJournal,
}))
vi.mock("@/repositories/champs.repository", () => ({
  listChampsEnrichissablesByOrganisation: mocks.listChampsEnrichissablesByOrganisation,
}))
vi.mock("@/repositories/typologie.repository", () => ({ listTypologiesByOrganisation: vi.fn(async () => []) }))
vi.mock("@/server/fiche-layout", () => ({ getEffectiveFicheLayout: vi.fn(async () => []) }))
vi.mock("@/serializers/transaction.serializer", () => ({ serializeTransaction: vi.fn(() => ({ fields: {} })) }))
vi.mock("@/lib/file-storage", () => ({ saveActePDF: vi.fn() }))
vi.mock("@/lib/fiche", () => ({
  buildStorageEntries: mocks.buildStorageEntries,
  resolveTypeTransaction: vi.fn(() => null),
  validateFiche: mocks.validateFiche,
  warningsFiche: mocks.warningsFiche,
  withRecomputedIndicateurs: mocks.withRecomputedIndicateurs,
}))

import { saveFiche, setFicheStatut } from "@/server/actions/fiche"

const ORG = "org-1"
const EVALUATEUR = { id: "eval-1", organisationId: ORG, role: "EVALUATEUR" }
const dateStatut = new Date("2026-01-10T00:00:00Z")

function transaction(valeurs: { champId: string; valeurNombre: number | null }[] = []) {
  return {
    id: "t-1",
    statut: "NON_ANALYSEE",
    dateStatut,
    valeurs: valeurs.map((v) => ({
      valeurTexte: null,
      valeurTexteMultiple: [],
      valeurBooleen: null,
      valeurDate: null,
      ...v,
    })),
  }
}

describe("contributeur de la fiche (§7.5.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifierZone.mockResolvedValue({ ok: true, utilisateur: EVALUATEUR })
    mocks.findTransactionFiche.mockResolvedValue(transaction())
    mocks.listChampsEnrichissablesByOrganisation.mockResolvedValue([])
    mocks.withRecomputedIndicateurs.mockImplementation((_champs: unknown, fields: unknown) => fields)
    mocks.validateFiche.mockReturnValue([])
    mocks.warningsFiche.mockReturnValue([])
    mocks.updateFicheStatutAvecJournal.mockResolvedValue(undefined)
  })

  it("passer à « Analysée » enregistre l'évaluateur comme contributeur, avec la date", async () => {
    const result = await setFicheStatut("t-1", "ANALYSEE")

    expect(result).toEqual({ ok: true })
    expect(mocks.updateFicheStatutAvecJournal).toHaveBeenCalledWith(
      ORG,
      "t-1",
      "ANALYSEE",
      expect.any(Date),
      "eval-1",
      expect.objectContaining({
        utilisateurId: "eval-1",
        action: "STATUT",
        diff: { statut: "ANALYSEE", contributeurId: "eval-1" },
      })
    )
  })

  it("retour à « Non analysée » ne touche pas au contributeur historique", async () => {
    mocks.findTransactionFiche.mockResolvedValue({ ...transaction(), statut: "ANALYSEE" })

    const result = await setFicheStatut("t-1", "NON_ANALYSEE")

    expect(result).toEqual({ ok: true })
    // undefined : le repository n'écrit pas la colonne, le contributeur enregistré reste en place.
    expect(mocks.updateFicheStatutAvecJournal).toHaveBeenCalledWith(
      ORG,
      "t-1",
      "NON_ANALYSEE",
      dateStatut,
      undefined,
      expect.objectContaining({ diff: { statut: "NON_ANALYSEE" } })
    )
  })

  it("refuse un statut hors liste sans toucher à la transaction", async () => {
    const result = await setFicheStatut("t-1", "SUPPRIMEE")

    expect(result).toEqual({ ok: false, error: "Statut invalide." })
    expect(mocks.updateFicheStatutAvecJournal).not.toHaveBeenCalled()
  })

  it("renvoie un refus { ok, error } sans lever d'exception quand la zone manque", async () => {
    mocks.verifierZone.mockResolvedValue({ ok: false, error: "Accès non autorisé" })

    await expect(setFicheStatut("t-1", "ANALYSEE")).resolves.toEqual({ ok: false, error: "Accès non autorisé" })
    await expect(saveFiche({ id: "t-1", valeurs: {}, typeTransactionCode: null })).resolves.toEqual({
      ok: false,
      error: "Accès non autorisé",
    })
    expect(mocks.findTransactionFiche).not.toHaveBeenCalled()
  })

  it("une panne d'enregistrement du statut devient une erreur lisible, pas une exception", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.updateFicheStatutAvecJournal.mockRejectedValueOnce(new Error("panne"))

    const result = await setFicheStatut("t-1", "NON_ANALYSEE")

    expect(result).toEqual({ ok: false, error: "Impossible de changer le statut. Réessayez." })
    vi.mocked(console.error).mockRestore()
  })
})

describe("journal de la sauvegarde de fiche", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifierZone.mockResolvedValue({ ok: true, utilisateur: EVALUATEUR })
    mocks.listChampsEnrichissablesByOrganisation.mockResolvedValue([
      { id: "c1", codeMachine: "PRIX_VENTE", nomAffichage: "Prix de vente" },
      { id: "c2", codeMachine: "SUPERFICIE", nomAffichage: "Superficie" },
      { id: "c3", codeMachine: "COMMENTAIRE", nomAffichage: "Commentaire" },
    ])
    mocks.saveFicheValuesAvecJournal.mockResolvedValue(undefined)
  })

  it("décrit chaque champ modifié : nom, ancienne valeur et nouvelle valeur", async () => {
    mocks.findTransactionFiche.mockResolvedValue(
      transaction([
        { champId: "c1", valeurNombre: 100000 },
        { champId: "c2", valeurNombre: 12 },
      ])
    )
    mocks.buildStorageEntries.mockReturnValue([
      { champId: "c1", valeurNombre: 250000, valeurTexte: null, valeurTexteMultiple: [], valeurBooleen: null, valeurDate: null },
      { champId: "c2", valeurNombre: 12, valeurTexte: null, valeurTexteMultiple: [], valeurBooleen: null, valeurDate: null },
      { champId: "c3", valeurNombre: null, valeurTexte: "Vente entre proches", valeurTexteMultiple: [], valeurBooleen: null, valeurDate: null },
    ])

    const result = await saveFiche({ id: "t-1", valeurs: {}, typeTransactionCode: null })

    expect(result).toEqual({ ok: true })
    const journal = mocks.saveFicheValuesAvecJournal.mock.calls[0][3]
    expect(journal.diff.champsModifies).toBe("PRIX_VENTE, COMMENTAIRE")
    expect(journal.diff.modifications).toEqual([
      "Prix de vente : 100000 → 250000",
      "Commentaire : vide → Vente entre proches",
    ])
  })

  it("une sauvegarde sans changement n'énumère aucun champ", async () => {
    mocks.findTransactionFiche.mockResolvedValue(transaction([{ champId: "c2", valeurNombre: 12 }]))
    mocks.buildStorageEntries.mockReturnValue([
      { champId: "c2", valeurNombre: 12, valeurTexte: null, valeurTexteMultiple: [], valeurBooleen: null, valeurDate: null },
    ])

    await saveFiche({ id: "t-1", valeurs: {}, typeTransactionCode: null })

    expect(mocks.saveFicheValuesAvecJournal.mock.calls[0][3].diff).toEqual({ champsModifies: "", modifications: [] })
  })
})
