"use client"

import { usePathname } from "next/navigation"
import { PanelLeft, PanelLeftClose, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionViewToggle } from "@/components/transaction-view-toggle"
import { useFilterPanelVisibility } from "@/hooks/use-filter-panel-visibility"
import { cn } from "@/lib/utils"

/** Barre d'actions de la liste des transactions (titre, bascule filtres, panier, bascule Liste/Carte).
 *  Elle ne concerne que les vues de liste et de carte : la fiche transaction (`/transactions/<id>`)
 *  ne l'affiche pas.
 *  `embedded` : la liste vit dans un conteneur pleine hauteur (pas de scroll de page) sur desktop ;
 *  la barre n'a alors plus besoin d'être collante et ne doit pas déborder sur le contenu via ses
 *  marges verticales négatives. */
export function TransactionsToolbar({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const isFiche = segments[0] === "transactions" && segments.length === 2 && segments[1] !== "map"
  const { visible: showFilters, toggle: toggleFilters } = useFilterPanelVisibility()
  if (isFiche) return null

  const title = segments[1] === "map" ? "Carte des transactions" : "Liste des transactions"

  return (
    // Non-embedded: -mx spans the scroll container's padding; negative top offsets the -my margin so the bar sticks flush with no see-through strip.
    // Embedded: sticky still applies on mobile (page still scrolls); on lg it becomes static with no negative vertical margin inside the flex column.
    <div
      className={cn(
        "flex items-center justify-between gap-3 bg-background px-4 py-3 lg:px-6",
        embedded
          ? "sticky -top-4 z-[1001] -mx-4 -my-4 lg:static lg:my-0 lg:-mx-6"
          : "sticky -top-4 z-[1001] -mx-4 -my-4 lg:-top-6 lg:-mx-6 lg:-my-6"
      )}
    >
      <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={toggleFilters}>
          {showFilters ? (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="hidden sm:inline">Cacher les filtres</span>
            </>
          ) : (
            <>
              <PanelLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Afficher les filtres</span>
            </>
          )}
        </Button>
        <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <ShoppingCart className="h-4 w-4" />
          Paniers
        </Button>
        <TransactionViewToggle />
      </div>
    </div>
  )
}
