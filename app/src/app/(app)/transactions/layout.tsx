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
        <div className="flex items-center justify-end">
          <TransactionViewToggle />
        </div>
        {children}
      </div>
    </SelectedTransactionsProvider>
  )
}
