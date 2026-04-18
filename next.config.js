/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Block MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Enable XSS filter in older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Strict referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // HSTS — force HTTPS for 1 year (production only)
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Supabase API + realtime websocket
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // Inline styles needed by Tailwind + Next.js
      "style-src 'self' 'unsafe-inline'",
      // Scripts: self + Next.js inline bootstrapping
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Images: self + Supabase storage
      "img-src 'self' data: blob: https://*.supabase.co",
      // Fonts: self
      "font-src 'self'",
      // Service worker + push notifications
      "worker-src 'self' blob:",
      // No embedding in iframes
      "frame-ancestors 'none'",
      // Form submissions: self only
      "form-action 'self'",
      // Block mixed content
      'upgrade-insecure-requests',
    ].join('; '),
  },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

module.exports = nextConfig
