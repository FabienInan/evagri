"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { LayoutList, Map } from "lucide-react"
import { cn } from "@/lib/utils"

export function TransactionViewToggle() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const otherHref = pathname === "/transactions"
    ? `/transactions/map?${searchParams.toString()}`
    : `/transactions?${searchParams.toString()}`

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card p-1 shadow-sm">
      <Link
        href={`/transactions?${searchParams.toString()}`}
        className={cn(
          "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-colors",
          pathname === "/transactions"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <LayoutList className="h-4 w-4" />
        <span className="hidden sm:inline">Liste</span>
      </Link>
      <Link
        href={otherHref}
        className={cn(
          "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-colors",
          pathname === "/transactions/map"
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
