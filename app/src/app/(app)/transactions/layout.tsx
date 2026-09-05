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
        {/* Negative margins span the scroll container's padding so the bar spans full width when stuck. */}
        <div className="sticky top-0 z-40 -mx-4 -mt-4 flex items-center justify-end border-b border-border bg-background px-4 py-2 lg:-mx-6 lg:-mt-6 lg:px-6">
          <TransactionViewToggle />
        </div>
        {children}
      </div>
    </SelectedTransactionsProvider>
  )
}
