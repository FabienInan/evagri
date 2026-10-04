"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChampsAdmin } from "@/components/champs-admin"
import { SectionsEditor, type SectionsEditorHandle } from "@/components/sections-editor"
import type { ChampEnrichissableConfig, FicheSection } from "@/types/champ"
import type { TypologieOption } from "@/repositories/typologie.repository"

type Tab = "champs" | "sections"

export function ChampsPageClient({
  champs,
  typologies,
  initialSections,
}: {
  champs: ChampEnrichissableConfig[]
  typologies: TypologieOption[]
  initialSections: FicheSection[]
}) {
  const [tab, setTab] = useState<Tab>("champs")
  const saisissablesAffiches = champs.filter((c) => c.nature === "SAISISSABLE" && c.actif && c.estAffiche)

  const sectionsEditorRef = useRef<SectionsEditorHandle | null>(null)
  const [savingDisposition, setSavingDisposition] = useState(false)
  const [savedDisposition, setSavedDisposition] = useState(false)
  const [dispositionError, setDispositionError] = useState<string | null>(null)

  async function handleSaveDisposition() {
    setSavingDisposition(true)
    setDispositionError(null)
    try {
      const error = await sectionsEditorRef.current?.save()
      if (error) {
        setDispositionError(error)
        return
      }
      setSavedDisposition(true)
      setTimeout(() => setSavedDisposition(false), 1500)
    } finally {
      setSavingDisposition(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="shrink-0">
          <TabsList className="rounded-lg">
            <TabsTrigger value="champs">Champs enrichissables</TabsTrigger>
            <TabsTrigger value="sections">Disposition de la fiche</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "sections" && (
          <div className="ml-auto flex items-center gap-3">
            {dispositionError && <p className="text-sm text-destructive">{dispositionError}</p>}
            <Button
              onClick={handleSaveDisposition}
              disabled={savingDisposition}
              className="rounded-lg"
            >
              {savingDisposition ? "Enregistrement..." : savedDisposition ? "Enregistré ✓" : "Enregistrer la disposition"}
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "champs" ? (
          <ChampsAdmin champs={champs} typologies={typologies} />
        ) : (
          <SectionsEditor ref={sectionsEditorRef} champs={saisissablesAffiches} initialSections={initialSections} />
        )}
      </div>
    </div>
  )
}
