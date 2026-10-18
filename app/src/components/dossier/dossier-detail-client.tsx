"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PanierFormDialog } from "@/components/dossier/panier-form-dialog"
import type { TypologieOption } from "@/types/typologie"
import type { SerializedDossier, SerializedPanier } from "@/serializers/dossier.serializer"

export function DossierDetailClient({
  dossier,
  paniers,
  typologies,
}: {
  dossier: SerializedDossier
  paniers: SerializedPanier[]
  typologies: TypologieOption[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-lg font-semibold tabular-nums text-foreground">{dossier.numeroDossier}</p>
            <p className="text-sm text-muted-foreground">{dossier.nom ?? "—"}</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Nouveau panier
          </Button>
        </CardContent>
      </Card>

      {paniers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun panier dans ce dossier.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paniers.map((p) => (
            <Link key={p.id} href={`/paniers/${p.id}`}>
              <Card className="h-full transition-colors hover:border-primary/60">
                <CardContent className="space-y-1 p-4">
                  <p className="text-base font-semibold text-foreground">{p.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.transactionCount} transaction{p.transactionCount > 1 ? "s" : ""}
                  </p>
                  {p.typeTransactionNom && <Badge variant="secondary">{p.typeTransactionNom}</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
