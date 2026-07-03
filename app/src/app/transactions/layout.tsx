import { TransactionViewToggle } from "@/components/transaction-view-toggle"

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <TransactionViewToggle />
      </div>
      {children}
    </div>
  )
}
