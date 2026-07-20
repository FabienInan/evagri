import { NextResponse } from "next/server"

const BASIC_AUTH_USER = "test"
const BASIC_AUTH_PASSWORD = "evagri"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const encoded = body.credentials
    if (!encoded) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const decoded = Buffer.from(encoded, "base64").toString("utf-8")
    const [user, password] = decoded.split(":")

    if (user === BASIC_AUTH_USER && password === BASIC_AUTH_PASSWORD) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
