import { NextRequest, NextResponse } from 'next/server'
import { listVisibleBarbers } from '@/lib/barbers'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { createBarberSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'barbers:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const supabase = createSupabaseAdmin()
  const { barbers: data, userRoles: activeRoles, branchLinks } = await listVisibleBarbers(supabase)

  const rolesByBarberId = new Map(
    (activeRoles ?? [])
      .filter((row: any) => row.barber_id && row.role)
      .map((row: any) => [row.barber_id, row.role])
  )

  const barbers = (data ?? []).map((barber) => {
    const branches = (branchLinks ?? [])
      .filter((link: any) => link.barber_id === barber.id)
      .map((link: any) => link.branch)
      .filter(Boolean)

    return {
      ...barber,
      role: rolesByBarberId.get(barber.id) ?? 'barber',
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
  const denied = requirePermission(auth, 'manage_barbers')
  if (denied) return denied

  // Parse and validate body
  const body = await req.json()
  const result = createBarberSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { password, existing_user_email, role, branch_ids, ...barberInput } = result.data

  // ── Resolve auth user ──────────────────────────────────────────────
  let authUserId: string

  if (existing_user_email) {
    // Link an existing Supabase auth user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    const existingUser = users.find(u => u.email?.toLowerCase() === existing_user_email.toLowerCase())
    if (!existingUser) {
      return NextResponse.json({ error: `No se encontró un usuario con el email ${existing_user_email}` }, { status: 404 })
    }
    authUserId = existingUser.id
  } else {
    // Create a brand-new auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: barberInput.email,
      password: password!,
      email_confirm: true,
    })
    if (authError || !authUser.user) {
      return NextResponse.json({ error: authError?.message || 'No se pudo crear el usuario' }, { status: 500 })
    }
    authUserId = authUser.user.id
  }

  // ── Insert barber record ───────────────────────────────────────────
  const { data, error } = await supabase
    .from('barbers')
    .insert(barberInput)
    .select('*')
    .single()

  if (error) {
    if (!existing_user_email) await supabase.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Assign branches ────────────────────────────────────────────────
  const { error: branchError } = await supabase
    .from('barber_branches')
    .insert(branch_ids.map(branch_id => ({ barber_id: data.id, branch_id })))

  if (branchError) {
    await supabase.from('barbers').delete().eq('id', data.id)
    if (!existing_user_email) await supabase.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: branchError.message }, { status: 500 })
  }

  // ── Link user_roles ────────────────────────────────────────────────
  try {
    await supabase
      .from('user_roles')
      .upsert({ user_id: authUserId, role, barber_id: data.id }, { onConflict: 'user_id' })
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
