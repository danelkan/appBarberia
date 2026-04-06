import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'
import { createBarberSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'barbers:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('barbers').select('*').order('created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const barberIds = (data ?? []).map(barber => barber.id)
  let rolesByBarberId = new Map<string, 'superadmin' | 'admin' | 'barber'>()

  try {
    const { data: userRoles } = barberIds.length > 0
      ? await supabase
          .from('user_roles')
          .select('role, barber_id')
          .in('barber_id', barberIds)
      : { data: [] }

    rolesByBarberId = new Map(
      (userRoles ?? [])
        .filter((row: any) => row.barber_id && row.role)
        .map((row: any) => [row.barber_id, row.role])
    )
  } catch {
    rolesByBarberId = new Map()
  }

  const { data: branchLinks } = barberIds.length > 0
    ? await supabase
        .from('barber_branches')
        .select('barber_id, branch:branches(*)')
        .in('barber_id', barberIds)
    : { data: [] }

  const barbers = (data ?? []).map((barber) => {
    const branches = (branchLinks ?? [])
      .filter((link: any) => link.barber_id === barber.id)
      .map((link: any) => link.branch)
      .filter(Boolean)

    return {
      ...barber,
      role: rolesByBarberId.get(barber.id) ?? (
        process.env.ADMIN_EMAIL && barber.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
          ? 'admin'
          : 'barber'
      ),
      branches,
      branch_ids: branches.map((branch: { id: string }) => branch.id),
    }
  })

  const response = NextResponse.json({ barbers })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'barbers:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can create barbers
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }

  // Parse and validate body
  const body = await req.json()
  const result = createBarberSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { password, role, branch_ids, ...barberInput } = result.data

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: barberInput.email,
    password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message || 'No se pudo crear el usuario' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('barbers')
    .insert(barberInput)
    .select('*')
    .single()

  if (error) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error: branchError } = await supabase
    .from('barber_branches')
    .insert(branch_ids.map(branch_id => ({ barber_id: data.id, branch_id })))

  if (branchError) {
    await supabase.from('barbers').delete().eq('id', data.id)
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: branchError.message }, { status: 500 })
  }

  try {
    await supabase
      .from('user_roles')
      .upsert({
        user_id: authUser.user.id,
        role,
        barber_id: data.id,
      }, { onConflict: 'user_id' })
  } catch {
    // Keep the barber usable even if the optional roles table is not present.
  }

  const barber = {
    ...data,
    role,
    branch_ids,
  }

  const response = NextResponse.json({ barber })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
