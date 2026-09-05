"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { RefreshCw, Eye, X, History } from "lucide-react"
import { listImports, retryImport } from "@/server/actions/import"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/data-table"

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

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

function LocalDate({ date }: { date: Date }) {
  const isClient = useIsClient()
  if (!isClient) {
    return <>{new Date(date).toISOString().slice(0, 19).replace("T", " ")}</>
  }
  return <>{new Date(date).toLocaleString("fr-CA")}</>
}

function statusBadge(statut: string) {
  switch (statut) {
    case "EN_COURS":
      return <Badge variant="secondary">{STATUS_LABELS[statut]}</Badge>
    case "TERMINE":
      return <Badge variant="default">{STATUS_LABELS[statut]}</Badge>
    case "TERMINE_AVEC_ERREURS":
      return <Badge variant="warning">{STATUS_LABELS[statut]}</Badge>
    case "EN_ECHEC":
      return <Badge variant="destructive">{STATUS_LABELS[statut]}</Badge>
    default:
      return <Badge variant="outline">{statut}</Badge>
  }
}

export function ImportHistory({ initialImports }: { initialImports: Importation[] }) {
  const [imports, setImports] = useState(initialImports)
  const [selected, setSelected] = useState<Importation | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Poll while an import is running so counters and status stay live.
  const hasRunning = imports.some((imp) => imp.statut === "EN_COURS")
  useEffect(() => {
    if (!hasRunning) return
    const interval = setInterval(async () => {
      try {
        setImports(await listImports())
      } catch {
        // Keep last known state if a poll fails.
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [hasRunning])

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

  const columns: DataTableColumn<Importation>[] = [
    { key: "date", label: "Date", minWidth: 160, priority: 5, render: (imp) => <LocalDate date={imp.createdAt} /> },
    { key: "typeSource", label: "Source", minWidth: 100, priority: 4, render: (imp) => imp.typeSource },
    { key: "statut", label: "Statut", minWidth: 140, priority: 6, render: (imp) => statusBadge(imp.statut) },
    { key: "lignesTotal", label: "Total", numeric: true, minWidth: 80, priority: 3, render: (imp) => imp.lignesTotal },
    { key: "lignesInserees", label: "Insérées", numeric: true, minWidth: 90, priority: 2, render: (imp) => imp.lignesInserees },
    { key: "lignesIgnorees", label: "Ignorées", numeric: true, minWidth: 90, priority: 1, render: (imp) => imp.lignesIgnorees },
    { key: "lignesErreurs", label: "Erreurs", numeric: true, minWidth: 80, priority: 1, render: (imp) => imp.lignesErreurs },
    {
      key: "actions",
      label: "Actions",
      numeric: true,
      minWidth: 80,
      priority: 10,
      locked: true,
      render: (imp) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelected(imp)}
            aria-label="Détails"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {imp.statut === "EN_ECHEC" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleRetry(imp.id)}
              aria-label="Relancer"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Historique des importations
        </CardTitle>
        <CardDescription>Dernières importations et relances disponibles.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-md border border-border bg-muted p-3 text-sm">{message}</div>
        )}

        <DataTable
          variant="bare"
          storageKey="import-history"
          columns={columns}
          rows={imports}
          rowKey={(imp) => imp.id}
          emptyMessage="Aucune importation"
        />

        {selected && (
          <Card className="mt-4 border border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">
                Détails de l&apos;import {selected.id.slice(0, 8)}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelected(null)}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(selected.details, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}

