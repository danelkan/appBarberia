import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Verify that the request is from an authenticated admin user.
 * Returns the session if valid, or sends an error response and returns null.
 */
export async function requireAdminAuth(
  req: NextRequest
): Promise<{ session: { user: { id: string; email?: string } }; response?: NextResponse } | null> {
  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: req })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: req })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  return { session, response }
}

/**
 * Verify that the request is from an authenticated user (not necessarily admin).
 * Used for routes that need any authenticated user.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ session: { user: { id: string; email?: string } }; response?: NextResponse } | null> {
  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: req })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: req })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  return { session, response }
}

/**
 * Helper to return unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}
