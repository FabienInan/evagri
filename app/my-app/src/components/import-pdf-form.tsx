"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { importActesPDF } from "@/server/actions/actes"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Report = Awaited<ReturnType<typeof importActesPDF>>

export function ImportPdfForm({ onImported }: { onImported?: () => void }) {
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)

  async function handleSubmit(formData: FormData) {
    const res = await importActesPDF(formData)
    setReport(res)
    onImported?.()
    router.refresh()
  }

  return (
    <div>
      <form action={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="pdf-files">Documents d&apos;acte PDF</Label>
          <input
            id="pdf-files"
            name="files"
            type="file"
            accept=".pdf"
            multiple
            required
            className="block mt-1"
          />
        </div>
        <Button type="submit">Importer les PDF</Button>
      </form>
      {report && (
        <div className="border rounded p-4 mt-4 space-y-2">
          <p>Associés: {report.matchedCount}</p>
          <p>Non associés: {report.unmatchedCount}</p>
          {report.unmatched.length > 0 && (
            <ul className="max-h-60 overflow-auto border rounded p-2">
              {report.unmatched.map((u, i) => (
                <li key={i} className="text-red-600 text-sm">
                  {u}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
