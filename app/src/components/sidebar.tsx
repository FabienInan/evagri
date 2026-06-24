"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutList, Upload, SlidersHorizontal, LogOut, Sprout } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { href: "/transactions", label: "Liste des transactions", icon: LayoutList },
  { href: "/admin/import", label: "Gestion des imports", icon: Upload },
  { href: "/admin/filters", label: "Configuration des filtres", icon: SlidersHorizontal },
]

export function Sidebar({
  isOpen,
  onClose,
  collapsed = false,
}: {
  isOpen: boolean
  onClose: () => void
  collapsed?: boolean
}) {
  const pathname = usePathname()

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-full flex-col border-r border-border bg-card transition-all duration-200 ease-in-out md:sticky md:top-0 md:h-screen",
          collapsed ? "w-16" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("flex h-16 items-center gap-2 border-b border-border px-4", collapsed && "justify-center px-2")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          {!collapsed && <span className="text-lg font-bold text-foreground">EVAGRI</span>}
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
                    onClick={onClose}
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
    </>
  )
}
