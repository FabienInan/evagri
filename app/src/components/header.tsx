"use client"

import { usePathname } from "next/navigation"
import { FolderOpen, User } from "lucide-react"
import { useHeaderActions } from "@/components/header-actions"

const PAGE_TITLES: Record<string, string> = {
  "/transactions": "Liste des transactions",
  "/transactions/map": "Carte des transactions",
  "/admin/import": "Gestion des imports",
  "/admin/filters": "Configuration des filtres",
}

export function Header({ title }: { title: string }) {
  const pathname = usePathname()
  const resolvedTitle = PAGE_TITLES[pathname] ?? title
  const { action } = useHeaderActions()
  const isAdmin = pathname.startsWith("/admin")

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
      <div className="flex items-center gap-2">
        <h1 className="truncate text-lg font-semibold text-foreground">{resolvedTitle}</h1>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {action && <div className="flex items-center">{action}</div>}
        {!isAdmin && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 shadow-sm">
            <FolderOpen className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Dossier 123456</span>
          </div>
        )}
        <span className="hidden lg:inline">Connecté en tant que</span>
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
          <User className="h-4 w-4" />
          <span className="font-medium text-foreground">Simon Audoire</span>
        </div>
      </div>
    </header>
  )
}
