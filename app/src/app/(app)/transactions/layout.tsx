import { TransactionsLayoutShell } from "@/components/transactions-layout-shell"
import { SelectedTransactionsProvider } from "@/components/selected-transactions-context"
import { FilterPanelVisibilityProvider } from "@/hooks/use-filter-panel-visibility"

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SelectedTransactionsProvider>
      <FilterPanelVisibilityProvider>
        <TransactionsLayoutShell>{children}</TransactionsLayoutShell>
      </FilterPanelVisibilityProvider>
    </SelectedTransactionsProvider>
  )
}
