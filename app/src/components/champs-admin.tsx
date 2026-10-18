"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { createChamp, updateChamp, toggleChampActif } from "@/server/actions/champs"
import type { ChampInput } from "@/server/actions/champs"
import { parseListOptions, deriveEstLectureSeule } from "@/lib/champs"
import { buildCodeMachine } from "@/lib/normalization/parsing"
import type { ChampEnrichissableConfig } from "@/types/champ"
import type { TypologieOption } from "@/types/typologie"
import { ChampCreateCard } from "@/components/admin/champs/champ-create-card"
import { ChampList } from "@/components/admin/champs/champ-list"
import { ChampEditPanel } from "@/components/admin/champs/champ-edit-panel"
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
  const [toggling, setToggling] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return champs
      .filter((c) => c.nomAffichage.toLowerCase().includes(q) || c.codeMachine.toLowerCase().includes(q))
      .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
  }, [champs, search])

  const selected = useMemo(() => champs.find((c) => c.id === selectedId) ?? null, [champs, selectedId])

  // Code machine dérivé du nom affiché (norme buildCodeMachine) : jamais saisi, toujours aligné.
  const derivedCodeMachine = useMemo(() => buildCodeMachine(draft.nomAffichage), [draft.nomAffichage])

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
      <ChampCreateCard
        draft={draft}
        onDraftChange={setDraft}
        createOptionsText={createOptionsText}
        onCreateOptionsTextChange={setCreateOptionsText}
        derivedCodeMachine={derivedCodeMachine}
        typologies={typologies}
        creating={creating}
        createError={createError}
        onCreate={handleCreate}
      />

      <ChampList
        filtered={filtered}
        selectedId={selectedId}
        onSelect={selectChamp}
        search={search}
        onSearchChange={setSearch}
      >
        <ChampEditPanel
          selected={selected}
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
