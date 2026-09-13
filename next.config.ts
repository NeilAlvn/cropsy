import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // This repo is nested inside the website checkout ("Gropsy App/"), which has
  // its own lockfile. Without an explicit root Turbopack walks up to that
  // lockfile and picks up the website's src/proxy.ts as this app's proxy.
  turbopack: { root: __dirname },
}

export default nextConfig
