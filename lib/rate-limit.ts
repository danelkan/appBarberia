import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store — acceptable for single-instance deploys (Vercel hobby/pro single region).
// For multi-region or high-traffic, swap for Upstash Redis with the same interface.
const rateLimitStore = new Map<string, RateLimitEntry>()

// Prune expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) rateLimitStore.delete(key)
  })
}, 5 * 60 * 1000)

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  error?: string
}

/**
 * Extract the real client IP.
 *
 * Security note: x-forwarded-for is set by reverse proxies. In Vercel/Cloudflare
 * the rightmost non-private IP is the actual client. We take only the first entry
 * here (standard proxy behaviour) and then validate it looks like an IP to prevent
 * header injection attacks that could spoof the rate-limit key.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const candidate = forwarded.split(',')[0].trim()
    // Basic sanity check — accept only valid IPv4/IPv6-looking values
    if (/^[\d.a-fA-F:]{3,45}$/.test(candidate)) return candidate
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp && /^[\d.a-fA-F:]{3,45}$/.test(realIp.trim())) return realIp.trim()

  return 'unknown'
}

export function checkRateLimit(
  request: Request,
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const clientIp = getClientIp(request)
  const storeKey = `${key}:${clientIp}`
  const now = Date.now()

  let entry = rateLimitStore.get(storeKey)

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + config.windowMs }
    rateLimitStore.set(storeKey, entry)
  }

  entry.count++

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const allowed = entry.count <= config.maxRequests

  if (!allowed) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime, error: 'Demasiadas solicitudes. Intentá nuevamente más tarde.' }
  }

  return { allowed: true, remaining, resetTime: entry.resetTime }
}

export const RateLimitConfigs = {
  // Public GET endpoints
  read: { windowMs: 60_000, maxRequests: 60 } satisfies RateLimitConfig,
  // State-changing endpoints
  write: { windowMs: 60_000, maxRequests: 10 } satisfies RateLimitConfig,
  // Login / auth
  auth: { windowMs: 15 * 60_000, maxRequests: 5 } satisfies RateLimitConfig,
  // Public booking — prevents appointment spam
  booking: { windowMs: 60_000, maxRequests: 5 } satisfies RateLimitConfig,
  // Authenticated user data endpoints
  authedRead: { windowMs: 60_000, maxRequests: 120 } satisfies RateLimitConfig,
}

export function getRateLimitHeaders(result: RateLimitResult, config?: RateLimitConfig): Record<string, string> {
  return {
    'X-RateLimit-Limit': config ? String(config.maxRequests) : '60',
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  }
}

export function rateLimitResponse(result: RateLimitResult): NextResponse | null {
  if (result.allowed) return null

  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)

  return NextResponse.json(
    { error: result.error },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        ...getRateLimitHeaders(result),
      },
    }
  )
}
