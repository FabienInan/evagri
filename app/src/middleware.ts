import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, verifySessionCookie } from "@/lib/auth"

const PUBLIC_PATHS = ["/api/health", "/api/login", "/api/logout", "/login", "/pin.svg", "/pin-selected.svg"]

export async function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const isAuthenticated = await verifySessionCookie(sessionCookie)

  if (isAuthenticated) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Authentication required", { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("from", request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
