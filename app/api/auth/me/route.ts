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

  // Check if this user's email matches a barber
  const { data: barber } = await admin
    .from('barbers')
    .select('id, name, email')
    .eq('email', session.user.email ?? '')
    .single()

  // Superadmin UUID — the one and only owner account
  const SUPERADMIN_ID = process.env.SUPERADMIN_UUID ?? '2dc05b66-c123-4f89-b942-7b9ecde09b48'
  const isSuperAdmin = session.user.id === SUPERADMIN_ID

  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    role: isSuperAdmin ? 'superadmin' : barber ? 'barber' : 'admin',
    barber: barber ?? null,
  })
}
