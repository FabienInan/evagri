import { NextResponse } from "next/server"
import { createSessionCookie, verifyCredentials } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    if (!verifyCredentials(username, password)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const cookie = await createSessionCookie()
    const response = NextResponse.json({ ok: true })
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookie.maxAge,
    })

    return response
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
