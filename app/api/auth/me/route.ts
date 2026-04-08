import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createSupabaseAdmin, getSupabasePublicConfig } from '@/lib/supabase'
import { resolveUserRole } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
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

  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()
  const { role, barber_id, branch_ids, company_id, permissions, active } = await resolveUserRole(
    admin,
    session.user.id,
    session.user.email ?? undefined
  )

  const branchList = branch_ids.length > 0
    ? await admin
        .from('branches')
        .select('id, name')
        .in('id', branch_ids)
        .order('name')
    : { data: [] }

  const company = company_id
    ? await admin
        .from('companies')
        .select('id, name')
        .eq('id', company_id)
        .maybeSingle()
    : { data: null }

  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null,
      role,
      barber_id,
      company_id,
      branch_ids,
      permissions,
      active,
      company: company.data ?? null,
      branches: branchList.data ?? [],
    }
  })
}
