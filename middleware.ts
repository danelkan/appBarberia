import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isLoginPage = request.nextUrl.pathname === '/login'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Avoid crashing the edge middleware when deployment env vars are not set yet.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isAdminRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
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
    }
  )

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (isAdminRoute && !session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (isLoginPage && session) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    return response
  } catch (error) {
    console.error('Middleware auth check failed', error)

    if (isAdminRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return response
  }
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
}
