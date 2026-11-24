"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { logout } from "@/server/actions/auth"
import { changerMotDePasse } from "@/server/actions/compte"

export function ChangerMotDePasseForm({ obligatoire }: { obligatoire: boolean }) {
  const [erreur, setErreur] = useState("")
  const [enCours, setEnCours] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErreur("")
    setEnCours(true)
    try {
      const resultat = await changerMotDePasse(new FormData(e.currentTarget))
      if (!resultat.ok) {
        setErreur(resultat.error)
        setEnCours(false)
        return
      }
      // Every session opened with the old password is now void: sign in again with the new one.
      await logout()
    } catch {
      setErreur("Une erreur est survenue")
      setEnCours(false)
    }
  }

  return (
    <Card className="border-border/60 shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Changer le mot de passe</CardTitle>
        <CardDescription>
          {obligatoire
            ? "Votre mot de passe a été réinitialisé. Choisissez-en un nouveau pour continuer."
            : "Saisissez votre mot de passe actuel, puis le nouveau."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="actuel">Mot de passe actuel</Label>
            <Input id="actuel" name="actuel" type="password" autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nouveau">Nouveau mot de passe</Label>
            <Input id="nouveau" name="nouveau" type="password" autoComplete="new-password" minLength={12} required />
            <p className="text-xs text-muted-foreground">12 caractères minimum.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation">Confirmation</Label>
            <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required />
          </div>

          {erreur && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erreur}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={enCours}>
            {enCours ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer le nouveau mot de passe"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
