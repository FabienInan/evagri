"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  changerRoleUtilisateur,
  definirActiviteUtilisateur,
  inviteUtilisateur,
  reinitialiserMotDePasseUtilisateur,
} from "@/server/actions/users"
import { ROLES } from "@/lib/roles"

const LIBELLES_ROLES: Record<(typeof ROLES)[number], string> = {
  ADMIN: "Administrateur",
  EVALUATEUR: "Évaluateur",
  DEVELOPPEUR: "Développeur",
}

export type UtilisateurLigne = {
  id: string
  email: string
  nom: string | null
  role: string
  actif: boolean
  createdAt: string
}

export function UtilisateursAdmin({
  utilisateurs,
  currentUserId,
}: {
  utilisateurs: UtilisateurLigne[]
  currentUserId: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [motDePasseTemporaire, setMotDePasseTemporaire] = useState<string | null>(null)
  const [reinitialisation, setReinitialisation] = useState<{ email: string; motDePasse: string } | null>(null)
  const [enCours, startTransition] = useTransition()

  const afficher = (resultat: { ok: true } | { ok: false; error: string }) => {
    if (resultat.ok) {
      setErreur(null)
      setMessage("Modification enregistrée")
      router.refresh()
    } else {
      setMessage(null)
      setErreur(resultat.error)
    }
  }

  const onInviter = (formData: FormData) => {
    setMessage(null)
    setErreur(null)
    setMotDePasseTemporaire(null)
    startTransition(async () => {
      const resultat = await inviteUtilisateur(formData)
      if (resultat.ok) {
        setMotDePasseTemporaire(resultat.motDePasseTemporaire)
        router.refresh()
      } else {
        setErreur(resultat.error)
      }
    })
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Gestion des utilisateurs</h1>
        <p className="text-sm text-muted-foreground">
          Les comptes sont créés avec un mot de passe temporaire, affiché une seule fois.
        </p>
      </div>

      <form action={onInviter} className="grid max-w-3xl gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="invite-email">Courriel</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-nom">Nom</Label>
          <Input id="invite-nom" name="nom" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-role">Rôle</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="EVALUATEUR"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {LIBELLES_ROLES[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-4">
          <Button type="submit" disabled={enCours}>
            Inviter l&apos;utilisateur
          </Button>
        </div>
      </form>

      {motDePasseTemporaire && (
        <div className="max-w-3xl rounded-md border border-border bg-muted p-4 text-sm">
          Mot de passe temporaire : <code className="font-mono font-semibold">{motDePasseTemporaire}</code>
          <p className="mt-1 text-muted-foreground">Transmettez-le à la personne par un autre canal. Il ne sera plus affiché.</p>
        </div>
      )}

      {reinitialisation && (
        <div className="max-w-3xl rounded-md border border-border bg-muted p-4 text-sm">
          Mot de passe temporaire de <strong>{reinitialisation.email}</strong> :{" "}
          <code className="font-mono font-semibold">{reinitialisation.motDePasse}</code>
          <p className="mt-1 text-muted-foreground">
            Il devra le changer à sa prochaine connexion. Transmettez-le par un autre canal. Il ne sera plus affiché.
          </p>
        </div>
      )}

      {erreur && <p className="text-sm text-destructive">{erreur}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 font-medium">Nom</th>
              <th className="p-2 font-medium">Courriel</th>
              <th className="p-2 font-medium">Rôle</th>
              <th className="p-2 font-medium">Statut</th>
              <th className="p-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((u) => {
              const estMoi = u.id === currentUserId
              return (
                <tr key={u.id} className="border-b border-border">
                  <td className="p-2">{u.nom ?? "—"}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <select
                      aria-label={`Rôle de ${u.email}`}
                      value={u.role}
                      disabled={estMoi || enCours}
                      onChange={(e) => {
                        const role = e.target.value
                        startTransition(async () => afficher(await changerRoleUtilisateur(u.id, role)))
                      }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {LIBELLES_ROLES[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">{u.actif ? "Actif" : "Désactivé"}</td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={estMoi || enCours}
                        title={estMoi ? "Modifiez votre propre mot de passe depuis votre compte" : undefined}
                        onClick={() =>
                          startTransition(async () => {
                            const resultat = await reinitialiserMotDePasseUtilisateur(u.id)
                            if (resultat.ok) {
                              setErreur(null)
                              setMessage(null)
                              setReinitialisation({ email: u.email, motDePasse: resultat.motDePasseTemporaire })
                            } else {
                              setMessage(null)
                              setErreur(resultat.error)
                            }
                          })
                        }
                      >
                        Réinitialiser le mot de passe
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={estMoi || enCours}
                        title={estMoi ? "Vous ne pouvez pas modifier votre propre compte" : undefined}
                        onClick={() =>
                          startTransition(async () => afficher(await definirActiviteUtilisateur(u.id, !u.actif)))
                        }
                      >
                        {u.actif ? "Désactiver" : "Réactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
