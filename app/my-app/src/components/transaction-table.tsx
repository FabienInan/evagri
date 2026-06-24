"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

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
  { key: "numeroInscription", label: "N° d'inscription" },
  { key: "dateVente", label: "Date" },
  { key: "mrc", label: "MRC" },
  { key: "municipalite", label: "Municipalité" },
  { key: "superficieTotaleHectare", label: "Superficie (ha)" },
  { key: "prixVente", label: "Prix ($)" },
  { key: "statut", label: "Statut" },
]

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

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {COLUMNS.map((col) => (
          <label key={col.key} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={!hiddenColumns.includes(col.key)}
              onChange={() => toggleColumn(col.key)}
            />
            {col.label}
          </label>
        ))}
      </div>
      <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              {COLUMNS.filter((c) => !hiddenColumns.includes(c.key)).map((col) => (
                <th
                  key={col.key}
                  className="text-left p-2 cursor-pointer"
                  onClick={() => onSort(col.key)}
                >
                  {col.label} {sortField === col.key ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id} className="border-b hover:bg-stone-50">
                {!hiddenColumns.includes("numeroInscription") && <td className="p-2">{t.numeroInscription}</td>}
                {!hiddenColumns.includes("dateVente") && (
                  <td className="p-2">{new Date(t.dateVente).toLocaleDateString("fr-CA")}</td>
                )}
                {!hiddenColumns.includes("mrc") && <td className="p-2">{t.mrc}</td>}
                {!hiddenColumns.includes("municipalite") && <td className="p-2">{t.municipalite}</td>}
                {!hiddenColumns.includes("superficieTotaleHectare") && (
                  <td className="p-2">{t.superficieTotaleHectare ?? "-"}</td>
                )}
                {!hiddenColumns.includes("prixVente") && (
                  <td className="p-2">{t.prixVente ? t.prixVente.toLocaleString("fr-CA") : "-"}</td>
                )}
                {!hiddenColumns.includes("statut") && (
                  <td className="p-2">{t.enrichie?.statut ?? "NON_ANALYSEE"}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <Button disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>
          Précédent
        </Button>
        <span>Page {data.page} / {data.totalPages}</span>
        <Button disabled={data.page >= data.totalPages} onClick={() => onPageChange(data.page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  )
}
