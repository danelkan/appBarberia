import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseAdmin, getSupabasePublicConfig } from '@/lib/supabase'
import { applyAuthCookies, resolveUserRole } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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

  if (error || !user) {
    return applyAuthCookies(NextResponse.json({ error: 'No autenticado' }, { status: 401 }), { response })
  }

  const admin = createSupabaseAdmin()
  const { role, barber_id, branch_ids, company_id, permissions, active } = await resolveUserRole(
    admin,
    user.id,
    user.email ?? undefined
  )

  if (!active) {
    return applyAuthCookies(
      NextResponse.json({ error: 'Usuario inactivo' }, { status: 401 }),
      { response }
    )
  }

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

  return applyAuthCookies(
    NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        role,
        barber_id,
        company_id,
        branch_ids,
        permissions,
        active,
        company: company.data ?? null,
        branches: branchList.data ?? [],
      }
    }),
    { response }
  )
}
