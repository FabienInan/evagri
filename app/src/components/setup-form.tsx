"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { createPremierAdministrateur } from "@/server/actions/setup"

export function SetupForm() {
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await createPremierAdministrateur(new FormData(e.currentTarget))
      if (!result.ok) {
        setError(result.error)
        setIsLoading(false)
        return
      }
      // Full navigation: the action has just re-rendered this page, which made a client-side push stay on the form.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- navigation complète voulue (voir ci-dessus)
      window.location.assign("/login")
    } catch {
      setError("Une erreur est survenue")
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-border/60 shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Configuration initiale</CardTitle>
        <CardDescription>
          Créez le premier compte administrateur. Cette page n&apos;est accessible qu&apos;une seule fois.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom complet</Label>
            <Input id="nom" name="nom" autoComplete="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Courriel</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
            <p className="text-xs text-muted-foreground">12 caractères minimum.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation">Confirmation du mot de passe</Label>
            <Input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer l'administrateur"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
