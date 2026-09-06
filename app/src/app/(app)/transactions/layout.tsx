import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionViewToggle } from "@/components/transaction-view-toggle"
import { SelectedTransactionsProvider } from "@/components/selected-transactions-context"

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SelectedTransactionsProvider>
      <div className="space-y-4">
        {/* -mx spans the scroll container's padding; negative top offsets the -my margin so the bar sticks flush with no see-through strip. */}
        <div className="sticky -top-4 z-[1001] -mx-4 -my-4 flex items-center justify-end gap-2 bg-background px-4 py-3 lg:-top-6 lg:-mx-6 lg:-my-6 lg:px-6">
          <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <ShoppingCart className="h-4 w-4" />
            Paniers
          </Button>
          <TransactionViewToggle />
        </div>
        {children}
      </div>
    </SelectedTransactionsProvider>
  )
}
