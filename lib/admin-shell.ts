export interface AdminNavItemLike {
  href: string
  label: string
}

export function getActiveAdminNavItem<T extends AdminNavItemLike>(pathname: string, items: T[]): T | undefined {
  return items.find(item => pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))) ?? items[0]
}

export function shouldOpenDrawerSwipe(options: {
  swipeOffset: number
  elapsedMs: number
  thresholdPx?: number
  minVelocity?: number
}) {
  const {
    swipeOffset,
    elapsedMs,
    thresholdPx = 72,
    minVelocity = 0.45,
  } = options

  const velocity = swipeOffset / Math.max(elapsedMs, 1)
  return swipeOffset >= thresholdPx || velocity >= minVelocity
}

export function shouldCloseDrawerSwipe(options: {
  drawerOffset: number
  elapsedMs: number
  thresholdPx?: number
  minVelocity?: number
}) {
  const {
    drawerOffset,
    elapsedMs,
    thresholdPx = 72,
    minVelocity = -0.45,
  } = options

  const velocity = drawerOffset / Math.max(elapsedMs, 1)
  return drawerOffset <= -thresholdPx || velocity <= minVelocity
}
