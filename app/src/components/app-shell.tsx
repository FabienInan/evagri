"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        onCollapseClick={() => setIsSidebarCollapsed((prev) => !prev)}
        collapsed={isSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title="EVAGRI" />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
