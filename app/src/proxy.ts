import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const PUBLIC_PATHS = ["/api/health", "/api/auth", "/login", "/setup", "/pin.svg", "/pin-selected.svg"]

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl
  const isAuthenticated = !!request.auth
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Public pages are never redirected by the proxy: a session token may be stale (password reset,
  // deactivation). Pages decide from the database, so /login and the app cannot send each other in circles.
  if (isPublic) return NextResponse.next()

  if (isAuthenticated) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Authentication required", { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("from", pathname + search)
  return NextResponse.redirect(loginUrl)
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
