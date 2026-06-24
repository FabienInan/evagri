import dynamic from "next/dynamic"

const TransactionMap = dynamic(
  () => import("@/components/transaction-map").then((m) => m.TransactionMap),
  { ssr: false }
)

export default function MapPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Carte des transactions</h1>
      <TransactionMap />
    </main>
  )
}
