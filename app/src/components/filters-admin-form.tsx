"use client"

import { useState } from "react"
import { createFilter, deleteFilter, updateFilterOrder } from "@/server/actions/filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const FILTER_TYPES = [
  "PLAGE_NUMERIQUE",
  "PLAGE_DATE",
  "LISTE",
  "MULTI_SELECT",
  "RECHERCHE_TEXTE",
  "BOOLEEN",
]

const DEFAULT_OPERATEURS: Record<string, string[]> = {
  PLAGE_NUMERIQUE: ["=", "+", "-", "entre"],
  PLAGE_DATE: ["=", "+", "-", "entre"],
  LISTE: ["in"],
  MULTI_SELECT: ["in"],
  RECHERCHE_TEXTE: ["contient"],
  BOOLEEN: ["="],
}

export function FiltersAdminForm({
  filters,
  champs,
}: {
  filters: any[]
  champs: any[]
}) {
  const [items, setItems] = useState(filters)

  return (
    <div className="space-y-6">
      <form
        action={async (formData) => {
          await createFilter(formData)
          window.location.reload()
        }}
        className="grid grid-cols-5 gap-2 items-end"
      >
        <div>
          <Label htmlFor="nomFiltre">Nom</Label>
          <Input id="nomFiltre" name="nomFiltre" required />
        </div>
        <div>
          <Label htmlFor="typeFiltre">Type</Label>
          <select id="typeFiltre" name="typeFiltre" className="w-full border rounded p-2" required>
            {FILTER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="champEnrichissableId">Champ cible</Label>
          <select id="champEnrichissableId" name="champEnrichissableId" className="w-full border rounded p-2" required>
            {champs.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.nature}] {c.nomAffichage}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ordreAffichage">Ordre</Label>
          <Input id="ordreAffichage" name="ordreAffichage" type="number" defaultValue={0} />
        </div>
        <input type="hidden" name="operateurs" value={JSON.stringify(DEFAULT_OPERATEURS["PLAGE_NUMERIQUE"])} />
        <Button type="submit">Ajouter</Button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Nom</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Champ</th>
            <th className="text-left p-2">Ordre</th>
            <th className="text-left p-2">Actif</th>
            <th className="text-left p-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id} className="border-b">
              <td className="p-2">{f.nomFiltre}</td>
              <td className="p-2">{f.typeFiltre}</td>
              <td className="p-2">{f.champEnrichissable?.nomAffichage || "-"}</td>
              <td className="p-2">
                <input
                  type="number"
                  defaultValue={f.ordreAffichage}
                  className="w-20 border rounded p-1"
                  onChange={async (e) => {
                    const ordre = Number(e.target.value)
                    const next = items.map((i) => (i.id === f.id ? { ...i, ordreAffichage: ordre } : i))
                    setItems(next)
                    await updateFilterOrder(next.map((i) => ({ id: i.id, ordreAffichage: i.ordreAffichage, estActif: i.estActif })))
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  type="checkbox"
                  defaultChecked={f.estActif}
                  onChange={async (e) => {
                    const next = items.map((i) => (i.id === f.id ? { ...i, estActif: e.target.checked } : i))
                    setItems(next)
                    await updateFilterOrder(next.map((i) => ({ id: i.id, ordreAffichage: i.ordreAffichage, estActif: i.estActif })))
                  }}
                />
              </td>
              <td className="p-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await deleteFilter(f.id)
                    window.location.reload()
                  }}
                >
                  Supprimer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
