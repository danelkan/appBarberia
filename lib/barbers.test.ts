import { describe, expect, it } from 'vitest'
import { getAssignedBranchIdsByBarber, getVisibleBarberIds } from '@/lib/barbers'

// ─── Contract: getVisibleBarberIds ────────────────────────────────
//
// A barber is visible iff ALL of:
//   1. user_roles.active !== false
//   2. user_roles.user_id is set (linked to an auth user)
//   3. user_roles.barber_id is set
//   4. The linked auth user still exists
//   5. Branch assignment exists in barber_branches
//   6. If branchId filter: barber_branches must include that branch

describe('getVisibleBarberIds', () => {

  // ── Active/inactive ─────────────────────────────────────────────

  it('shows active barbers with barber_branches entry', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
      validAuthUserIds: new Set(['u1']),
    })
    expect(visible.has('b1')).toBe(true)
  })

  it('hides barbers with active: false', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: false }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
      validAuthUserIds: new Set(['u1']),
    })
    expect(visible.has('b1')).toBe(false)
  })

  it('hides barbers with no user_id (orphaned role row)', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: null, barber_id: 'b1', active: true }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
    })
    expect(visible.has('b1')).toBe(false)
  })

  it('hides barbers whose linked auth user no longer exists', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'missing-user', barber_id: 'b1', active: true }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
      validAuthUserIds: new Set(['u2']),
    })
    expect(visible.has('b1')).toBe(false)
  })

  // ── Branch assignment ───────────────────────────────────────────

  it('shows barber when branch comes from barber_branches only', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: [] }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
      validAuthUserIds: new Set(['u1']),
    })
    expect(visible.has('b1')).toBe(true)
  })

  it('hides barber when only user_roles.branch_ids exists without barber_branches', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: ['br-a'] }],
      branchLinks: [],
      validAuthUserIds: new Set(['u1']),
    })
    expect(visible.has('b1')).toBe(true)
  })

  it('hides barber when neither source has branch assignment', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: [] }],
      branchLinks: [],
      validAuthUserIds: new Set(['u1']),
    })
    expect(visible.has('b1')).toBe(false)
  })

  // ── Branch filter ────────────────────────────────────────────────

  it('filters to requested branch using barber_branches', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'u1', barber_id: 'b-a', active: true },
        { user_id: 'u2', barber_id: 'b-b', active: true },
      ],
      branchLinks: [
        { barber_id: 'b-a', branch_id: 'br-a' },
        { barber_id: 'b-b', branch_id: 'br-b' },
      ],
      validAuthUserIds: new Set(['u1', 'u2']),
      branchId: 'br-a',
    })
    expect(visible.has('b-a')).toBe(true)
    expect(visible.has('b-b')).toBe(false)
  })

  it('does not use user_roles.branch_ids as booking fallback for branch filters', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'u1', barber_id: 'b-a', active: true, branch_ids: ['br-a'] },
        { user_id: 'u2', barber_id: 'b-b', active: true, branch_ids: ['br-b'] },
      ],
      branchLinks: [],
      validAuthUserIds: new Set(['u1', 'u2']),
      branchId: 'br-a',
    })
    expect(visible.has('b-a')).toBe(true)
    expect(visible.has('b-b')).toBe(false)
  })

  it('shows barber assigned to multiple branches when filtering by one', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true }],
      branchLinks: [
        { barber_id: 'b1', branch_id: 'br-a' },
        { barber_id: 'b1', branch_id: 'br-b' },
      ],
      validAuthUserIds: new Set(['u1']),
      branchId: 'br-b',
    })
    expect(visible.has('b1')).toBe(true)
  })

  // ── Edge cases ───────────────────────────────────────────────────

  it('deactivated user is hidden even when barber_branches has entries', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: false }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
      validAuthUserIds: new Set(['u1']),
      branchId: 'br-a',
    })
    expect(visible.has('b1')).toBe(false)
  })

  it('admin-role user who is also a barber appears in booking', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'admin-user', barber_id: 'admin-barber', active: true, branch_ids: ['br-a'] }],
      branchLinks: [{ barber_id: 'admin-barber', branch_id: 'br-a' }],
      validAuthUserIds: new Set(['admin-user']),
      branchId: 'br-a',
    })
    expect(visible.has('admin-barber')).toBe(true)
  })

  it('hides orphan barbers that only exist in barbers plus barber_branches', () => {
    const visible = getVisibleBarberIds({
      userRoles: [],
      branchLinks: [{ barber_id: 'orphan-barber', branch_id: 'br-a' }],
      branchId: 'br-a',
    })
    expect(visible.has('orphan-barber')).toBe(false)
  })

  it('returns empty set when no barbers exist', () => {
    const visible = getVisibleBarberIds({ userRoles: [], branchLinks: [] })
    expect(visible.size).toBe(0)
  })
})

describe('getAssignedBranchIdsByBarber', () => {
  it('uses barber_branches as the agenda source of truth', () => {
    const assigned = getAssignedBranchIdsByBarber({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: ['br-a', 'br-b'] }],
      branchLinks: [
        { barber_id: 'b1', branch_id: 'br-b' },
        { barber_id: 'b1', branch_id: 'br-c' },
      ],
    })

    expect(assigned.get('b1')).toEqual(['br-b', 'br-c'])
  })

  it('returns nothing for legacy branch_ids without barber_branches rows', () => {
    const assigned = getAssignedBranchIdsByBarber({
      userRoles: [{ user_id: 'u1', barber_id: 'legacy-barber', active: true, branch_ids: ['br-a'] }],
      branchLinks: [],
    })

    expect(assigned.get('legacy-barber')).toEqual(['br-a'])
  })
})
