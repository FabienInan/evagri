export const AUTH_COOKIE_NAME = "evagri_session"
export const AUTH_USER = "test"
export const AUTH_PASSWORD = "evagri"

const SESSION_VERSION = "v1"
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not defined")
  }
  return secret
}

async function sign(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(getSecret())
  const message = encoder.encode(value)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function createSessionCookie(): Promise<{ name: string; value: string; maxAge: number }> {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = `${SESSION_VERSION}:${expiresAt}`
  const signature = await sign(payload)
  return {
    name: AUTH_COOKIE_NAME,
    value: `${payload}:${signature}`,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  }
}

export async function verifySessionCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false

  const parts = cookieValue.split(":")
  if (parts.length !== 3) return false

  const [version, expiresAtStr, signature] = parts
  if (version !== SESSION_VERSION) return false

  const expectedSignature = await sign(`${version}:${expiresAtStr}`)
  if (signature.length !== expectedSignature.length) return false

  const signatureBytes = new Uint8Array(signature.length / 2)
  const expectedBytes = new Uint8Array(expectedSignature.length / 2)
  for (let i = 0; i < signature.length; i += 2) {
    signatureBytes[i / 2] = parseInt(signature.slice(i, i + 2), 16)
    expectedBytes[i / 2] = parseInt(expectedSignature.slice(i, i + 2), 16)
  }

  if (!timingSafeEqual(signatureBytes, expectedBytes)) {
    return false
  }

  const expiresAt = parseInt(expiresAtStr, 10)
  if (isNaN(expiresAt)) return false

  return Date.now() < expiresAt
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

export function verifyCredentials(user: string, password: string): boolean {
  return user === AUTH_USER && password === AUTH_PASSWORD
}
