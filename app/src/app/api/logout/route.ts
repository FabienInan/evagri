import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME } from "@/lib/auth"

export async function GET() {
  const response = NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"))
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
