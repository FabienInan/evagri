"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronRight, FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DossierFormDialog } from "@/components/dossier/dossier-form-dialog"
import type { SerializedDossier } from "@/serializers/dossier.serializer"

export function DossiersPageClient({ dossiers }: { dossiers: SerializedDossier[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""}
        </h2>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
          <FolderPlus className="h-4 w-4" />
          Nouveau dossier
        </Button>
      </div>

      {dossiers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun dossier. Créez-en un pour commencer.</p>
      ) : (
        <Card className="gap-0 overflow-hidden p-0 pb-0">
          <ul className="divide-y divide-border">
            {dossiers.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dossiers/${d.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="w-32 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {d.numeroDossier}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{d.nom ?? "—"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {d.panierCount} panier{d.panierCount > 1 ? "s" : ""}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showForm && (
        <DossierFormDialog
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false)
            router.push(`/dossiers/${id}`)
          }}
        />
      )}
    </div>
  )
}
