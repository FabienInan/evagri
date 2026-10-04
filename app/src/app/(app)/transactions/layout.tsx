import { TransactionsToolbar } from "@/components/transactions-toolbar"
import { SelectedTransactionsProvider } from "@/components/selected-transactions-context"

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SelectedTransactionsProvider>
      <div className="space-y-4">
        <TransactionsToolbar />
        {children}
      </div>
    </SelectedTransactionsProvider>
  )
}
