"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { LayoutList, Map } from "lucide-react"
import { cn } from "@/lib/utils"

export function TransactionViewToggle() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const withQuery = (path: string) => (query ? `${path}?${query}` : path)

  const isListView = pathname === "/transactions"
  const isMapView = pathname === "/transactions/map"

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card p-1 shadow-sm">
      <Link
        href={withQuery("/transactions")}
        className={cn(
          "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-colors",
          isListView
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <LayoutList className="h-4 w-4" />
        <span className="hidden sm:inline">Liste</span>
      </Link>
      <Link
        href={withQuery("/transactions/map")}
        className={cn(
          "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-colors",
          isMapView
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Map className="h-4 w-4" />
        <span className="hidden sm:inline">Carte</span>
      </Link>
    </div>
  )
}
