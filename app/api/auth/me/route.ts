import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()

  // Look up role from user_roles table
  const { data: userRole } = await admin
    .from('user_roles')
    .select('role, barber_id')
    .eq('user_id', session.user.id)
    .single()

  // Fallback: if no user_role found, check if email matches a barber
  let role: string = userRole?.role ?? 'barber'
  let barber_id: string | undefined = userRole?.barber_id ?? undefined

  if (!userRole) {
    const { data: barber } = await admin
      .from('barbers')
      .select('id')
      .eq('email', session.user.email ?? '')
      .single()
    if (barber) {
      role = 'barber'
      barber_id = barber.id
    }
  }

  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      role,
      barber_id,
    }
  })
}
