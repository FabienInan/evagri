"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dossiers.map((d) => (
            <Link key={d.id} href={`/dossiers/${d.id}`}>
              <Card className="h-full transition-colors hover:border-primary/60">
                <CardContent className="space-y-1 p-4">
                  <p className="text-base font-semibold tabular-nums text-foreground">{d.numeroDossier}</p>
                  <p className="text-sm text-muted-foreground">{d.nom ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.panierCount} panier{d.panierCount > 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
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
