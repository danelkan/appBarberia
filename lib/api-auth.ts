import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase'
import {
  ROLE_DEFAULT_PERMISSIONS,
  type AppRole,
  type Permission,
} from '@/types'

interface SessionUser {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    name?: string
  }
}

interface AuthContext {
  session: { user: SessionUser }
  response?: NextResponse
}

export interface AuthRoleContext extends AuthContext {
  role: AppRole
  barber_id?: string
  branch_ids: string[]
  company_id?: string
  permissions: Permission[]
  active: boolean
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

export function getRolePermissions(role: AppRole, explicitPermissions?: Permission[]) {
  if (role === 'superadmin') {
    return [...ROLE_DEFAULT_PERMISSIONS.superadmin]
  }

  if (explicitPermissions && explicitPermissions.length > 0) {
    return explicitPermissions
  }

  return ROLE_DEFAULT_PERMISSIONS[role] ?? []
}

export function hasPermission(ctx: AuthRoleContext, permission: Permission): boolean {
  if (ctx.role === 'superadmin') return true
  return getRolePermissions(ctx.role, ctx.permissions).includes(permission)
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
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
      get(name: string) {
        return req.cookies.get(name)?.value
      },
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
  const {
    data: { session },
  } = await supabase.auth.getSession()

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

  return unique((data ?? []).map((row: { branch_id?: string | null }) => row.branch_id))
}

export async function resolveUserRole(
  admin: SupabaseClient,
  userId: string,
  email?: string
): Promise<Omit<AuthRoleContext, 'session' | 'response'>> {
  const normalizedEmail = email?.toLowerCase()
  let role: AppRole = 'barber'
  let barber_id: string | undefined
  let permissions: Permission[] = []
  let active = true
  let company_id: string | undefined
  let assignedBranchIds: string[] = []

  try {
    const { data: userRole } = await admin
      .from('user_roles')
      .select('*')
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

    if (typeof userRole?.active === 'boolean') {
      active = userRole.active
    }

    if (typeof userRole?.company_id === 'string') {
      company_id = userRole.company_id
    }

    if (Array.isArray(userRole?.branch_ids)) {
      assignedBranchIds = unique(userRole.branch_ids as string[])
    }
  } catch {
    // Fallback for projects without the optional columns/table wiring.
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

  const barberBranchIds = await getBranchIdsForBarber(admin, barber_id)
  const branch_ids = unique([...assignedBranchIds, ...barberBranchIds])

  return {
    role,
    barber_id,
    branch_ids,
    company_id,
    permissions: getRolePermissions(role, permissions),
    active,
  }
}

export async function requireAdminAuth(req: NextRequest): Promise<AuthRoleContext | null> {
  const auth = await getAuthSession(req)
  if (!auth) return null

  const admin = createSupabaseAdmin()
  const resolved = await resolveUserRole(admin, auth.session.user.id, auth.session.user.email)

  if (!resolved.active) return null
  if (resolved.role !== 'admin' && resolved.role !== 'superadmin') return null

  return { ...auth, ...resolved }
}

export async function requireAuth(req: NextRequest): Promise<AuthRoleContext | null> {
  const auth = await getAuthSession(req)
  if (!auth) return null

  const admin = createSupabaseAdmin()
  const resolved = await resolveUserRole(admin, auth.session.user.id, auth.session.user.email)

  if (!resolved.active) return null

  return { ...auth, ...resolved }
}

export function requirePermission(
  ctx: AuthRoleContext | null,
  permission: Permission,
  message = 'No tenés permisos para realizar esta acción'
) {
  if (!ctx) {
    return unauthorizedResponse()
  }

  if (!hasPermission(ctx, permission)) {
    return forbiddenResponse(message)
  }

  return null
}
