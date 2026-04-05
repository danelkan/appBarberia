import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createSupabaseAdmin } from '@/lib/supabase'
import { weeklyAvailabilitySchema } from '@/lib/validations'

async function getSession(req: NextRequest) {
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
  return session
}

// PUT /api/barbers/me — el barbero actualiza su propia disponibilidad
export async function PUT(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()

  // Encontrar el barbero por email del usuario logueado
  const { data: barber } = await admin
    .from('barbers')
    .select('id')
    .eq('email', session.user.email ?? '')
    .single()

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
