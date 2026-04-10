import { describe, expect, it } from 'vitest'
import { getAssignedBranchIdsByBarber, getVisibleBarberIds } from '@/lib/barbers'

// ─── Contract: getVisibleBarberIds ────────────────────────────────
//
// A barber is visible iff ALL of:
//   1. user_roles.active !== false
//   2. user_roles.user_id is set (linked to an auth user)
//   3. user_roles.barber_id is set
//   4. Branch assignment exists in AT LEAST ONE of:
//        a. barber_branches table entries  (primary)
//        b. user_roles.branch_ids          (legacy fallback)
//   5. If branchId filter: at least one source must include that branch

describe('getVisibleBarberIds', () => {

  // ── Active/inactive ─────────────────────────────────────────────

  it('shows active barbers with barber_branches entry', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
    })
    expect(visible.has('b1')).toBe(true)
  })

  it('hides barbers with active: false', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: false }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
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

  // ── Dual-source branch assignment ───────────────────────────────

  it('shows barber when branch comes from barber_branches only', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: [] }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
    })
    expect(visible.has('b1')).toBe(true)
  })

  it('shows barber when branch comes from user_roles.branch_ids only (legacy)', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: ['br-a'] }],
      branchLinks: [], // barber_branches empty — migration not run yet
    })
    expect(visible.has('b1')).toBe(true)
  })

  it('hides barber when neither source has branch assignment', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: [] }],
      branchLinks: [],
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
      branchId: 'br-a',
    })
    expect(visible.has('b-a')).toBe(true)
    expect(visible.has('b-b')).toBe(false)
  })

  it('filters to requested branch using user_roles.branch_ids fallback', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'u1', barber_id: 'b-a', active: true, branch_ids: ['br-a'] },
        { user_id: 'u2', barber_id: 'b-b', active: true, branch_ids: ['br-b'] },
      ],
      branchLinks: [], // empty — legacy data scenario
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
      branchId: 'br-b',
    })
    expect(visible.has('b1')).toBe(true)
  })

  // ── Edge cases ───────────────────────────────────────────────────

  it('deactivated user is hidden even when barber_branches has entries', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: false }],
      branchLinks: [{ barber_id: 'b1', branch_id: 'br-a' }],
      branchId: 'br-a',
    })
    expect(visible.has('b1')).toBe(false)
  })

  it('admin-role user who is also a barber appears in booking', () => {
    const visible = getVisibleBarberIds({
      userRoles: [{ user_id: 'admin-user', barber_id: 'admin-barber', active: true, branch_ids: ['br-a'] }],
      branchLinks: [{ barber_id: 'admin-barber', branch_id: 'br-a' }],
      branchId: 'br-a',
    })
    expect(visible.has('admin-barber')).toBe(true)
  })

  it('returns empty set when no barbers exist', () => {
    const visible = getVisibleBarberIds({ userRoles: [], branchLinks: [] })
    expect(visible.size).toBe(0)
  })
})

describe('getAssignedBranchIdsByBarber', () => {
  it('merges barber_branches and user_roles.branch_ids without duplicates', () => {
    const assigned = getAssignedBranchIdsByBarber({
      userRoles: [{ user_id: 'u1', barber_id: 'b1', active: true, branch_ids: ['br-a', 'br-b'] }],
      branchLinks: [
        { barber_id: 'b1', branch_id: 'br-b' },
        { barber_id: 'b1', branch_id: 'br-c' },
      ],
    })

    expect(assigned.get('b1')).toEqual(['br-a', 'br-b', 'br-c'])
  })

  it('returns role branch_ids for legacy barbers without barber_branches rows', () => {
    const assigned = getAssignedBranchIdsByBarber({
      userRoles: [{ user_id: 'u1', barber_id: 'legacy-barber', active: true, branch_ids: ['br-a'] }],
      branchLinks: [],
    })

    expect(assigned.get('legacy-barber')).toEqual(['br-a'])
  })
})
