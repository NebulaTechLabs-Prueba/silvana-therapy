/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Output for DigitalOcean App Platform ───
  output: 'standalone',

  // ─── TypeScript ───
  // DashboardClient.tsx is legacy untyped JS — ignore until progressively typed.
  typescript: {
    ignoreBuildErrors: true,
  },

  // ─── Domain configuration ───
  // Public:  terapiasilvanalopez.com
  // Admin:   admin.terapiasilvanalopez.com
  // Both served from the same Next.js app, routed via middleware

  // ─── Security headers ───
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // ─── Image optimization ───
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
