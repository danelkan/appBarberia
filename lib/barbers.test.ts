import { describe, expect, it } from 'vitest'
import { getVisibleBarberIds } from '@/lib/barbers'

const authUsers = [
  { id: 'active-user', email: 'active@felito.test' },
  { id: 'inactive-user', email: 'inactive@felito.test' },
]

describe('getVisibleBarberIds', () => {
  it('only exposes barbers linked to existing active users', () => {
    const visible = getVisibleBarberIds({
      authUsers,
      userRoles: [
        { user_id: 'active-user', barber_id: 'active-barber', active: true, branch_ids: ['branch-a'] },
        { user_id: 'inactive-user', barber_id: 'inactive-barber', active: false, branch_ids: ['branch-a'] },
        { user_id: 'deleted-user', barber_id: 'deleted-barber', active: true, branch_ids: ['branch-a'] },
      ],
      branchLinks: [
        { barber_id: 'active-barber', branch_id: 'branch-a' },
        { barber_id: 'inactive-barber', branch_id: 'branch-a' },
        { barber_id: 'deleted-barber', branch_id: 'branch-a' },
      ],
    })

    expect(Array.from(visible)).toEqual(['active-barber'])
  })

  it('does not re-expose orphan barbers by matching email', () => {
    const visible = getVisibleBarberIds({
      authUsers: [{ id: 'active-user', email: 'same-email@felito.test' }],
      userRoles: [],
    })

    expect(visible.has('orphan-barber')).toBe(false)
  })

  it('requires agenda visibility when agenda barber ids are provided', () => {
    const visible = getVisibleBarberIds({
      authUsers: [{ id: 'admin-user', email: 'admin@felito.test' }],
      userRoles: [
        { user_id: 'admin-user', barber_id: 'admin-barber', active: true, branch_ids: ['branch-a'] },
        { user_id: 'admin-user', barber_id: 'hidden-admin-barber', active: true, branch_ids: ['branch-a'] },
      ],
      branchLinks: [
        { barber_id: 'admin-barber', branch_id: 'branch-a' },
      ],
    })

    expect(Array.from(visible)).toEqual(['admin-barber'])
  })

  it('requires the user to belong to the selected branch and appear in agenda there', () => {
    const visible = getVisibleBarberIds({
      authUsers: [{ id: 'admin-user', email: 'admin@felito.test' }],
      userRoles: [
        { user_id: 'admin-user', barber_id: 'ok-barber', active: true, branch_ids: ['branch-a'] },
        { user_id: 'admin-user', barber_id: 'wrong-branch', active: true, branch_ids: ['branch-b'] },
        { user_id: 'admin-user', barber_id: 'hidden-barber', active: true, branch_ids: ['branch-a'] },
      ],
      branchLinks: [
        { barber_id: 'ok-barber', branch_id: 'branch-a' },
        { barber_id: 'wrong-branch', branch_id: 'branch-b' },
      ],
      branchId: 'branch-a',
    })

    expect(Array.from(visible)).toEqual(['ok-barber'])
  })

  it('keeps admin plus barber users visible when they are operationally valid', () => {
    const visible = getVisibleBarberIds({
      authUsers: [{ id: 'felito-admin', email: 'felito@felito.test' }],
      userRoles: [
        { user_id: 'felito-admin', barber_id: 'felito-barber', active: true, branch_ids: ['branch-a'] },
      ],
      branchLinks: [
        { barber_id: 'felito-barber', branch_id: 'branch-a' },
      ],
      branchId: 'branch-a',
    })

    expect(Array.from(visible)).toEqual(['felito-barber'])
  })

  it('supports legacy barber users that were linked before branch_ids existed on user_roles', () => {
    const visible = getVisibleBarberIds({
      authUsers: [{ id: 'legacy-user', email: 'legacy@felito.test' }],
      userRoles: [
        { user_id: 'legacy-user', barber_id: 'legacy-barber', active: true, branch_ids: [] },
      ],
      branchLinks: [
        { barber_id: 'legacy-barber', branch_id: 'branch-a' },
      ],
      branchId: 'branch-a',
    })

    expect(Array.from(visible)).toEqual(['legacy-barber'])
  })
})
