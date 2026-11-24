"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { HeaderActionsProvider } from "@/components/header-actions"
import type { Zone } from "@/lib/roles"

export function AppShell({
  children,
  zones,
  nomUtilisateur,
}: {
  children: React.ReactNode
  zones: readonly Zone[]
  nomUtilisateur: string
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        onCollapseClick={() => setIsSidebarCollapsed((prev) => !prev)}
        collapsed={isSidebarCollapsed}
        zones={zones}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <HeaderActionsProvider>
          <Header title="EVAGRI" nomUtilisateur={nomUtilisateur} />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </HeaderActionsProvider>
      </div>
    </div>
  )
}
