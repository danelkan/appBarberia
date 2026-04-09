import { describe, expect, it } from 'vitest'
import { getVisibleBarberIds } from '@/lib/barbers'

// ─── Contract: getVisibleBarberIds ────────────────────────────────
//
// A barber is visible iff:
//   1. user_roles row has active !== false
//   2. user_roles row has both user_id and barber_id set
//   3. barber_branches has at least one entry for this barber
//   4. If branchId filter: barber_branches must include that branch
//
// auth.admin.listUsers is NOT used — we trust that the user_roles row is
// deleted when a user is deleted via /api/users (DELETE handler).

describe('getVisibleBarberIds', () => {
  it('exposes active barbers that have branch assignments', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'active-user', barber_id: 'active-barber', active: true },
        { user_id: 'inactive-user', barber_id: 'inactive-barber', active: false },
      ],
      branchLinks: [
        { barber_id: 'active-barber', branch_id: 'branch-a' },
        { barber_id: 'inactive-barber', branch_id: 'branch-a' },
      ],
    })

    expect(visible.has('active-barber')).toBe(true)
    expect(visible.has('inactive-barber')).toBe(false)
  })

  it('hides barbers deactivated via user_roles.active = false', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'admin', barber_id: 'deactivated-barber', active: false },
      ],
      branchLinks: [
        { barber_id: 'deactivated-barber', branch_id: 'branch-a' },
      ],
      branchId: 'branch-a',
    })

    expect(visible.has('deactivated-barber')).toBe(false)
  })

  it('hides barbers with no barber_branches entries (appears_in_agenda: false)', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'user-a', barber_id: 'hidden-barber', active: true },
      ],
      branchLinks: [], // no branch assignments
    })

    expect(visible.has('hidden-barber')).toBe(false)
  })

  it('filters by branchId — only shows barbers assigned to that branch', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'u1', barber_id: 'barber-branch-a', active: true },
        { user_id: 'u2', barber_id: 'barber-branch-b', active: true },
        { user_id: 'u3', barber_id: 'barber-both', active: true },
      ],
      branchLinks: [
        { barber_id: 'barber-branch-a', branch_id: 'branch-a' },
        { barber_id: 'barber-branch-b', branch_id: 'branch-b' },
        { barber_id: 'barber-both', branch_id: 'branch-a' },
        { barber_id: 'barber-both', branch_id: 'branch-b' },
      ],
      branchId: 'branch-a',
    })

    expect(visible.has('barber-branch-a')).toBe(true)
    expect(visible.has('barber-branch-b')).toBe(false) // wrong branch
    expect(visible.has('barber-both')).toBe(true)
  })

  it('hides barbers whose user_roles row has no user_id (orphaned)', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: null, barber_id: 'orphan-barber', active: true },
      ],
      branchLinks: [
        { barber_id: 'orphan-barber', branch_id: 'branch-a' },
      ],
      branchId: 'branch-a',
    })

    expect(visible.has('orphan-barber')).toBe(false)
  })

  it('shows admin-role users who also have a barber profile', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'felito-admin', barber_id: 'felito-barber', active: true },
      ],
      branchLinks: [
        { barber_id: 'felito-barber', branch_id: 'branch-a' },
      ],
      branchId: 'branch-a',
    })

    expect(Array.from(visible)).toEqual(['felito-barber'])
  })

  it('shows all barbers across branches when no branchId filter is given', () => {
    const visible = getVisibleBarberIds({
      userRoles: [
        { user_id: 'u1', barber_id: 'barber-1', active: true },
        { user_id: 'u2', barber_id: 'barber-2', active: true },
        { user_id: 'u3', barber_id: 'barber-hidden', active: true },
      ],
      branchLinks: [
        { barber_id: 'barber-1', branch_id: 'branch-a' },
        { barber_id: 'barber-2', branch_id: 'branch-b' },
        // barber-hidden has no entries → stays hidden
      ],
    })

    expect(visible.has('barber-1')).toBe(true)
    expect(visible.has('barber-2')).toBe(true)
    expect(visible.has('barber-hidden')).toBe(false)
  })
})
