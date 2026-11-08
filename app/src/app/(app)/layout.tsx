import { AppShell } from "@/components/app-shell"
import { CurrentPanierProvider } from "@/components/current-panier-context"

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <CurrentPanierProvider>
      <AppShell>{children}</AppShell>
    </CurrentPanierProvider>
  )
}
