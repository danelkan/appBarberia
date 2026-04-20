import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { formatSupabaseError, getOptionalSupabasePublicConfig } from '@/lib/supabase'

// TODO: El SUBDOMAIN_MAP está hardcodeado aquí como solución temporal para el MVP.
// En el futuro, esta lógica debe reemplazarse por una consulta a la tabla `company_domains`
// en Supabase (por ejemplo: SELECT slug FROM company_domains WHERE domain = $host).
// Mientras la plataforma tenga pocos clientes, el mapa estático es suficiente,
// pero al agregar nuevos clientes hay que actualizar este archivo y hacer redeploy.
const SUBDOMAIN_MAP: Record<string, string> = {
  felitobarber: 'felitobarber',
  elcorteclasico: 'elcorteclasico',
}

/**
 * Centralized helper: resolves a company slug from the incoming Host header.
 *
 * Supports both forms used in production:
 *   - felitobarber.iadai.tech          → 'felitobarber'
 *   - reservar.felitobarber.iadai.tech → 'felitobarber'
 *
 * Returns null when the host is the root domain (iadai.tech) or localhost,
 * so admin/superadmin routes work correctly without a company context.
 *
 * NOTE: This is a temporary in-process lookup using SUBDOMAIN_MAP.
 * Replace with a company_domains DB lookup when the platform scales beyond ~5 clients.
 */
function resolveTenantFromHost(host: string): string | null {
  // Strip port if present (e.g. localhost:3000)
  const hostWithoutBase = host.replace(/\.iadai\.tech(:\d+)?$/, '')
  const parts = hostWithoutBase.split('.')
  // Last segment after stripping the base domain is the company subdomain.
  // For "reservar.felitobarber.iadai.tech" → parts = ['reservar', 'felitobarber'] → last = 'felitobarber'
  // For "felitobarber.iadai.tech" → parts = ['felitobarber'] → last = 'felitobarber'
  const companyKey = parts[parts.length - 1]
  return SUBDOMAIN_MAP[companyKey] ?? null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Subdomain → inject ?company= param for public booking pages
  // Handles both felitobarber.iadai.tech and reservar.felitobarber.iadai.tech
  const host = request.headers.get('host') ?? ''
  const companySlug = resolveTenantFromHost(host)
  const isPublicPage = pathname === '/' || pathname.startsWith('/reservar') || pathname.startsWith('/mis-turnos')

  if (companySlug && isPublicPage && !request.nextUrl.searchParams.has('company')) {
    const url = request.nextUrl.clone()
    url.searchParams.set('company', companySlug)
    return NextResponse.redirect(url)
  }

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
  matcher: ['/', '/reservar/:path*', '/mis-turnos/:path*', '/admin/:path*', '/staff/:path*', '/staff', '/login'],
}
