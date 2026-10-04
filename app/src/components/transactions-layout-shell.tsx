"use client"

import { usePathname } from "next/navigation"
import { TransactionsToolbar } from "@/components/transactions-toolbar"

/** Enveloppe partagée par les vues transactions. La liste (`/transactions`) occupe toute la hauteur
 *  sur desktop pour donner aux filtres et à la table des scrolls indépendants ; la carte et la fiche
 *  gardent le flux de page normal. */
export function TransactionsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isList = pathname === "/transactions"

  return (
    <div
      className={
        isList
          ? "flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden"
          : "space-y-4"
      }
    >
      <TransactionsToolbar embedded={isList} />
      {children}
    </div>
  )
}
