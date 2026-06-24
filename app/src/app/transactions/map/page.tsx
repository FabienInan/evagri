"use client"

import dynamic from "next/dynamic"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TransactionViewToggle } from "@/components/transaction-view-toggle"

const TransactionMap = dynamic(
  () => import("@/components/transaction-map").then((m) => m.TransactionMap),
  { ssr: false }
)

export default function MapPage() {
  return (
    <Card className="h-[calc(100vh-8rem)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Carte des transactions</CardTitle>
            <CardDescription>Visualisation géographique des ventes agricoles</CardDescription>
          </div>
          <TransactionViewToggle />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <TransactionMap />
      </CardContent>
    </Card>
  )
}
