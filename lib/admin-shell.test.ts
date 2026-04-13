import { describe, expect, it } from 'vitest'
import { getActiveAdminNavItem, shouldCloseDrawerSwipe } from '@/lib/admin-shell'

const ITEMS = [
  { href: '/admin/dashboard', label: 'Resumen' },
  { href: '/admin/agenda', label: 'Agenda' },
  { href: '/admin/clientes', label: 'Clientes' },
]

describe('admin shell navigation', () => {
  it('keeps Resumen as the fallback section', () => {
    expect(getActiveAdminNavItem('/admin/unknown', ITEMS)?.label).toBe('Resumen')
  })

  it('detects nested routes as active under their section', () => {
    expect(getActiveAdminNavItem('/admin/clientes/123', ITEMS)?.label).toBe('Clientes')
  })

  it('matches dashboard exactly without swallowing other routes', () => {
    expect(getActiveAdminNavItem('/admin/dashboard', ITEMS)?.label).toBe('Resumen')
  })
})

describe('drawer swipe closing', () => {
  it('closes when the drawer is dragged past the horizontal threshold', () => {
    expect(shouldCloseDrawerSwipe({ drawerOffset: -96, elapsedMs: 240 })).toBe(true)
  })

  it('closes on a quick fling even if the distance is shorter', () => {
    expect(shouldCloseDrawerSwipe({ drawerOffset: -50, elapsedMs: 80 })).toBe(true)
  })

  it('stays open on short, slow drags', () => {
    expect(shouldCloseDrawerSwipe({ drawerOffset: -40, elapsedMs: 260 })).toBe(false)
  })
})
