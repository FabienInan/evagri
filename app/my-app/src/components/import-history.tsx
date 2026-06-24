"use client"

import { useState } from "react"
import { retryImport } from "@/server/actions/import"
import { Button } from "@/components/ui/button"

type Importation = {
  id: string
  typeSource: string
  statut: string
  lignesTotal: number
  lignesInserees: number
  lignesIgnorees: number
  lignesErreurs: number
  details: unknown
  createdAt: Date
}

const STATUS_LABELS: Record<string, string> = {
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  TERMINE_AVEC_ERREURS: "Terminé avec erreurs",
  EN_ECHEC: "En échec",
}

const STATUS_CLASSES: Record<string, string> = {
  EN_COURS: "bg-blue-100 text-blue-800",
  TERMINE: "bg-green-100 text-green-800",
  TERMINE_AVEC_ERREURS: "bg-yellow-100 text-yellow-800",
  EN_ECHEC: "bg-red-100 text-red-800",
}

export function ImportHistory({ initialImports }: { initialImports: Importation[] }) {
  const [imports, setImports] = useState(initialImports)
  const [selected, setSelected] = useState<Importation | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleRetry(id: string) {
    try {
      const res = await retryImport(id)
      setMessage(res.message)
      setImports((prev) =>
        prev.map((imp) => (imp.id === id ? { ...imp, statut: "EN_COURS" } : imp))
      )
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="border rounded p-3 bg-stone-50 text-sm">{message}</div>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Source</th>
            <th className="text-left p-2">Statut</th>
            <th className="text-left p-2">Total</th>
            <th className="text-left p-2">Insérées</th>
            <th className="text-left p-2">Ignorées</th>
            <th className="text-left p-2">Erreurs</th>
            <th className="text-left p-2"></th>
          </tr>
        </thead>
        <tbody>
          {imports.map((imp) => (
            <tr key={imp.id} className="border-b hover:bg-stone-50">
              <td className="p-2">{new Date(imp.createdAt).toLocaleString("fr-CA")}</td>
              <td className="p-2">{imp.typeSource}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs ${STATUS_CLASSES[imp.statut] || "bg-gray-100"}`}>
                  {STATUS_LABELS[imp.statut] || imp.statut}
                </span>
              </td>
              <td className="p-2">{imp.lignesTotal}</td>
              <td className="p-2">{imp.lignesInserees}</td>
              <td className="p-2">{imp.lignesIgnorees}</td>
              <td className="p-2">{imp.lignesErreurs}</td>
              <td className="p-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(imp)}>
                  Détails
                </Button>
                {imp.statut === "EN_ECHEC" && (
                  <Button variant="secondary" size="sm" className="ml-2" onClick={() => handleRetry(imp.id)}>
                    Relancer
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <div className="border rounded p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Détails de l'import {selected.id.slice(0, 8)}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Fermer
            </Button>
          </div>
          <pre className="text-xs bg-stone-100 p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(selected.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
