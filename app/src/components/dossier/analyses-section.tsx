"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AnalyseDossierFormDialog } from "@/components/dossier/analyse-dossier-form-dialog"
import { deleteAnalyseDossier } from "@/server/actions/analyse-dossier"
import type { SerializedAnalyse } from "@/serializers/analyse-dossier.serializer"

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

export function AnalysesSection({ dossierId, analyses }: { dossierId: string; analyses: SerializedAnalyse[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<SerializedAnalyse | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(analyse: SerializedAnalyse) {
    if (!window.confirm(`Supprimer l'analyse du ${formatDate(analyse.dateEvaluation)} ?`)) return
    setError(null)
    const res = await deleteAnalyseDossier(analyse.id)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Analyses de dossier</h2>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle analyse
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {analyses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune analyse. Une analyse calcule les indicateurs ajustés des transactions du dossier.
        </p>
      ) : (
        <Card className="gap-0 overflow-hidden p-0 pb-0">
          <ul className="divide-y divide-border">
            {analyses.map((analyse) => (
              <li key={analyse.id} className="flex items-center gap-4 px-4 py-3">
                <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                  Évaluation du {formatDate(analyse.dateEvaluation)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Croissance {analyse.tauxCroissancePct} % · {analyse.resultCount} transaction
                  {analyse.resultCount > 1 ? "s" : ""}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Modifier l'analyse"
                  onClick={() => setEditing(analyse)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Supprimer l'analyse"
                  onClick={() => handleDelete(analyse)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {creating && (
        <AnalyseDossierFormDialog
          dossierId={dossierId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      )}
      {editing && (
        <AnalyseDossierFormDialog
          dossierId={dossierId}
          analyse={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}
