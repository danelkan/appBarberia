import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'
import { updateBarberSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'barbers:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can update barbers
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Parse and validate body
  const body = await req.json()
  const result = updateBarberSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data: existingBarber } = await supabase
    .from('barbers')
    .select('id, email')
    .eq('id', id)
    .maybeSingle()

  if (!existingBarber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
  }

  const { branch_ids, role, password, ...barberData } = result.data

  const { data, error } = await supabase
    .from('barbers')
    .update(barberData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (branch_ids) {
    await supabase.from('barber_branches').delete().eq('barber_id', id)
    const { error: branchError } = await supabase
      .from('barber_branches')
      .insert(branch_ids.map(branch_id => ({ barber_id: id, branch_id })))

    if (branchError) {
      return NextResponse.json({ error: branchError.message }, { status: 500 })
    }
  }

  let authUserId: string | null = null
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const matchingUser = authUsers.users.find(
    user => user.email?.toLowerCase() === (existingBarber.email || data.email || '').toLowerCase()
  )

  if (matchingUser) {
    authUserId = matchingUser.id

    if (data.email && data.email !== existingBarber.email) {
      await supabase.auth.admin.updateUserById(authUserId, { email: data.email, email_confirm: true })
    }

    if (password) {
      await supabase.auth.admin.updateUserById(authUserId, { password })
    }

    if (role) {
      try {
        await supabase
          .from('user_roles')
          .upsert({
            user_id: authUserId,
            role,
            barber_id: id,
          }, { onConflict: 'user_id' })
      } catch {
        // The app still works with email-based barber fallback.
      }
    }
  }

  const { data: branchLinks } = await supabase
    .from('barber_branches')
    .select('branch:branches(*)')
    .eq('barber_id', id)

  const branches = (branchLinks ?? [])
    .map((link: any) => link.branch)
    .filter(Boolean)

  const response = NextResponse.json({
    barber: {
      ...data,
      role: role ?? (
        process.env.ADMIN_EMAIL && data.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
          ? 'admin'
          : 'barber'
      ),
      branches,
      branch_ids: branches.map((branch: { id: string }) => branch.id),
    }
  })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'barbers:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can delete barbers
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data: barber } = await supabase
    .from('barbers')
    .select('email')
    .eq('id', id)
    .maybeSingle()

  await supabase.from('barber_branches').delete().eq('barber_id', id)

  if (barber?.email) {
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const matchingUser = authUsers.users.find(user => user.email?.toLowerCase() === barber.email.toLowerCase())
      if (matchingUser) {
        await supabase.from('user_roles').delete().eq('user_id', matchingUser.id)
        await supabase.auth.admin.deleteUser(matchingUser.id)
      }
    } catch {
      // Ignore optional auth cleanup failures and continue deleting the barber row.
    }
  }

  const { error } = await supabase.from('barbers').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
