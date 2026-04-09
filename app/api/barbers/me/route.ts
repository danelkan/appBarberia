import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseAdmin, getSupabasePublicConfig } from '@/lib/supabase'
import { applyAuthCookies } from '@/lib/api-auth'
import { weeklyAvailabilitySchema } from '@/lib/validations'

async function getSession(req: NextRequest) {
  let response = NextResponse.next({ request: req })
  const config = getSupabasePublicConfig()
  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value)
          })
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  return { session: error || !user ? null : { user }, response }
}

type SessionContext = NonNullable<Awaited<ReturnType<typeof getSession>>>
type Session = NonNullable<SessionContext['session']>

async function findBarber(admin: ReturnType<typeof createSupabaseAdmin>, session: Session) {
  // Try by user_roles.barber_id first (supports superadmin-as-barber)
  const { data: userRole } = await admin
    .from('user_roles')
    .select('barber_id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (userRole?.barber_id) {
    const { data } = await admin.from('barbers').select('*').eq('id', userRole.barber_id).single()
    return data
  }

  // Fallback: match by email
  const { data } = await admin.from('barbers').select('*').eq('email', session.user.email ?? '').maybeSingle()
  return data
}

// GET /api/barbers/me — returns the logged-in barber's own record
export async function GET(req: NextRequest) {
  const auth = await getSession(req)
  if (!auth.session) {
    return applyAuthCookies(NextResponse.json({ error: 'No autenticado' }, { status: 401 }), auth)
  }

  const admin = createSupabaseAdmin()
  const barber = await findBarber(admin, auth.session)

  if (!barber) {
    return applyAuthCookies(NextResponse.json({ error: 'No sos un barbero registrado' }, { status: 403 }), auth)
  }

  return applyAuthCookies(NextResponse.json({ barber }), auth)
}

// PUT /api/barbers/me — el barbero actualiza su propia disponibilidad
export async function PUT(req: NextRequest) {
  const auth = await getSession(req)
  if (!auth.session) {
    return applyAuthCookies(NextResponse.json({ error: 'No autenticado' }, { status: 401 }), auth)
  }

  const admin = createSupabaseAdmin()
  const barber = await findBarber(admin, auth.session)

  if (!barber) {
    return applyAuthCookies(NextResponse.json({ error: 'No sos un barbero registrado' }, { status: 403 }), auth)
  }

  const body = await req.json().catch(() => null)
  if (!body) return applyAuthCookies(NextResponse.json({ error: 'Body inválido' }, { status: 400 }), auth)

  const parsed = weeklyAvailabilitySchema.safeParse(body.availability)
  if (!parsed.success) {
    return applyAuthCookies(NextResponse.json({ error: 'Disponibilidad inválida' }, { status: 400 }), auth)
  }

  const { data, error } = await admin
    .from('barbers')
    .update({ availability: parsed.data })
    .eq('id', barber.id)
    .select('*')
    .single()

  if (error) return applyAuthCookies(NextResponse.json({ error: error.message }, { status: 500 }), auth)

  return applyAuthCookies(NextResponse.json({ barber: data }), auth)
}
