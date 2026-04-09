import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Internal types ───────────────────────────────────────────────

interface UserRoleLike {
  user_id?: string | null
  barber_id?: string | null
  active?: boolean | null
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
 * Single source of truth:
 *   - user_roles.active ≠ false  →  barber account is active
 *   - barber_branches             →  which branches the barber works at
 *
 * We do NOT gate on user_roles.branch_ids — that field controls admin
 * access scope, not public booking visibility.
 *
 * We do NOT call auth.admin.listUsers — we trust that user_roles is kept
 * in sync with auth users by the DELETE handler in /api/users.
 * (When a user is deleted via our API, the user_roles row is also deleted.)
 */
export function getVisibleBarberIds(input: {
  userRoles: UserRoleLike[]
  branchLinks: BarberBranchLike[]
  branchId?: string
}): Set<string> {
  // Build: barber_id → set of branch_ids they work at
  const barberBranches = new Map<string, Set<string>>()
  for (const link of input.branchLinks) {
    if (!link.barber_id || !link.branch_id) continue
    const set = barberBranches.get(link.barber_id) ?? new Set<string>()
    set.add(link.branch_id)
    barberBranches.set(link.barber_id, set)
  }

  return new Set(
    input.userRoles
      .filter(role => {
        // Must be active and linked to a valid auth user
        if (role.active === false) return false
        if (!role.barber_id || !role.user_id) return false

        // Must be assigned to at least one branch
        const branches = barberBranches.get(role.barber_id)
        if (!branches || branches.size === 0) return false

        // If filtering by branch, must be assigned to that specific branch
        if (input.branchId) return branches.has(input.branchId)

        return true
      })
      .map(role => role.barber_id as string)
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
 * When branchId is provided, the barber_branches query is filtered at DB level.
 */
export async function listVisibleBarbers(
  supabase: SupabaseClient,
  options?: { branchId?: string }
) {
  // Filter barber_branches at DB level when branch filter is given — avoids
  // pulling the entire join table just to filter in JS.
  const branchLinksQuery = options?.branchId
    ? supabase
        .from('barber_branches')
        .select('barber_id, branch_id, branch:branches(*)')
        .eq('branch_id', options.branchId)
    : supabase
        .from('barber_branches')
        .select('barber_id, branch_id, branch:branches(*)')

  const [
    { data: barbers, error: barbersError },
    { data: userRoles, error: rolesError },
    { data: branchLinks, error: branchError },
  ] = await Promise.all([
    supabase.from('barbers').select('*').order('created_at'),
    supabase.from('user_roles').select('user_id, barber_id, role, active').not('barber_id', 'is', null),
    branchLinksQuery,
  ])

  if (barbersError) throw barbersError
  if (rolesError) throw rolesError
  if (branchError) throw branchError

  const visibleBarberIds = getVisibleBarberIds({
    userRoles: userRoles ?? [],
    branchLinks: branchLinks ?? [],
    branchId: options?.branchId,
  })

  return {
    barbers: (barbers ?? []).filter(barber => visibleBarberIds.has(barber.id)),
    userRoles: userRoles ?? [],
    branchLinks: branchLinks ?? [],
  }
}

/**
 * Targeted single-barber visibility check for booking POST validation.
 * Runs 3 parallel queries scoped to the specific barber — does NOT load
 * all barbers then filter.
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
    { data: barber },
    { data: roleRow },
    { data: branchLinks },
  ] = await Promise.all([
    supabase.from('barbers').select('*').eq('id', barberId).maybeSingle(),
    supabase.from('user_roles').select('user_id, barber_id, active').eq('barber_id', barberId).maybeSingle(),
    branchLinksQuery,
  ])

  if (!barber || !roleRow) return null
  if (roleRow.active === false || !roleRow.user_id) return null
  if ((branchLinks ?? []).length === 0) return null

  return barber
}
