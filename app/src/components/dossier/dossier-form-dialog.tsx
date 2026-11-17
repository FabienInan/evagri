"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/modal"
import { createDossier, previewLotsCadastraux } from "@/server/actions/dossier"

type Coordonnees = { latitude: number; longitude: number }
type Apercu = {
  lots: { lot: string; latitude: number | null; longitude: number | null }[]
  moyenne: Coordonnees | null
}

/** Lots saisis : séparés par virgule, point-virgule ou retour à la ligne. */
function parseLots(saisie: string): string[] {
  return saisie.split(/[,;\n]/).map((l) => l.trim()).filter(Boolean)
}

function parseDecimal(saisie: string): number | undefined {
  return saisie.trim() ? Number(saisie.replace(",", ".")) : undefined
}

function formatCoordonnees({ latitude, longitude }: Coordonnees): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

export function DossierFormDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [numeroDossier, setNumeroDossier] = useState("")
  const [nom, setNom] = useState("")
  const [dateEvaluation, setDateEvaluation] = useState("")
  const [lots, setLots] = useState("")
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  // Coordonnées saisies à la main : affichées seulement quand aucun lot n'est trouvé au cadastre.
  const [coordonneesRequises, setCoordonneesRequises] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [recherche, setRecherche] = useState(false)

  function handleLotsChange(value: string) {
    setLots(value)
    // Un résultat affiché ne vaut que pour la saisie qui l'a produit.
    setApercu(null)
    setCoordonneesRequises(false)
  }

  async function handleRecherche() {
    setRecherche(true)
    setError(null)
    const res = await previewLotsCadastraux({ lotsCadastraux: parseLots(lots) })
    setRecherche(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setApercu({ lots: res.lots, moyenne: res.moyenne })
    setCoordonneesRequises(res.moyenne === null)
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const res = await createDossier({
      numeroDossier,
      nom: nom.trim() || undefined,
      dateEvaluation,
      lotsCadastraux: parseLots(lots),
      latitude: coordonneesRequises ? parseDecimal(latitude) : undefined,
      longitude: coordonneesRequises ? parseDecimal(longitude) : undefined,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      if (res.coordonneesRequises) setCoordonneesRequises(true)
      return
    }
    onCreated(res.id)
  }

  return (
    <Modal title="Nouveau dossier" onClose={onClose} className="max-w-xl">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="numero-dossier">Numéro de dossier</Label>
          <Input
            id="numero-dossier"
            value={numeroDossier}
            placeholder="25-12-001"
            onChange={(e) => setNumeroDossier(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-evaluation">Date d&apos;évaluation</Label>
          <Input
            id="date-evaluation"
            type="date"
            value={dateEvaluation}
            onChange={(e) => setDateEvaluation(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Sert de date de référence aux indicateurs ajustés. Elle ne se modifie pas ensuite.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lots-cadastraux">Numéros de lots</Label>
          <textarea
            id="lots-cadastraux"
            rows={2}
            value={lots}
            placeholder="4 128 182, 4 128 183"
            onChange={(e) => handleLotsChange(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Chiffres uniquement, jusqu&apos;à 5 lots séparés par une virgule, un point-virgule ou un retour à la ligne.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecherche}
              disabled={recherche || saving || !lots.trim()}
            >
              {recherche ? "Recherche…" : "Rechercher au cadastre"}
            </Button>
          </div>
        </div>

        {apercu && (
          <div className="space-y-1.5 rounded-md border border-border p-3 text-sm">
            {apercu.lots.map((l) => (
              <div key={l.lot} className="flex justify-between gap-3">
                <span className="text-muted-foreground">Lot {l.lot}</span>
                {l.latitude !== null && l.longitude !== null ? (
                  <span className="whitespace-nowrap font-mono text-xs">
                    {formatCoordonnees({ latitude: l.latitude, longitude: l.longitude })}
                  </span>
                ) : (
                  <span className="text-destructive">introuvable</span>
                )}
              </div>
            ))}
            {apercu.moyenne ? (
              <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-medium">
                <span className="whitespace-nowrap">Moyenne</span>
                <span className="whitespace-nowrap font-mono text-xs">{formatCoordonnees(apercu.moyenne)}</span>
              </div>
            ) : (
              <p className="text-destructive">Aucun lot trouvé au cadastre : saisissez la latitude et la longitude.</p>
            )}
          </div>
        )}

        {coordonneesRequises && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="latitude-dossier">Latitude</Label>
              <Input
                id="latitude-dossier"
                inputMode="decimal"
                placeholder="46.812345"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude-dossier">Longitude</Label>
              <Input
                id="longitude-dossier"
                inputMode="decimal"
                placeholder="-71.234567"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Coordonnées à l&apos;intérieur du territoire du Québec.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="nom-dossier">Nom (optionnel)</Label>
          <Input id="nom-dossier" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || recherche}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
