"use client"

import { usePathname } from "next/navigation"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionViewToggle } from "@/components/transaction-view-toggle"

/** Barre d'actions de la liste des transactions (panier + bascule Liste/Carte). Elle ne concerne que
 *  les vues de liste et de carte : la fiche transaction (`/transactions/<id>`) ne l'affiche pas. */
export function TransactionsToolbar() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const isFiche = segments[0] === "transactions" && segments.length === 2 && segments[1] !== "map"
  if (isFiche) return null

  return (
    // -mx spans the scroll container's padding; negative top offsets the -my margin so the bar sticks flush with no see-through strip.
    <div className="sticky -top-4 z-[1001] -mx-4 -my-4 flex items-center justify-end gap-2 bg-background px-4 py-3 lg:-top-6 lg:-mx-6 lg:-my-6 lg:px-6">
      <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
        <ShoppingCart className="h-4 w-4" />
        Paniers
      </Button>
      <TransactionViewToggle />
    </div>
  )
}
