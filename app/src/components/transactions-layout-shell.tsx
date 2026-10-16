"use client"

import { usePathname } from "next/navigation"
import { TransactionsToolbar } from "@/components/transactions-toolbar"

/** Enveloppe partagée par les vues transactions. La liste (`/transactions`) et la carte
 *  (`/transactions/map`) occupent toute la hauteur sur desktop : la barre d'actions y est `embedded`
 *  (statique, sans marge verticale négative) et le contenu remplit l'espace restant, ce qui évite que
 *  la barre opaque recouvre le haut des filtres et de la carte. La fiche garde le flux de page normal. */
export function TransactionsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFullHeight = pathname === "/transactions" || pathname === "/transactions/map"

  return (
    <div
      className={
        isFullHeight
          ? "flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden"
          : "space-y-4"
      }
    >
      <TransactionsToolbar embedded={isFullHeight} />
      {children}
    </div>
  )
}
