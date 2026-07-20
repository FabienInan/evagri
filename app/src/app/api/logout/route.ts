import { NextResponse } from "next/server"

export async function GET() {
  const response = new NextResponse("Logged out", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Evagri", charset="UTF-8"',
    },
  })

  response.cookies.set("evagri_auth", "", {
    expires: new Date(0),
    path: "/",
  })

  return response
}
