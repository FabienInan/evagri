"use server"

import { AuthError } from "next-auth"
import { signIn, signOut } from "@/lib/auth"

export type AuthActionResult = { ok: true } | { ok: false; error: string }

export async function login(email: string, password: string): Promise<AuthActionResult> {
  try {
    await signIn("credentials", { email, password, redirect: false })
    return { ok: true }
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Identifiants invalides" }
    }
    // Any other failure (database unreachable, for example) is reported on screen, not thrown: Next masks thrown messages.
    console.error("login: échec de la connexion", error)
    return { ok: false, error: "Une erreur est survenue. Réessayez." }
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}
