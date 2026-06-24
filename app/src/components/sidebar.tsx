"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutList,
  Upload,
  SlidersHorizontal,
  LogOut,
  PanelLeftClose,
  Sprout,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { href: "/transactions", label: "Liste des transactions", icon: LayoutList },
  { href: "/admin/import", label: "Gestion des imports", icon: Upload },
  { href: "/admin/filters", label: "Configuration des filtres", icon: SlidersHorizontal },
]

export function Sidebar({
  onCollapseClick,
  collapsed = false,
}: {
  onCollapseClick: () => void
  collapsed?: boolean
}) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "sticky top-0 z-50 flex h-screen shrink-0 flex-col border-r border-border bg-card transition-all duration-200 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-2 px-4")}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary p-0 text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            collapsed ? "cursor-pointer" : ""
          )}
          onClick={collapsed ? onCollapseClick : undefined}
          aria-label={collapsed ? "Déplier le menu" : undefined}
          asChild={!collapsed}
        >
          {collapsed ? (
            <Sprout className="h-5 w-5" />
          ) : (
            <Link href="/transactions" className="flex h-8 w-8 items-center justify-center">
              <Sprout className="h-5 w-5" />
            </Link>
          )}
        </Button>

        {!collapsed && <span className="text-lg font-bold text-foreground">EVAGRI</span>}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onCollapseClick}
            aria-label="Replier le menu"
          >
            <PanelLeftClose className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-2" : "px-3",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={cn("border-t border-border p-3", collapsed && "px-2")}>
        <Button
          variant="ghost"
          className={cn(
            "gap-3 text-muted-foreground hover:text-foreground",
            collapsed ? "w-full justify-center px-2" : "w-full justify-start"
          )}
          title="Déconnexion"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Déconnexion"}
        </Button>
      </div>
    </aside>
  )
}
