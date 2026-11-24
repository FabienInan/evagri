import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      organisationId: string
      empreinte: string
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    organisationId: string
    empreinte: string
  }
}

// next-auth/jwt re-exports @auth/core/jwt: augment the module that actually declares JWT.
declare module "@auth/core/jwt" {
  interface JWT {
    role: string
    organisationId: string
    empreinte: string
  }
}
