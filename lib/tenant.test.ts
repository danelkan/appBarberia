import { describe, expect, it } from 'vitest'
import { buildCompanyScopeFilter, getSingleCompanyLegacyScope, isUuidLike, resolveAccessibleBranchIds } from '@/lib/tenant'
import type { AuthRoleContext } from '@/lib/api-auth'

describe('single-company legacy scope', () => {
  it('enables the legacy fallback when there is exactly one active company', () => {
    expect(getSingleCompanyLegacyScope(['company-a'])).toEqual({
      companyId: 'company-a',
      allowLegacyUnscoped: true,
    })
  })

  it('keeps the requested company when it matches the only active tenant', () => {
    expect(getSingleCompanyLegacyScope(['company-a'], 'company-a')).toEqual({
      companyId: 'company-a',
      allowLegacyUnscoped: true,
    })
  })

  it('disables the fallback when there are multiple active companies', () => {
    expect(getSingleCompanyLegacyScope(['company-a', 'company-b'], 'company-a')).toEqual({
      companyId: 'company-a',
      allowLegacyUnscoped: false,
    })
  })

  it('disables the fallback when the requested company does not match the only active tenant', () => {
    expect(getSingleCompanyLegacyScope(['company-a'], 'company-b')).toEqual({
      companyId: 'company-b',
      allowLegacyUnscoped: false,
    })
  })
})

describe('company scope filter builder', () => {
  it('builds a strict tenant filter by default', () => {
    expect(buildCompanyScopeFilter('company_id', 'company-a')).toBe('company_id.eq.company-a')
  })

  it('adds legacy null rows only when explicitly enabled', () => {
    expect(buildCompanyScopeFilter('company_id', 'company-a', true)).toBe(
      'company_id.eq.company-a,company_id.is.null'
    )
  })
})

describe('company identifier parsing', () => {
  it('detects UUID identifiers', () => {
    expect(isUuidLike('11111111-1111-1111-1111-111111111111')).toBe(true)
  })

  it('does not treat slugs as UUIDs', () => {
    expect(isUuidLike('felito-studios')).toBe(false)
  })
})

describe('branch access scope', () => {
  it('treats explicit branch_ids as a real non-superadmin restriction', async () => {
    const auth = {
      role: 'admin',
      branch_ids: ['cordon'],
      permissions: [],
      active: true,
      session: { user: { id: 'u1' } },
    } as AuthRoleContext
    const supabase = {
      from: () => {
        throw new Error('explicit branch scope should not query all company branches')
      },
    } as any

    await expect(resolveAccessibleBranchIds(auth, supabase)).resolves.toEqual(['cordon'])
  })
})
