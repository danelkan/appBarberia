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
        { user_id: 'active-user', barber_id: 'active-barber', active: true },
        { user_id: 'inactive-user', barber_id: 'inactive-barber', active: false },
        { user_id: 'deleted-user', barber_id: 'deleted-barber', active: true },
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
        { user_id: 'admin-user', barber_id: 'admin-barber', active: true },
        { user_id: 'admin-user', barber_id: 'hidden-admin-barber', active: true },
      ],
      agendaBarberIds: new Set(['admin-barber']),
    })

    expect(Array.from(visible)).toEqual(['admin-barber'])
  })
})
