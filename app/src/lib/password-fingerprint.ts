import { createHash } from "node:crypto"

/**
 * One-way fingerprint of a password hash, stored in the session token. When the password changes
 * (reset by an administrator, or changed by the user), the fingerprint no longer matches and every
 * existing session of the account stops working.
 */
export function empreinteMotDePasse(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 32)
}
