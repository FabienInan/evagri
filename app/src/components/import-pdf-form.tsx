"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload } from "lucide-react"
import { importActesPDF } from "@/server/actions/actes"
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Importer des actes PDF
        </CardTitle>
        <CardDescription>
          Les PDF sont associés aux transactions par numéro d&apos;inscription extrait du nom de fichier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-files">Documents PDF</Label>
            <input
              id="pdf-files"
              name="files"
              type="file"
              accept=".pdf"
              multiple
              required
              className="block w-full text-sm file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
            />
          </div>
          <Button type="submit" className="gap-2">
            <Upload className="h-4 w-4" />
            Importer les PDF
          </Button>
        </form>

        {report && (
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">Associés : {report.matchedCount}</Badge>
              <Badge variant={report.unmatchedCount > 0 ? "warning" : "secondary"}>
                Non associés : {report.unmatchedCount}
              </Badge>
            </div>
            {report.unmatched.length > 0 && (
              <ul className="max-h-60 overflow-auto rounded-md border border-border bg-background p-3 text-sm">
                {report.unmatched.map((u, i) => (
                  <li key={i} className="text-destructive">{u}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
