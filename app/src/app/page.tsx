import { redirect } from "next/navigation"
import { getCurrentUser, pageAccueil, PAGE_CHANGEMENT_MOT_DE_PASSE } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.motDePasseTemporaire) redirect(PAGE_CHANGEMENT_MOT_DE_PASSE)
  redirect(pageAccueil(user.role))
}
