import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { formatSupabaseError, getOptionalSupabasePublicConfig } from '@/lib/supabase'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isStaffRoute = pathname.startsWith('/admin') || pathname.startsWith('/staff')
  const isLoginPage  = pathname === '/login'

  let response = NextResponse.next({ request })
  let supabaseConfig

  try {
    supabaseConfig = getOptionalSupabasePublicConfig()
  } catch (error) {
    console.error('[middleware] Invalid Supabase configuration:', formatSupabaseError(error))
    if (isStaffRoute) return NextResponse.redirect(new URL('/login', request.url))
    return response
  }

  // Avoid crashing when env vars are not set (preview builds, first deploy, etc.)
  if (!supabaseConfig) {
    if (isStaffRoute) return NextResponse.redirect(new URL('/login', request.url))
    return response
  }

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      get(name: string) { return request.cookies.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options })
        response = NextResponse.next({ request })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  try {
    const { data: { session } } = await supabase.auth.getSession()

    // Redirect unauthenticated users away from staff routes
    if (isStaffRoute && !session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Redirect authenticated users away from login
    if (isLoginPage && session) {
      return NextResponse.redirect(new URL('/admin/agenda', request.url))
    }

    return response
  } catch (error) {
    console.error('[middleware] Auth check failed:', formatSupabaseError(error))
    if (isStaffRoute) return NextResponse.redirect(new URL('/login', request.url))
    return response
  }
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/staff', '/login'],
}
