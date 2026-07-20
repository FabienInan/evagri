import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const BASIC_AUTH_USER = "test"
const BASIC_AUTH_PASSWORD = "evagri"

const PUBLIC_PATHS = ["/api/health", "/api/login", "/login", "/pin.svg", "/pin-selected.svg"]

export function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const auth = request.headers.get("authorization")

  if (auth) {
    const [scheme, encoded] = auth.split(" ")
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8")
      const [user, password] = decoded.split(":")
      if (user === BASIC_AUTH_USER && password === BASIC_AUTH_PASSWORD) {
        return NextResponse.next()
      }
    }
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Evagri"',
      },
    })
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("from", request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
