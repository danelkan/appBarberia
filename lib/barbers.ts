import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Internal types ───────────────────────────────────────────────

interface UserRoleLike {
  user_id?: string | null
  barber_id?: string | null
  active?: boolean | null
  // branch_ids stored on user_roles — used as fallback when barber_branches
  // hasn't been populated yet (legacy records / migration not yet run).
  branch_ids?: unknown
}

interface BarberBranchLike {
  barber_id?: string | null
  branch_id?: string | null
}

interface BarberWriteInput {
  name: string
  email: string
  availability?: unknown
  photo_url?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────

export class BarberEmailConflictError extends Error {
  constructor() {
    super('Ese email ya tiene un perfil de barbero asociado a otro usuario')
    this.name = 'BarberEmailConflictError'
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function sanitizeBranchIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function cleanBarberPayload(input: BarberWriteInput) {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    email: normalizeEmail(input.email),
  }
  if (input.availability !== undefined) payload.availability = input.availability
  if (input.photo_url !== undefined) payload.photo_url = input.photo_url
  return payload
}

// ─── Core visibility logic ────────────────────────────────────────

/**
 * Determines which barbers are visible in the booking flow.
 *
 * Rules:
 *   1. user_roles row must exist with active !== false, user_id set, barber_id set.
 *   2. The barber must be assigned to at least one branch. Branch assignment is
 *      checked from TWO sources (either one is sufficient):
 *        a. barber_branches table  — primary, set by the UI when creating/editing
 *        b. user_roles.branch_ids  — legacy fallback for records created before
 *                                    barber_branches was fully adopted
 *
 * Why dual-source:
 *   Existing deployments may have branch_ids on user_roles but no barber_branches
 *   rows yet. Rather than requiring a one-time migration to run correctly, the code
 *   is resilient to either column being populated.
 *
 * What is NOT used:
 *   - auth.admin.listUsers (slow Auth API call, eliminated entirely)
 *   - Email-based fallback (was the original bug: deactivated users still matched)
 */
export function getVisibleBarberIds(input: {
  userRoles: UserRoleLike[]
  branchLinks: BarberBranchLike[]
  branchId?: string
}): Set<string> {
  // Build: barber_id → set of branch_ids from the barber_branches join table
  const tableSourceBranches = new Map<string, Set<string>>()
  for (const link of input.branchLinks) {
    if (!link.barber_id || !link.branch_id) continue
    const set = tableSourceBranches.get(link.barber_id) ?? new Set<string>()
    set.add(link.branch_id)
    tableSourceBranches.set(link.barber_id, set)
  }

  // Barbers explicitly deactivated via user_roles
  const deactivated = new Set(
    input.userRoles
      .filter(r => r.active === false && r.barber_id)
      .map(r => r.barber_id as string)
  )

  // Barbers that have a user_roles entry (linked to an auth user)
  const barbersWithRoles = new Set(
    input.userRoles.filter(r => r.barber_id).map(r => r.barber_id as string)
  )

  // Path A — barbers WITH user_roles: require active + user_id + branch assignment
  const visibleViaRoles = input.userRoles
    .filter(role => {
      if (role.active === false) return false
      if (!role.barber_id || !role.user_id) return false

      const tableBranches = tableSourceBranches.get(role.barber_id)
      const roleBranchIds = sanitizeBranchIds(role.branch_ids)
      const hasTableAssignment = tableBranches !== undefined && tableBranches.size > 0
      const hasRoleAssignment  = roleBranchIds.length > 0

      if (!hasTableAssignment && !hasRoleAssignment) return false

      if (input.branchId) {
        const inTable = tableBranches?.has(input.branchId) ?? false
        const inRole  = roleBranchIds.includes(input.branchId)
        return inTable || inRole
      }

      return true
    })
    .map(role => role.barber_id as string)

  // Path B — barbers WITHOUT user_roles (created directly in DB, no auth account):
  // visible as long as they have barber_branches entries and are not deactivated
  const visibleViaDirectAssignment = Array.from(tableSourceBranches.entries())
    .filter(([barberId, branches]) => {
      if (barbersWithRoles.has(barberId)) return false  // handled by Path A
      if (deactivated.has(barberId)) return false
      if (branches.size === 0) return false
      if (input.branchId) return branches.has(input.branchId)
      return true
    })
    .map(([barberId]) => barberId)

  return new Set([...visibleViaRoles, ...visibleViaDirectAssignment])
}

export function getAssignedBranchIdsByBarber(input: {
  userRoles: UserRoleLike[]
  branchLinks: BarberBranchLike[]
}) {
  const branchIdsByBarber = new Map<string, Set<string>>()

  for (const role of input.userRoles) {
    if (!role.barber_id) continue
    const set = branchIdsByBarber.get(role.barber_id) ?? new Set<string>()
    for (const branchId of sanitizeBranchIds(role.branch_ids)) {
      set.add(branchId)
    }
    branchIdsByBarber.set(role.barber_id, set)
  }

  for (const link of input.branchLinks) {
    if (!link.barber_id || !link.branch_id) continue
    const set = branchIdsByBarber.get(link.barber_id) ?? new Set<string>()
    set.add(link.branch_id)
    branchIdsByBarber.set(link.barber_id, set)
  }

  return new Map(
    Array.from(branchIdsByBarber.entries()).map(([barberId, branchIds]) => [
      barberId,
      Array.from(branchIds),
    ])
  )
}

// ─── Barber CRUD helpers ──────────────────────────────────────────

async function hasExistingAuthUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  return !error && Boolean(data?.user)
}

/**
 * Creates a new barber record or reuses an existing one (matched by email).
 * Detects email conflicts with OTHER valid auth users and throws accordingly.
 */
export async function createOrReuseBarberForUser(
  supabase: SupabaseClient,
  input: BarberWriteInput,
  userId: string
) {
  const payload = cleanBarberPayload(input)
  const email = payload.email as string

  const { data: existingBarber, error: findError } = await supabase
    .from('barbers')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (findError) throw findError

  if (existingBarber) {
    const { data: linkedRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('barber_id', existingBarber.id)

    if (rolesError) throw rolesError

    for (const role of linkedRoles ?? []) {
      if (!role.user_id || role.user_id === userId) continue
      if (await hasExistingAuthUser(supabase, role.user_id)) {
        throw new BarberEmailConflictError()
      }
      // Orphaned role row (auth user gone) — clean it up
      await supabase.from('user_roles').delete().eq('user_id', role.user_id)
    }

    const { data: updatedBarber, error: updateError } = await supabase
      .from('barbers')
      .update(payload)
      .eq('id', existingBarber.id)
      .select('*')
      .single()

    if (updateError) throw updateError
    return { barber: updatedBarber, reused: true }
  }

  const { data: newBarber, error: createError } = await supabase
    .from('barbers')
    .insert(payload)
    .select('*')
    .single()

  if (createError) throw createError
  return { barber: newBarber, reused: false }
}

// ─── Public query helpers ─────────────────────────────────────────

/**
 * List all barbers visible in the booking flow, optionally scoped to a branch.
 *
 * Runs 3 parallel DB queries — no auth.admin.listUsers call.
 * When branchId is provided, the barber_branches query is filtered at DB level
 * (avoids transferring the full join table when only one branch matters).
 *
 * Barber visibility uses BOTH barber_branches and user_roles.branch_ids so the
 * result is correct regardless of whether the v8 migration has been run.
 */
export async function listVisibleBarbers(
  supabase: SupabaseClient,
  options?: { branchId?: string }
) {
  const branchLinksQuery = options?.branchId
    ? supabase
        .from('barber_branches')
        .select('barber_id, branch_id, branch:branches(*)')
        .eq('branch_id', options.branchId)
    : supabase
        .from('barber_branches')
        .select('barber_id, branch_id, branch:branches(*)')

  const [
    { data: barbers,    error: barbersError },
    { data: userRoles,  error: rolesError   },
    { data: branchLinks, error: branchError },
  ] = await Promise.all([
    supabase.from('barbers').select('*').order('created_at'),
    // Include branch_ids so getVisibleBarberIds can use it as legacy fallback
    supabase
      .from('user_roles')
      .select('user_id, barber_id, role, active, branch_ids')
      .not('barber_id', 'is', null),
    branchLinksQuery,
  ])

  if (barbersError) throw barbersError
  if (rolesError)   throw rolesError
  if (branchError)  throw branchError

  const visibleBarberIds = getVisibleBarberIds({
    userRoles:   userRoles   ?? [],
    branchLinks: branchLinks ?? [],
    branchId: options?.branchId,
  })

  return {
    barbers:     (barbers ?? []).filter(barber => visibleBarberIds.has(barber.id)),
    userRoles:   userRoles   ?? [],
    branchLinks: branchLinks ?? [],
  }
}

/**
 * Targeted single-barber visibility check for booking POST validation.
 * Does NOT load all barbers — scoped queries per barber.
 * Accepts both barber_branches and user_roles.branch_ids as branch evidence.
 */
export async function getVisibleBarberById(
  supabase: SupabaseClient,
  barberId: string,
  options?: { branchId?: string | null }
) {
  const branchLinksQuery = options?.branchId
    ? supabase
        .from('barber_branches')
        .select('branch_id')
        .eq('barber_id', barberId)
        .eq('branch_id', options.branchId)
    : supabase
        .from('barber_branches')
        .select('branch_id')
        .eq('barber_id', barberId)

  const [
    { data: barber   },
    { data: roleRow  },
    { data: branchLinks },
  ] = await Promise.all([
    supabase.from('barbers').select('*').eq('id', barberId).maybeSingle(),
    supabase.from('user_roles').select('user_id, barber_id, active, branch_ids').eq('barber_id', barberId).maybeSingle(),
    branchLinksQuery,
  ])

  if (!barber) return null

  // If explicitly deactivated, block immediately
  if (roleRow?.active === false) return null

  const hasTableBranch = (branchLinks ?? []).length > 0
  const roleBranchIds  = sanitizeBranchIds(roleRow?.branch_ids)
  const hasRoleBranch  = options?.branchId
    ? roleBranchIds.includes(options.branchId)
    : roleBranchIds.length > 0

  // Barbers with user_roles also require a linked auth user
  if (roleRow && !roleRow.user_id && !hasTableBranch) return null

  if (!hasTableBranch && !hasRoleBranch) return null

  return barber
}
