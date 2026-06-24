"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, PanelLeft, PanelLeftClose, Sprout, User } from "lucide-react"
import { Button } from "@/components/ui/button"

const PAGE_TITLES: Record<string, string> = {
  "/transactions": "Liste des transactions",
  "/transactions/map": "Carte des transactions",
  "/admin/import": "Gestion des imports",
  "/admin/filters": "Configuration des filtres",
}

export function Header({
  onMenuClick,
  onCollapseClick,
  isSidebarCollapsed,
}: {
  onMenuClick: () => void
  onCollapseClick: () => void
  isSidebarCollapsed: boolean
}) {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? "EVAGRI"

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          onClick={onCollapseClick}
          aria-label={isSidebarCollapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {isSidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>

        <Link href="/transactions" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-foreground">EVAGRI</span>
        </Link>

        <h1 className="hidden text-lg font-semibold text-foreground sm:inline">{title}</h1>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="hidden sm:inline">Connecté en tant que</span>
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
          <User className="h-4 w-4" />
          <span className="font-medium text-foreground">Simon Audoire</span>
        </div>
      </div>
    </header>
  )
}
