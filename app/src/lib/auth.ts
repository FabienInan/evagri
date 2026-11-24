import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"
import {
  enregistrerEchecConnexion,
  reinitialiserEchecsConnexion,
  verrouillerUtilisateur,
} from "@/repositories/utilisateur.repository"

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

/** After this many consecutive failures the account refuses sign-in for DUREE_VERROU_CONNEXION_MS. */
export const MAX_ECHECS_CONNEXION = 5
export const DUREE_VERROU_CONNEXION_MS = 15 * 60 * 1000

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "courriel",
      credentials: {
        email: { label: "Courriel", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const utilisateur = await prisma.utilisateur.findFirst({
          where: { email: parsed.data.email, actif: true },
        })
        if (!utilisateur) return null
        // A locked account refuses even the right password, without comparing it. The refusal is the same
        // message as a wrong password, so the screen does not reveal that the account exists or is locked.
        if (utilisateur.verrouilleJusqua && utilisateur.verrouilleJusqua > new Date()) return null

        const valid = await bcrypt.compare(parsed.data.password, utilisateur.passwordHash)
        if (!valid) {
          const echecs = await enregistrerEchecConnexion(utilisateur.id)
          if (echecs >= MAX_ECHECS_CONNEXION) {
            await verrouillerUtilisateur(utilisateur.id, new Date(Date.now() + DUREE_VERROU_CONNEXION_MS))
          }
          return null
        }
        if (utilisateur.echecsConnexion > 0 || utilisateur.verrouilleJusqua) {
          await reinitialiserEchecsConnexion(utilisateur.id)
        }

        return {
          id: utilisateur.id,
          email: utilisateur.email,
          name: utilisateur.nom,
          role: utilisateur.role,
          organisationId: utilisateur.organisationId,
          empreinte: empreinteMotDePasse(utilisateur.passwordHash),
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.organisationId = user.organisationId
        token.empreinte = user.empreinte
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub ?? ""
      session.user.role = token.role
      session.user.organisationId = token.organisationId
      session.user.empreinte = token.empreinte
      return session
    },
  },
})
