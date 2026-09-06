import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Vercel gère son propre output. Standalone est réservé au build Docker.
  output: process.env.VERCEL ? undefined : "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Router cache for dynamic pages: makes Liste<->Carte toggles instant (30s staleness tolerated).
    staleTimes: {
      dynamic: 30,
    },
  },
}

export default nextConfig
