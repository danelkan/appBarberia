import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseAdmin, getSupabasePublicConfig } from '@/lib/supabase'
import { applyAuthCookies, resolveUserRole } from '@/lib/api-auth'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Protect against enumeration / session-probing abuse
  const rateLimit = checkRateLimit(req, 'auth:bootstrap', RateLimitConfigs.authedRead)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)!

  let response = NextResponse.next({ request: req })
  const config = getSupabasePublicConfig()

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() { return req.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        response = NextResponse.next({ request: req })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return applyAuthCookies(NextResponse.json({ error: 'No autenticado' }, { status: 401 }), { response })
  }

  const admin = createSupabaseAdmin()
  const { role, barber_id, branch_ids, company_id, permissions, active } = await resolveUserRole(
    admin, user.id, user.email ?? undefined
  )

  if (!active) {
    return applyAuthCookies(NextResponse.json({ error: 'Usuario inactivo' }, { status: 401 }), { response })
  }

  const [branchListRes, companyRes, allBranchesRes] = await Promise.all([
    branch_ids.length > 0
      ? admin.from('branches').select('id, name').in('id', branch_ids).order('name')
      : Promise.resolve({ data: [] }),
    company_id
      ? admin.from('companies').select('id, name, slug').eq('id', company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Scope all-branches to the caller's company — superadmin gets all
    role === 'superadmin'
      ? admin.from('branches').select('id, name, address, company_id').order('name')
      : company_id
        ? admin.from('branches').select('id, name, address, company_id').eq('company_id', company_id).order('name')
        : Promise.resolve({ data: [] }),
  ])

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
        company: companyRes.data ?? null,
        branches: branchListRes.data ?? [],
      },
      branches: allBranchesRes.data ?? [],
    }),
    { response }
  )
}
