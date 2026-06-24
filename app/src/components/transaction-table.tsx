"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TransactionRow = {
  id: string
  numeroInscription: string
  dateVente: string
  mrc: string | null
  municipalite: string | null
  superficieTotaleHectare: number | null
  prixVente: number | null
  enrichie?: { statut: string } | null
}

type TableData = {
  transactions: TransactionRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const COLUMNS = [
  { key: "numeroInscription", label: "N° d'inscription", numeric: false },
  { key: "dateVente", label: "Date", numeric: false },
  { key: "mrc", label: "MRC", numeric: false },
  { key: "municipalite", label: "Municipalité", numeric: false },
  { key: "superficieTotaleHectare", label: "Superficie (ha)", numeric: true },
  { key: "prixVente", label: "Prix ($)", numeric: true },
  { key: "statut", label: "Statut", numeric: false },
]

function statusBadge(statut: string | null | undefined) {
  const value = statut ?? "NON_ANALYSEE"
  switch (value.toUpperCase()) {
    case "ANALYSEE":
    case "VALIDEE":
      return <Badge variant="default">{value}</Badge>
    case "A_ANALYSER":
    case "A ANALYSER":
    case "EN_COURS":
    case "EN COURS D'ANALYSE":
      return <Badge variant="warning">{value}</Badge>
    case "ERREUR":
    case "REFUSEE":
      return <Badge variant="destructive">{value}</Badge>
    default:
      return <Badge variant="secondary">{value}</Badge>
  }
}

export function TransactionTable({
  data,
  onPageChange,
  onSort,
  sortField,
  sortOrder,
}: {
  data: TableData
  onPageChange: (page: number) => void
  onSort: (field: string) => void
  sortField: string
  sortOrder: "asc" | "desc"
}) {
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])

  function toggleColumn(key: string) {
    setHiddenColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const visibleColumns = COLUMNS.filter((c) => !hiddenColumns.includes(c.key))

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Résultats
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({data.total} transaction{data.total > 1 ? "s" : ""})
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {COLUMNS.map((col) => {
              const isVisible = !hiddenColumns.includes(col.key)
              return (
                <Button
                  key={col.key}
                  variant={isVisible ? "outline" : "ghost"}
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => toggleColumn(col.key)}
                >
                  {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {col.label}
                </Button>
              )
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto" style={{ maxHeight: "55vh" }}>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.numeric ? "text-right" : ""}
                    onClick={() => onSort(col.key)}
                  >
                    <button className="flex items-center gap-1 font-semibold">
                      {col.label}
                      {sortField === col.key && (
                        sortOrder === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions.map((t) => (
                <TableRow key={t.id}>
                  {!hiddenColumns.includes("numeroInscription") && (
                    <TableCell className="font-medium">{t.numeroInscription}</TableCell>
                  )}
                  {!hiddenColumns.includes("dateVente") && (
                    <TableCell>{new Date(t.dateVente).toLocaleDateString("fr-CA")}</TableCell>
                  )}
                  {!hiddenColumns.includes("mrc") && <TableCell>{t.mrc}</TableCell>}
                  {!hiddenColumns.includes("municipalite") && <TableCell>{t.municipalite}</TableCell>}
                  {!hiddenColumns.includes("superficieTotaleHectare") && (
                    <TableCell className="text-right">{t.superficieTotaleHectare ?? "-"}</TableCell>
                  )}
                  {!hiddenColumns.includes("prixVente") && (
                    <TableCell className="text-right">
                      {t.prixVente ? t.prixVente.toLocaleString("fr-CA") : "-"}
                    </TableCell>
                  )}
                  {!hiddenColumns.includes("statut") && (
                    <TableCell>{statusBadge(t.enrichie?.statut)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border py-3">
        <span className="text-sm text-muted-foreground">
          Page {data.page} / {data.totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => onPageChange(data.page - 1)}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages}
            onClick={() => onPageChange(data.page + 1)}
          >
            Suivant
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
