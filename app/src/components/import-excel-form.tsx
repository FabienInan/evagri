"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { importExcel } from "@/server/actions/import"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function ImportExcelForm({ onImported }: { onImported?: () => void }) {
  const router = useRouter()
  const [report, setReport] = useState<{
    totalRows: number
    inserted: number
    ignored: number
    errors: { sheet: string; row: number; message: string }[]
  } | null>(null)

  async function handleSubmit(formData: FormData) {
    const res = await importExcel(formData)
    setReport(res)
    onImported?.()
    router.refresh()
  }

  return (
    <div>
      <form action={handleSubmit} className="space-y-4 mb-8">
        <div>
          <Label htmlFor="file">Fichier Excel EVAGRI (.xlsx)</Label>
          <input id="file" name="file" type="file" accept=".xlsx" required className="block mt-1" />
        </div>
        <Button type="submit">Importer</Button>
      </form>
      {report && (
        <div className="border rounded p-4 space-y-1">
          <p>Lignes total: {report.totalRows}</p>
          <p>Insérées: {report.inserted}</p>
          <p>Ignorées (doublons): {report.ignored}</p>
          <p>Erreurs: {report.errors.length}</p>
          {report.errors.length > 0 && (
            <ul className="mt-2 max-h-60 overflow-auto border rounded p-2">
              {report.errors.slice(0, 50).map((e, i) => (
                <li key={i} className="text-red-600 text-sm">
                  {e.sheet} ligne {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
