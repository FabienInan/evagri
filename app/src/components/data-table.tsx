"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp, Loader2, MoveHorizontal, Settings2 } from "lucide-react"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import {
  loadColumnOrder,
  saveColumnOrder,
  clearColumnOrder,
  loadColumnWidths,
  saveColumnWidths,
  clearColumnWidths,
  clampColumnWidth,
} from "@/lib/responsive-columns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type DataTableColumn<T> = {
  key: string
  label: string
  numeric?: boolean
  sortable?: boolean
  /** Column is shown by default when no user preference/auto-collapse has run. Defaults to true. */
  defaultVisible?: boolean
  minWidth?: number
  priority?: number
  /** Column can't be hidden or dragged (e.g. a trailing actions column). */
  locked?: boolean
  render: (row: T) => ReactNode
}

/** Applies a saved key order to the current column list, appending any unknown columns at the end. */
function applySavedOrder<T>(columns: DataTableColumn<T>[], order: string[] | null): DataTableColumn<T>[] {
  if (!order || order.length === 0) return columns
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const ordered: DataTableColumn<T>[] = []
  for (const key of order) {
    const col = byKey.get(key)
    if (col) {
      ordered.push(col)
      byKey.delete(key)
    }
  }
  ordered.push(...byKey.values())
  return ordered
}

function moveKeyBefore(order: string[], fromKey: string, toKey: string): string[] {
  if (fromKey === toKey) return order
  const next = order.filter((k) => k !== fromKey)
  const toIndex = next.indexOf(toKey)
  if (toIndex === -1) return order
  next.splice(toIndex, 0, fromKey)
  return next
}

