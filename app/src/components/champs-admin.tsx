"use client"

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { createChamp, updateChamp, toggleChampActif } from "@/server/actions/champs"
import type { ChampInput } from "@/server/actions/champs"
import { parseListOptions, deriveEstLectureSeule } from "@/lib/champs"
import { buildChampCodeMachine } from "@/lib/normalization/parsing"
import { inferTypeDonneesFromRule } from "@/lib/calculator"
import type { ChampEnrichissableConfig, TypeDonneesChamp } from "@/types/champ"
import type { TypologieOption } from "@/types/typologie"
import { ChampCreateCard } from "@/components/admin/champs/champ-create-card"
import { Modal } from "@/components/dossier/modal"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ChampList } from "@/components/admin/champs/champ-list"
import { ChampEditPanel } from "@/components/admin/champs/champ-edit-panel"
import type { RuleFieldOption } from "@/components/admin/champs/regle-calcul-input"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { emptyDraft, toDraft } from "@/components/admin/champs/champs-model"

export function ChampsAdmin({
  champs,
  typologies,
  onChampsChange,
}: {
  champs: ChampEnrichissableConfig[]
  typologies: TypologieOption[]
  onChampsChange: Dispatch<SetStateAction<ChampEnrichissableConfig[]>>
}) {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(champs[0]?.id ?? null)
  const [draft, setDraft] = useState<ChampInput>(emptyDraft())
  // Une option par ligne : gardé en texte brut pour ne pas casser la saisie (retour à la ligne,
  // doublons en cours) ; converti via parseListOptions à l'enregistrement.
  const [createOptionsText, setCreateOptionsText] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ChampInput | null>(
    champs[0] ? toDraft(champs[0]) : null
  )
  const [editOptionsText, setEditOptionsText] = useState(champs[0]?.optionsListe?.join("\n") ?? "")
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return champs
      .filter((c) => c.nomAffichage.toLowerCase().includes(q) || c.codeMachine.toLowerCase().includes(q))
      .sort((a, b) => a.nomAffichage.localeCompare(b.nomAffichage, "fr", { sensitivity: "base" }))
  }, [champs, search])

  const selected = useMemo(() => champs.find((c) => c.id === selectedId) ?? null, [champs, selectedId])

  // Code machine dérivé du nom affiché et de l'unité (buildChampCodeMachine) : jamais saisi, toujours aligné.
  const derivedCodeMachine = useMemo(
    () => buildChampCodeMachine(draft.nomAffichage, draft.unite),
    [draft.nomAffichage, draft.unite]
  )

  // Seuls les champs décimaux ou entiers peuvent entrer dans une règle de calcul : on ne propose que ceux-là.
  const ruleFieldOptions = useMemo<RuleFieldOption[]>(() => {
    const imported = IMPORTED_FIELDS.filter((f) => f.typeDonnees === "DECIMAL" || f.typeDonnees === "ENTIER").map(
      (f) => ({ code: f.code, label: f.label })
    )
    const saisis = champs
      .filter((c) => c.typeDonnees === "DECIMAL" || c.typeDonnees === "ENTIER")
      .map((c) => ({ code: c.codeMachine, label: c.nomAffichage }))
    // Un code ne doit apparaître qu'une fois (clé de liste) : le champ importé prime sur un champ saisi homonyme.
    const seen = new Set<string>()
    return [...imported, ...saisis].filter((option) => {
      if (seen.has(option.code)) return false
      seen.add(option.code)
      return true
    })
  }, [champs])

  // Types connus de chaque code (importés et saisis) : sert à déduire le type d'un champ calculé.
  const knownTypes = useMemo(
    () =>
      new Map<string, TypeDonneesChamp>([
        ...IMPORTED_FIELDS.map((f) => [f.code, f.typeDonnees] as [string, TypeDonneesChamp]),
        ...champs.map((c) => [c.codeMachine, c.typeDonnees] as [string, TypeDonneesChamp]),
      ]),
    [champs]
  )
  const inferCalculatedType = useCallback(
    (rule: string) => inferTypeDonneesFromRule(rule, knownTypes),
    [knownTypes]
  )

  function selectChamp(champ: ChampEnrichissableConfig) {
    setSelectedId(champ.id)
    setEditDraft(toDraft(champ))
    setEditOptionsText(champ.optionsListe?.join("\n") ?? "")
    setEditError(null)
  }

  async function handleCreate() {
    if (creating) return
    setCreateError(null)
    setCreating(true)
    try {
      const result = await createChamp({
        ...draft,
        codeMachine: derivedCodeMachine,
        optionsListe: parseListOptions(createOptionsText),
      })
      if (!result.ok) {
        setCreateError(result.error)
        return
      }
      onChampsChange((prev) => [...prev, result.champ])
      selectChamp(result.champ)
      setDraft(emptyDraft())
      setCreateOptionsText("")
      setShowCreate(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création du champ.")
    } finally {
      setCreating(false)
    }
  }

  async function handleSave() {
    if (!selected || !editDraft) return
    setEditError(null)
    setSaving(true)
    try {
      const payload = { ...editDraft, optionsListe: parseListOptions(editOptionsText) }
      const result = await updateChamp(selected.id, payload)
      if (!result.ok) {
        setEditError(result.error)
        return
      }
      setEditDraft(payload)
      onChampsChange((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                ...payload,
                id: c.id,
                actif: c.actif,
                estLectureSeule: payload.estLectureSeule ?? deriveEstLectureSeule(payload.nature),
              }
            : c
        )
      )
      setLastSaved(selected.id)
      setTimeout(() => setLastSaved((current) => (current === selected.id ? null : current)), 1500)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde du champ.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActif() {
    if (!selected || toggling) return
    const nextActif = !selected.actif
    setToggling(true)
    setEditError(null)
    try {
      const result = await toggleChampActif(selected.id, nextActif)
      if (!result.ok) {
        setEditError(result.error)
        return
      }
      onChampsChange((prev) => prev.map((c) => (c.id === selected.id ? { ...c, actif: nextActif } : c)))
    } catch {
      setEditError("Échec du changement d'état du champ.")
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filtered.length} champ{filtered.length > 1 ? "s" : ""}
        </p>
        <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Nouveau champ
        </Button>
      </div>

      {showCreate && (
        <Modal title="Nouveau champ enrichissable" onClose={() => setShowCreate(false)} className="max-w-4xl">
          <ChampCreateCard
            draft={draft}
            onDraftChange={setDraft}
            createOptionsText={createOptionsText}
            onCreateOptionsTextChange={setCreateOptionsText}
            derivedCodeMachine={derivedCodeMachine}
            ruleFieldOptions={ruleFieldOptions}
            inferType={inferCalculatedType}
            typologies={typologies}
            creating={creating}
            createError={createError}
            onCreate={handleCreate}
          />
        </Modal>
      )}

      <ChampList
        filtered={filtered}
        selectedId={selectedId}
        onSelect={selectChamp}
        search={search}
        onSearchChange={setSearch}
      >
        <ChampEditPanel
          selected={selected}
          ruleFieldOptions={ruleFieldOptions}
          inferType={inferCalculatedType}
          editDraft={editDraft}
          onEditDraftChange={(updater) => setEditDraft((d) => (d ? updater(d) : d))}
          editOptionsText={editOptionsText}
          onEditOptionsTextChange={setEditOptionsText}
          typologies={typologies}
          saving={saving}
          toggling={toggling}
          lastSaved={lastSaved}
          editError={editError}
          onSave={handleSave}
          onToggleActif={handleToggleActif}
        />
      </ChampList>
    </div>
  )
}
