import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createSupabaseAdmin, getSupabasePublicConfig } from '@/lib/supabase'
import { weeklyAvailabilitySchema } from '@/lib/validations'

async function getSession(req: NextRequest) {
  let response = NextResponse.next({ request: req })
  const config = getSupabasePublicConfig()
  const supabase = createServerClient(
    config.url,
    config.anonKey,
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
  return session
}

async function findBarber(admin: ReturnType<typeof createSupabaseAdmin>, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
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
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const barber = await findBarber(admin, session)

  if (!barber) return NextResponse.json({ error: 'No sos un barbero registrado' }, { status: 403 })

  return NextResponse.json({ barber })
}

// PUT /api/barbers/me — el barbero actualiza su propia disponibilidad
export async function PUT(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()
  const barber = await findBarber(admin, session)

  if (!barber) {
    return NextResponse.json({ error: 'No sos un barbero registrado' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const parsed = weeklyAvailabilitySchema.safeParse(body.availability)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Disponibilidad inválida' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('barbers')
    .update({ availability: parsed.data })
    .eq('id', barber.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ barber: data })
}
