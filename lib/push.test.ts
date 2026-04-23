import { describe, expect, it } from 'vitest'
import { resolvePushTargetUserIds } from '@/lib/push'

describe('resolvePushTargetUserIds', () => {
  it('targets only active users linked to the appointment company and branch', () => {
    const result = resolvePushTargetUserIds([
      { user_id: 'barber-a', active: true, company_id: 'company-a', branch_ids: ['branch-a'] },
      { user_id: 'barber-b', active: true, company_id: 'company-a', branch_ids: ['branch-b'] },
      { user_id: 'barber-c', active: true, company_id: 'company-b', branch_ids: ['branch-b'] },
      { user_id: 'inactive', active: false, company_id: 'company-a', branch_ids: ['branch-a'] },
      { user_id: null, active: true, company_id: 'company-a', branch_ids: ['branch-a'] },
    ], 'company-a', 'branch-a')

    expect(result).toEqual(['barber-a'])
  })

  it('deduplicates multiple role rows for the same barber user', () => {
    const result = resolvePushTargetUserIds([
      { user_id: 'barber-a', active: true, company_id: 'company-a', branch_ids: ['branch-a'] },
      { user_id: 'barber-a', active: true, company_id: 'company-a', branch_ids: ['branch-a'] },
    ], 'company-a', 'branch-a')

    expect(result).toEqual(['barber-a'])
  })

  it('allows legacy rows with stale company_id only when branch_ids explicitly match', () => {
    const result = resolvePushTargetUserIds([
      { user_id: 'stale-but-assigned', active: true, company_id: 'old-company', branch_ids: ['branch-a'] },
      { user_id: 'stale-unassigned', active: true, company_id: 'old-company', branch_ids: [] },
      { user_id: 'stale-other-branch', active: true, company_id: 'old-company', branch_ids: ['branch-b'] },
    ], 'company-a', 'branch-a')

    expect(result).toEqual(['stale-but-assigned'])
  })

  it('supports legacy same-company rows with no explicit branch list', () => {
    const result = resolvePushTargetUserIds([
      { user_id: 'barber-a', active: true, company_id: 'company-a', branch_ids: [] },
    ], 'company-a', 'branch-a')

    expect(result).toEqual(['barber-a'])
  })
})
