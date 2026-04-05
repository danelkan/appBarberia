import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
// In production, use Redis or similar distributed store
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  })
}, 5 * 60 * 1000)

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,     // 60 requests per minute
}

const STRICT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,     // 10 requests per minute for writes
}

const AUTH_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,           // 5 login attempts per 15 minutes
}

/**
 * Get client IP from request
 */
function getClientIp(request: Request): string {
  // Try to get IP from headers (for Vercel/Cloudflare)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  // Fallback to other headers
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // This is a fallback - in production, always have a proxy set the IP
  return 'unknown'
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  error?: string
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  request: Request,
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  const clientIp = getClientIp(request)
  const storeKey = `${key}:${clientIp}`
  const now = Date.now()

  let entry = rateLimitStore.get(storeKey)

  // Reset if window has passed
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(storeKey, entry)
  }

  entry.count++

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const allowed = entry.count <= config.maxRequests

  if (!allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      error: 'Too many requests. Please try again later.',
    }
  }

  return {
    allowed: true,
    remaining,
    resetTime: entry.resetTime,
  }
}

/**
 * Rate limit configurations for different endpoints
 */
export const RateLimitConfigs = {
  // Public endpoints (GET requests)
  read: DEFAULT_CONFIG,
  
  // Write endpoints (POST, PUT, DELETE)
  write: STRICT_CONFIG,
  
  // Auth endpoints (login)
  auth: AUTH_CONFIG,
  
  // Booking endpoints
  booking: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,       // 5 bookings per minute
  },
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.resetTime - Date.now() + 60000),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  }
}

/**
 * Helper to apply rate limiting and return error response if exceeded
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse | null {
  if (result.allowed) {
    return null
  }

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
