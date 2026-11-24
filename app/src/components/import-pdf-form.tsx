"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import { importActesPDF } from "@/server/actions/actes"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Report = Extract<Awaited<ReturnType<typeof importActesPDF>>, { ok: true }>

/** Server actions accept 10 MB per request (next.config.ts): a folder is sent in batches under this size. */
const TAILLE_MAX_LOT = 8 * 1024 * 1024
const FICHIERS_MAX_LOT = 20

/** Groups the PDF files into batches that each fit one request. A single file above the limit is set aside. */
function repartirEnLots(fichiers: File[]): { lots: File[][]; tropGros: string[] } {
  const lots: File[][] = []
  const tropGros: string[] = []
  let lotCourant: File[] = []
  let tailleCourante = 0
  for (const fichier of fichiers) {
    if (fichier.size > TAILLE_MAX_LOT) {
      tropGros.push(fichier.name)
      continue
    }
    if (lotCourant.length > 0 && (tailleCourante + fichier.size > TAILLE_MAX_LOT || lotCourant.length >= FICHIERS_MAX_LOT)) {
      lots.push(lotCourant)
      lotCourant = []
      tailleCourante = 0
    }
    lotCourant.push(fichier)
    tailleCourante += fichier.size
  }
  if (lotCourant.length > 0) lots.push(lotCourant)
  return { lots, tropGros }
}

// Lets the file picker choose a folder of the operating system (not single files).
const propsDossier = { webkitdirectory: "", directory: "" } as Record<string, string>

export function ImportPdfForm({ onImported }: { onImported?: () => void }) {
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progression, setProgression] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFolderChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selection = Array.from(event.target.files ?? [])
    event.target.value = ""
    const pdfs = selection.filter((f) => f.name.toLowerCase().endsWith(".pdf"))
    if (pdfs.length === 0) {
      setError("Aucun fichier PDF dans le dossier choisi.")
      return
    }

    const { lots, tropGros } = repartirEnLots(pdfs)
    setSubmitting(true)
    setError(null)
    setReport(null)
    const cumul: Report = { ok: true, matchedCount: 0, unmatchedCount: 0, matched: [], unmatched: [] }
    cumul.unmatched.push(...tropGros.map((nom) => `${nom} (fichier trop volumineux, 8 Mo maximum)`))
    cumul.unmatchedCount = cumul.unmatched.length
    try {
      for (let i = 0; i < lots.length; i++) {
        setProgression(`Lot ${i + 1} sur ${lots.length}`)
        const formData = new FormData()
        for (const fichier of lots[i]) formData.append("files", fichier)
        const res = await importActesPDF(formData)
        if (!res.ok) {
          setError(res.error)
          break
        }
        cumul.matchedCount += res.matchedCount
        cumul.unmatchedCount += res.unmatchedCount
        cumul.matched.push(...res.matched)
        cumul.unmatched.push(...res.unmatched)
      }
      setReport(cumul)
      onImported?.()
      router.refresh()
    } catch {
      setError("Échec de l'import des PDF. Réessayez.")
    } finally {
      setProgression(null)
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Importer des actes PDF
        </CardTitle>
        <CardDescription>
          Choisissez le dossier qui contient les PDF. Chaque PDF est associé à la transaction dont le numéro
          d&apos;inscription apparaît dans son nom de fichier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pdf-dossier">Dossier des actes</Label>
          <input
            id="pdf-dossier"
            type="file"
            multiple
            disabled={submitting}
            onChange={handleFolderChange}
            {...propsDossier}
            className="block w-full text-sm file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:opacity-50"
          />
        </div>
        {submitting && <p className="text-sm text-muted-foreground">Import en cours{progression ? ` : ${progression}` : "..."}</p>}

        {error && <p className="text-sm text-destructive">{error}</p>}

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
