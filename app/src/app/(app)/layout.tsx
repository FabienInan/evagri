import { AppShell } from "@/components/app-shell"
import { ConsentBanner } from "@/components/consent-banner"
import { CurrentPanierProvider } from "@/components/current-panier-context"
import { redirect } from "next/navigation"
import { getCurrentUser, PAGE_CHANGEMENT_MOT_DE_PASSE, zonesDeLUtilisateur } from "@/lib/session"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.motDePasseTemporaire) redirect(PAGE_CHANGEMENT_MOT_DE_PASSE)
  const doitAccepterPolitique = !user.consentementPolitiqueAt
  const zones = await zonesDeLUtilisateur()

  return (
    <CurrentPanierProvider>
      <AppShell zones={zones} nomUtilisateur={user.nom ?? user.email}>{children}</AppShell>
      {doitAccepterPolitique && <ConsentBanner />}
    </CurrentPanierProvider>
  )
}
