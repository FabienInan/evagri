"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/fiche/section-card"
import { deleteDocument, uploadDocument } from "@/server/actions/fiche"
import type { SerializedFicheDocument } from "@/serializers/fiche.serializer"

export function DocumentsPanel({
  transactionSourceId,
  documents,
  readOnly,
}: {
  transactionSourceId: string
  documents: SerializedFicheDocument[]
  readOnly: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleUpload(file: File) {
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    startTransition(async () => {
      const res = await uploadDocument(transactionSourceId, formData)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  function handleDelete(documentId: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteDocument(documentId)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <SectionCard title="Documents">
      <div className="space-y-3">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document.</p>
        ) : (
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <FileText className="h-4 w-4" />
                  {doc.nomFichier}
                </span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Supprimer"
                    disabled={pending}
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ""
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-fit"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Ajouter un PDF
            </Button>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </SectionCard>
  )
}
