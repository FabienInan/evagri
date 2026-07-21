import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Vercel gère son propre output. Standalone est réservé au build Docker.
  output: process.env.VERCEL ? undefined : "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
}

export default nextConfig
