import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthRoleContext } from '@/lib/api-auth'

export interface CompanyScopeContext {
  companyId: string | null
  allowLegacyUnscoped: boolean
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuidLike(value: string | null | undefined) {
  return Boolean(value && UUID_REGEX.test(value))
}

export function getSingleCompanyLegacyScope(
  activeCompanyIds: string[],
  requestedCompanyId?: string | null
): CompanyScopeContext {
  const companyId = requestedCompanyId ?? null
  if (activeCompanyIds.length !== 1) {
    return {
      companyId,
      allowLegacyUnscoped: false,
    }
  }

  const singleCompanyId = activeCompanyIds[0]
  if (companyId && companyId !== singleCompanyId) {
    return {
      companyId,
      allowLegacyUnscoped: false,
    }
  }

  return {
    companyId: singleCompanyId,
    allowLegacyUnscoped: true,
  }
}

export function buildCompanyScopeFilter(
  columnName: string,
  companyId: string,
  allowLegacyUnscoped = false
) {
  return allowLegacyUnscoped
    ? `${columnName}.eq.${companyId},${columnName}.is.null`
    : `${columnName}.eq.${companyId}`
}

async function listActiveCompanyIds(supabase: SupabaseClient): Promise<string[]> {
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('active', true)

  return (companies ?? []).map((company: { id: string }) => company.id)
}

export async function resolveCompanyRecordByIdentifier(
  supabase: SupabaseClient,
  identifier: string | null | undefined
): Promise<{ id: string; slug: string | null } | null> {
  if (!identifier?.trim()) return null

  const normalized = identifier.trim()
  let query = supabase
    .from('companies')
    .select('id, slug')

  query = isUuidLike(normalized)
    ? query.eq('id', normalized)
    : query.eq('slug', normalized)

  const { data } = await query.maybeSingle()
  return (data as { id: string; slug: string | null } | null) ?? null
}

export async function resolveSingleCompanyLegacyScope(
  supabase: SupabaseClient,
  requestedCompanyId?: string | null
): Promise<CompanyScopeContext> {
  const activeCompanyIds = await listActiveCompanyIds(supabase)
  return getSingleCompanyLegacyScope(activeCompanyIds, requestedCompanyId)
}

export async function resolveBranchCompanyScope(
  supabase: SupabaseClient,
  branchId: string | null | undefined
): Promise<CompanyScopeContext> {
  if (!branchId) {
    return resolveSingleCompanyLegacyScope(supabase)
  }

  const { data } = await supabase
    .from('branches')
    .select('company_id')
    .eq('id', branchId)
    .maybeSingle()

  if (data?.company_id) {
    return {
      companyId: data.company_id as string,
      allowLegacyUnscoped: false,
    }
  }

  return resolveSingleCompanyLegacyScope(supabase)
}

/**
 * Resolves the company_id for the current request.
 *
 * Resolution order:
 *   1. auth.company_id — set directly on the user role (fastest, most common)
 *   2. Derive from the user's branches → branch.company_id
 *   3. Fallback: single-active-company (single-tenant compatibility)
 *
 * Returns null if no company can be determined (e.g. superadmin with no
 * company affiliation — callers should handle this case if needed).
 */
export async function resolveCompanyId(
  auth: AuthRoleContext,
  supabase: SupabaseClient
): Promise<string | null> {
  if (auth.company_id) return auth.company_id

  if (auth.branch_ids.length > 0) {
    const { data } = await supabase
      .from('branches')
      .select('company_id')
      .in('id', auth.branch_ids)
      .not('company_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (data?.company_id) return data.company_id as string
  }

  // Single-tenant fallback
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('active', true)

  if ((companies ?? []).length === 1) return (companies![0] as { id: string }).id

  return null
}

export async function resolveAccessibleBranchIds(
  auth: AuthRoleContext,
  supabase: SupabaseClient
): Promise<string[]> {
  if (auth.role === 'superadmin') {
    const { data: branches } = await supabase.from('branches').select('id')
    return (branches ?? []).map((branch: { id: string }) => branch.id)
  }

  const hasCompanyWideBranchAccess =
    auth.role === 'admin' &&
    (
      auth.permissions.includes('manage_branches') ||
      auth.permissions.includes('manage_users') ||
      auth.permissions.includes('manage_services') ||
      auth.permissions.includes('manage_schedules')
    )

  if (hasCompanyWideBranchAccess) {
    const companyId = await resolveCompanyId(auth, supabase)
    if (companyId) {
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('company_id', companyId)

      return (branches ?? []).map((branch: { id: string }) => branch.id)
    }
  }

  if (auth.branch_ids.length > 0) {
    return auth.branch_ids
  }

  const companyId = await resolveCompanyId(auth, supabase)
  if (companyId) {
    const { data: branches } = await supabase
      .from('branches')
      .select('id')
      .eq('company_id', companyId)

    return (branches ?? []).map((branch: { id: string }) => branch.id)
  }

  if (auth.branch_ids.length > 0) {
    return auth.branch_ids
  }

  return []
}

export async function canAccessBranch(
  auth: AuthRoleContext,
  supabase: SupabaseClient,
  branchId: string
): Promise<boolean> {
  if (auth.role === 'superadmin') {
    return true
  }

  const accessibleBranchIds = await resolveAccessibleBranchIds(auth, supabase)
  return accessibleBranchIds.includes(branchId)
}

/**
 * Derives the company_id from a branch_id.
 * Used in public booking flow where the caller is not authenticated.
 */
export async function resolveCompanyIdFromBranch(
  supabase: SupabaseClient,
  branchId: string | null | undefined
): Promise<string | null> {
  const scope = await resolveBranchCompanyScope(supabase, branchId)
  return scope.companyId
}