function ColumnMenu<T>({
  columns,
  visibleColumns,
  toggleColumn,
  hasUserOverride,
  resetColumns,
}: {
  columns: DataTableColumn<T>[]
  visibleColumns: Set<string>
  toggleColumn: (key: string) => void
  hasUserOverride: boolean
  resetColumns: () => void
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs" onClick={() => setShow((prev) => !prev)}>
        <Settings2 className="h-4 w-4" />
        Colonnes
      </Button>
      {show && (
        <div className="absolute right-0 z-50 mt-1 flex max-h-[min(24rem,70vh)] w-64 flex-col overflow-hidden rounded-md border border-border bg-card p-2 shadow-md">
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-0.5">
              {columns
                .filter((c) => !c.locked)
                .map((col) => (
                  <label key={col.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
            </div>
          </div>
          {hasUserOverride && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                className="w-full shrink-0 rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  resetColumns()
                  setShow(false)
                }}
              >
                Réinitialiser l&apos;affichage auto
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Drag handle pinned to the right edge of a header cell. During the drag it reports each candidate width to
 * the parent (live preview); the parent persists on pointer up. Pointer capture keeps the move/up events on
 * the handle even when the cursor leaves it, and every handler stops propagation so a resize never sorts or
 * reorders the column.
 */
function ColumnResizeHandle({
  columnKey,
  width,
  onResize,
  onResizeEnd,
}: {
  columnKey: string
  width: number | undefined
  onResize: (key: string, width: number) => void
  onResizeEnd: () => void
}) {
  const startRef = useRef<{ x: number; w: number } | null>(null)

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionner la colonne"
      className="group absolute right-0 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none select-none items-center justify-center"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const header = e.currentTarget.parentElement as HTMLElement | null
        const startWidth = width ?? header?.getBoundingClientRect().width ?? 120
        startRef.current = { x: e.clientX, w: startWidth || 120 }
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        const start = startRef.current
        if (!start) return
        onResize(columnKey, clampColumnWidth(start.w + (e.clientX - start.x)))
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        if (!startRef.current) return
        startRef.current = null
        e.currentTarget.releasePointerCapture?.(e.pointerId)
        onResizeEnd()
      }}
      onPointerCancel={() => {
        startRef.current = null
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Visible affordance: without it a thin invisible edge is impossible to discover. */}
      <MoveHorizontal
        aria-hidden="true"
        className="pointer-events-none h-3 w-3 text-muted-foreground/50 transition-colors group-hover:text-primary"
      />
    </span>
  )
}

function DataTableHeader<T>({
  visible,
  sortField,
  sortOrder,
  onSort,
  onReorderColumn,
  columnWidths,
  onColumnResize,
  onColumnResizeEnd,
  sticky = false,
}: {
  visible: DataTableColumn<T>[]
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
  onReorderColumn: (fromKey: string, toKey: string) => void
  columnWidths: Record<string, number>
  onColumnResize: (key: string, width: number) => void
  onColumnResizeEnd: () => void
  /** Keeps the header pinned to the top of the scrolling body (fill-height mode). */
  sticky?: boolean
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  return (
    <TableHeader
      className={cn(
        "bg-muted/50",
        sticky && "lg:sticky lg:top-0 lg:z-10 lg:bg-muted"
      )}
    >
      <TableRow>
        {visible.map((col) => {
          const draggable = !col.locked
          const width = columnWidths[col.key]
          return (
            <TableHead
              key={col.key}
              draggable={draggable}
              onDragStart={(e) => {
                if (!draggable) return
                setDraggedKey(col.key)
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragOver={(e) => {
                if (!draggable || !draggedKey || draggedKey === col.key) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (dragOverKey !== col.key) setDragOverKey(col.key)
              }}
              onDragLeave={() => setDragOverKey((prev) => (prev === col.key ? null : prev))}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedKey && draggedKey !== col.key) onReorderColumn(draggedKey, col.key)
                setDraggedKey(null)
                setDragOverKey(null)
              }}
              onDragEnd={() => {
                setDraggedKey(null)
                setDragOverKey(null)
              }}
              style={width ? { width, minWidth: width, maxWidth: width } : undefined}
              className={`relative py-2 select-none ${col.numeric ? "text-right" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${draggedKey === col.key ? "opacity-40" : ""} ${dragOverKey === col.key ? "bg-primary/10" : ""} ${width ? "overflow-hidden" : ""}`}
              onClick={() => col.sortable && onSort?.(col.key)}
            >
              {col.sortable ? (
                <span className="flex items-center gap-1 font-semibold cursor-pointer">
                  {col.label}
                  {sortField === col.key &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ))}
                </span>
              ) : (
                <span className="font-semibold">{col.label}</span>
              )}
              <ColumnResizeHandle
                columnKey={col.key}
                width={width}
                onResize={onColumnResize}
                onResizeEnd={onColumnResizeEnd}
              />
            </TableHead>
          )
        })}
      </TableRow>
    </TableHeader>
  )
}

export interface DataTableProps<T> {
  /** Unique per-table key used to namespace visibility/order preferences in localStorage. */
  storageKey: string
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
  loading?: boolean
  sentinelRef?: React.RefObject<HTMLDivElement | null>
  title?: string
  totalCount?: number
  toolbar?: ReactNode
  emptyMessage?: string
  onRowClick?: (row: T) => void
  /** Highlights the row in yellow (shared selection with the map view). */
  isRowSelected?: (row: T) => boolean
  /** Use "bare" to skip the outer Card, e.g. when embedding inside an existing Card. Defaults to "card". */
  variant?: "card" | "bare"
  /** Fills its container's height (lg+) and scrolls the body, keeping the header pinned. Defaults to false. */
  fillHeight?: boolean
}

export function DataTable<T>({
  storageKey,
  columns,
  rows,
  rowKey,
  sortField,
  sortOrder,
  onSort,
  loading = false,
  sentinelRef,
  title,
  totalCount,
  toolbar,
  emptyMessage = "Aucun résultat",
  onRowClick,
  isRowSelected,
  variant = "card",
  fillHeight = false,
}: DataTableProps<T>) {
  const visibleStorageKey = `evagri:${storageKey}:visible-columns`
  const orderStorageKey = `evagri:${storageKey}:column-order`
  const widthsStorageKey = `evagri:${storageKey}:column-widths`

  const requiredKeys = useMemo(() => columns.filter((c) => c.locked).map((c) => c.key), [columns])
  const initialVisible = useMemo(
    () => new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)),
    [columns]
  )
  const columnMeta = useMemo(
    () => columns.map((c) => ({ key: c.key, minWidth: c.minWidth ?? 120, priority: c.priority ?? 1 })),
    [columns]
  )

  const {
    containerRef,
    visibleColumns,
    toggleColumn,
    resetColumns,
    hasUserOverride,
  } = useResponsiveColumns(columnMeta, initialVisible, requiredKeys, visibleStorageKey)

  const [columnOrder, setColumnOrder] = useState<string[] | null>(null)
  const orderLoadedRef = useRef(false)
  useEffect(() => {
    if (orderLoadedRef.current) return
    orderLoadedRef.current = true
    setColumnOrder(loadColumnOrder(orderStorageKey))
  }, [orderStorageKey])

  // User-chosen column widths, keyed by column. Persisted per table, like visibility and order.
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const widthsLoadedRef = useRef(false)
  useEffect(() => {
    if (widthsLoadedRef.current) return
    widthsLoadedRef.current = true
    setColumnWidths(loadColumnWidths(widthsStorageKey) ?? {})
  }, [widthsStorageKey])

  // Mirror of the latest widths so the pointer-up commit reads them without a stale closure.
  const widthsRef = useRef(columnWidths)
  useEffect(() => {
    widthsRef.current = columnWidths
  }, [columnWidths])

  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: width }))
  }, [])

  const handleColumnResizeEnd = useCallback(() => {
    saveColumnWidths(widthsRef.current, widthsStorageKey)
  }, [widthsStorageKey])

  const orderedColumns = useMemo(() => applySavedOrder(columns, columnOrder), [columns, columnOrder])
  const visible = useMemo(
    () => orderedColumns.filter((c) => visibleColumns.has(c.key)),
    [orderedColumns, visibleColumns]
  )

  function handleReorderColumn(fromKey: string, toKey: string) {
    const nextOrder = moveKeyBefore(orderedColumns.map((c) => c.key), fromKey, toKey)
    setColumnOrder(nextOrder)
    saveColumnOrder(nextOrder, orderStorageKey)
  }

  function handleResetColumns() {
    resetColumns()
    clearColumnOrder(orderStorageKey)
    setColumnOrder(null)
    clearColumnWidths(widthsStorageKey)
    setColumnWidths({})
  }

  const Wrapper = variant === "bare" ? "div" : Card
  const Body = variant === "bare" ? "div" : CardContent
  const bodyProps =
    variant === "bare"
      ? {}
      : { className: cn("p-0", fillHeight && "lg:min-h-0 lg:flex-1 lg:overflow-auto") }

  return (
    <Wrapper className={cn("flex flex-col min-w-0", fillHeight && "lg:h-full lg:min-h-0")} ref={containerRef}>
      {(title !== undefined || totalCount !== undefined || toolbar) && (
        <div className="flex items-center justify-between border-b px-4 py-1">
          <span className="text-sm font-semibold text-foreground">
            {title}
            {totalCount !== undefined && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({totalCount} élément{totalCount > 1 ? "s" : ""})
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {toolbar}
            <ColumnMenu
              columns={columns}
              visibleColumns={visibleColumns}
              toggleColumn={toggleColumn}
              hasUserOverride={hasUserOverride || !!columnOrder}
              resetColumns={handleResetColumns}
            />
          </div>
        </div>
      )}
      <Body {...bodyProps}>
        <Table
          containerClassName={fillHeight ? "overflow-x-auto lg:overflow-visible" : undefined}
        >
          <DataTableHeader
            visible={visible}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
            onReorderColumn={handleReorderColumn}
            columnWidths={columnWidths}
            onColumnResize={handleColumnResize}
            onColumnResizeEnd={handleColumnResizeEnd}
            sticky={fillHeight}
          />
          <TableBody>
            {rows.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={Math.max(visible.length, 1)} className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => {
                const selected = isRowSelected?.(row) ?? false
                return (
                  <TableRow
                    key={rowKey(row, index)}
                    className={cn(
                      onRowClick && "cursor-pointer",
                      selected ? "bg-accent/25 hover:bg-accent/35" : onRowClick && "hover:bg-muted/30"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {visible.map((col) => {
                      const width = columnWidths[col.key]
                      return (
                        <TableCell
                          key={col.key}
                          style={width ? { width, minWidth: width, maxWidth: width } : undefined}
                          className={`py-2 ${col.numeric ? "text-right" : ""} ${width ? "overflow-hidden text-ellipsis" : ""}`}
                        >
                          {col.render(row)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {loading && (
          <div className="flex items-center justify-center gap-2 border-t border-border py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        )}
        {sentinelRef && <div ref={sentinelRef} className="h-4" />}
      </Body>
    </Wrapper>
  )
}
