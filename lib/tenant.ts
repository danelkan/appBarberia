import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthRoleContext } from '@/lib/api-auth'

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

  if (auth.branch_ids.length > 0) {
    return auth.branch_ids
  }

  const companyId = await resolveCompanyId(auth, supabase)
  if (!companyId) return []

  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', companyId)

  return (branches ?? []).map((branch: { id: string }) => branch.id)
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
  if (!branchId) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .eq('active', true)

    if ((companies ?? []).length === 1) return (companies![0] as { id: string }).id
    return null
  }

  const { data } = await supabase
    .from('branches')
    .select('company_id')
    .eq('id', branchId)
    .maybeSingle()

  return (data?.company_id as string | null) ?? null
}
