"use client"

import dynamic from "next/dynamic"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const TransactionMap = dynamic(
  () => import("@/components/transaction-map").then((m) => m.TransactionMap),
  { ssr: false }
)

export default function MapPage() {
  return (
    <Card className="h-[calc(100vh-8rem)]">
      <CardHeader className="pb-3">
        <CardTitle>Carte des transactions</CardTitle>
        <CardDescription>Visualisation géographique des ventes agricoles</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <TransactionMap />
      </CardContent>
    </Card>
  )
}
