"use client"

import { useState } from "react"
import { Trash2, Plus, SlidersHorizontal } from "lucide-react"
import { createFilter, deleteFilter, updateFilterOrder } from "@/server/actions/filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
  const [type, setType] = useState("PLAGE_NUMERIQUE")
  const [champId, setChampId] = useState(champs[0]?.id ?? "")

  return (
    <div className="space-y-6">
      <form
        action={async (formData) => {
          formData.set("typeFiltre", type)
          formData.set("champEnrichissableId", champId)
          formData.set("operateurs", JSON.stringify(DEFAULT_OPERATEURS[type]))
          await createFilter(formData)
          window.location.reload()
        }}
        className="grid grid-cols-1 items-end gap-3 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="nomFiltre">Nom</Label>
          <Input id="nomFiltre" name="nomFiltre" required />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Type de filtre" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Champ cible</Label>
          <Select value={champId} onValueChange={setChampId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Champ cible" />
            </SelectTrigger>
            <SelectContent>
              {champs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  [{c.nature}] {c.nomAffichage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ordreAffichage">Ordre</Label>
          <Input id="ordreAffichage" name="ordreAffichage" type="number" defaultValue={0} />
        </div>
        <Button type="submit" className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </form>

      <div className="overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Champ</TableHead>
              <TableHead className="text-right">Ordre</TableHead>
              <TableHead className="text-center">Actif</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.nomFiltre}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    <SlidersHorizontal className="h-3 w-3" />
                    {f.typeFiltre}
                  </span>
                </TableCell>
                <TableCell>{f.champEnrichissable?.nomAffichage || "-"}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    defaultValue={f.ordreAffichage}
                    className="ml-auto w-20 text-right text-sm"
                    onChange={async (e) => {
                      const ordre = Number(e.target.value)
                      const next = items.map((i) => (i.id === f.id ? { ...i, ordreAffichage: ordre } : i))
                      setItems(next)
                      await updateFilterOrder(next.map((i) => ({ id: i.id, ordreAffichage: i.ordreAffichage, estActif: i.estActif })))
                    }}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    defaultChecked={f.estActif}
                    onChange={async (e) => {
                      const next = items.map((i) => (i.id === f.id ? { ...i, estActif: e.target.checked } : i))
                      setItems(next)
                      await updateFilterOrder(next.map((i) => ({ id: i.id, ordreAffichage: i.ordreAffichage, estActif: i.estActif })))
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={async () => {
                      await deleteFilter(f.id)
                      window.location.reload()
                    }}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
