"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useHeaderActions } from "@/components/header-actions"
import { PanierFormDialog } from "@/components/dossier/panier-form-dialog"
import { AnalysesSection } from "@/components/dossier/analyses-section"
import type { TypologieOption } from "@/types/typologie"
import type { SerializedDossier, SerializedPanier } from "@/serializers/dossier.serializer"
import type { SerializedAnalyse } from "@/serializers/analyse-dossier.serializer"

export function DossierDetailClient({
  dossier,
  paniers,
  typologies,
  analyses,
}: {
  dossier: SerializedDossier
  paniers: SerializedPanier[]
  typologies: TypologieOption[]
  analyses: SerializedAnalyse[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const { setTitleSuffix, clearTitleSuffix } = useHeaderActions()

  // Le numéro de dossier s'affiche à côté du titre « Dossier » dans l'en-tête.
  useEffect(() => {
    setTitleSuffix(dossier.numeroDossier)
    return () => clearTitleSuffix()
  }, [dossier.numeroDossier, setTitleSuffix, clearTitleSuffix])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{dossier.nom ?? "—"}</p>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Nouveau panier
        </Button>
      </div>

      {paniers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun panier dans ce dossier.</p>
      ) : (
        <Card className="gap-0 overflow-hidden p-0 pb-0">
          <ul className="divide-y divide-border">
            {paniers.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/paniers/${p.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.nom}</span>
                  {p.typeTransactionNom && <Badge variant="secondary">{p.typeTransactionNom}</Badge>}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.transactionCount} transaction{p.transactionCount > 1 ? "s" : ""}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AnalysesSection dossierId={dossier.id} analyses={analyses} />

      {showForm && (
        <PanierFormDialog
          dossierId={dossier.id}
          typologies={typologies}
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false)
            router.push(`/paniers/${id}`)
          }}
        />
      )}
    </div>
  )
}
