import { createServerClient } from '@supabase/ssr'
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
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  function withAuthCookies(nextResponse: NextResponse) {
    response.cookies.getAll().forEach(({ name, value, ...options }) => {
      nextResponse.cookies.set(name, value, options)
    })
    return nextResponse
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()

    // Redirect unauthenticated users away from staff routes
    if (isStaffRoute && !user) {
      return withAuthCookies(NextResponse.redirect(new URL('/login', request.url)))
    }

    // Redirect authenticated users away from login
    if (isLoginPage && user) {
      return withAuthCookies(NextResponse.redirect(new URL('/admin/agenda', request.url)))
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
