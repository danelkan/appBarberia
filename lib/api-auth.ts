import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase'
import type { Permission } from '@/types'

export type AppRole = 'superadmin' | 'admin' | 'barber'

interface SessionUser {
  id: string
  email?: string
}

interface AuthContext {
  session: { user: SessionUser }
  response?: NextResponse
}

export interface AuthRoleContext extends AuthContext {
  role: AppRole
  barber_id?: string
  branch_ids: string[]
  permissions: Permission[]
}

/**
 * Returns true when the authenticated user has the given permission.
 * Superadmins and admins implicitly have every permission.
 */
export function hasPermission(ctx: AuthRoleContext, permission: Permission): boolean {
  if (ctx.role === 'superadmin' || ctx.role === 'admin') return true
  return ctx.permissions.includes(permission)
}

function createSupabaseServerAuthClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  })

  return { supabase, response }
}

async function getAuthSession(req: NextRequest): Promise<AuthContext | null> {
  const { supabase, response } = createSupabaseServerAuthClient(req)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  return { session, response }
}

async function getBranchIdsForBarber(admin: SupabaseClient, barberId?: string) {
  if (!barberId) return []

  const { data, error } = await admin
    .from('barber_branches')
    .select('branch_id')
    .eq('barber_id', barberId)

  if (error) return []

  return (data ?? [])
    .map((row: { branch_id?: string | null }) => row.branch_id)
    .filter((branchId): branchId is string => Boolean(branchId))
}

export async function resolveUserRole(
  admin: SupabaseClient,
  userId: string,
  email?: string
): Promise<{ role: AppRole; barber_id?: string; branch_ids: string[]; permissions: Permission[] }> {
  const normalizedEmail = email?.toLowerCase()
  let role: AppRole = 'barber'
  let barber_id: string | undefined
  let permissions: Permission[] = []

  try {
    const { data: userRole } = await admin
      .from('user_roles')
      .select('role, barber_id, permissions')
      .eq('user_id', userId)
      .maybeSingle()

    if (userRole?.role === 'superadmin' || userRole?.role === 'admin' || userRole?.role === 'barber') {
      role = userRole.role
    }

    if (userRole?.barber_id) {
      barber_id = userRole.barber_id
    }

    if (Array.isArray(userRole?.permissions)) {
      permissions = userRole.permissions as Permission[]
    }
  } catch {
    // Graceful fallback when the project does not have user_roles configured yet.
  }

  if (!barber_id && normalizedEmail) {
    const { data: barber } = await admin
      .from('barbers')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (barber?.id) {
      barber_id = barber.id
    }
  }

  if (process.env.SUPERADMIN_UUID && userId === process.env.SUPERADMIN_UUID) {
    role = 'superadmin'
  } else if (process.env.ADMIN_EMAIL && normalizedEmail === process.env.ADMIN_EMAIL.toLowerCase()) {
    role = role === 'superadmin' ? role : 'admin'
  }

  const branch_ids = await getBranchIdsForBarber(admin, barber_id)

  return { role, barber_id, branch_ids, permissions }
}

export async function requireAdminAuth(req: NextRequest): Promise<AuthRoleContext | null> {
  const auth = await getAuthSession(req)
  if (!auth) return null

  const admin = createSupabaseAdmin()
  const resolved = await resolveUserRole(admin, auth.session.user.id, auth.session.user.email)

  if (resolved.role !== 'admin' && resolved.role !== 'superadmin') return null

  return { ...auth, ...resolved }
}

export async function requireAuth(req: NextRequest): Promise<AuthRoleContext | null> {
  const auth = await getAuthSession(req)
  if (!auth) return null

  const admin = createSupabaseAdmin()
  const resolved = await resolveUserRole(admin, auth.session.user.id, auth.session.user.email)

  return { ...auth, ...resolved }
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}
