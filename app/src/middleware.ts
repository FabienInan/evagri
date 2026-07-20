import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const BASIC_AUTH_USER = "test"
const BASIC_AUTH_PASSWORD = "evagri"

const PUBLIC_PATHS = ["/api/health", "/pin.svg", "/pin-selected.svg"]

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

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Evagri"',
    },
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
