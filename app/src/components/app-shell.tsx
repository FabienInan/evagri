"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { HeaderActionsProvider } from "@/components/header-actions"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        onCollapseClick={() => setIsSidebarCollapsed((prev) => !prev)}
        collapsed={isSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <HeaderActionsProvider>
          <Header title="EVAGRI" />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </HeaderActionsProvider>
      </div>
    </div>
  )
}
