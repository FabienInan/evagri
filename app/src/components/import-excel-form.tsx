"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Upload, Loader2 } from "lucide-react"
import { importExcel } from "@/server/actions/import"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ImportExcelForm({ onImported }: { onImported?: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [report, setReport] = useState<{
    totalRows: number
    inserted: number
    ignored: number
    errors: { sheet: string; row: number; message: string }[]
  } | null>(null)

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await importExcel(formData)
      setReport(res)
      onImported?.()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Importer un fichier Excel EVAGRI
        </CardTitle>
        <CardDescription>
          Fichier .xlsx contenant les feuilles Terre, Bois ou Ventes érablière.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="excel-file">Fichier Excel</Label>
            <div className="flex items-center gap-2">
              <input
                id="excel-file"
                name="file"
                type="file"
                accept=".xlsx"
                required
                className="block w-full text-sm file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Import en cours…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Importer
              </>
            )}
          </Button>
        </form>

        {report && (
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Total : {report.totalRows}</Badge>
              <Badge variant="default">Insérées : {report.inserted}</Badge>
              <Badge variant="secondary">Ignorées : {report.ignored}</Badge>
              <Badge variant={report.errors.length > 0 ? "destructive" : "secondary"}>
                Erreurs : {report.errors.length}
              </Badge>
            </div>
            {report.errors.length > 0 && (
              <ul className="max-h-60 overflow-auto rounded-md border border-border bg-background p-3 text-sm">
                {report.errors.slice(0, 50).map((e, i) => (
                  <li key={i} className="text-destructive">
                    {e.sheet} ligne {e.row} : {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
