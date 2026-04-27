'use client'

export const dynamic = 'force-dynamic'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar,
  ChevronLeft,
  ChevronDown,
  Clock3,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Store,
  Users,
  UserSquare2,
} from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { BrandLogo, BrandWordmark } from '@/components/brand-logo'
import { PushNotificationToggle } from '@/components/push-notification-toggle'
import { getActiveAdminNavItem, shouldCloseDrawerSwipe } from '@/lib/admin-shell'
import { hasResolvedPermission } from '@/lib/permissions'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Branch, Permission, UserWithRole } from '@/types'

interface AdminContextValue {
  user: UserWithRole | null
  branches: Branch[]
  activeBranch: Branch | null
  setActiveBranch: (branch: Branch | null) => void
  can: (permission: Permission) => boolean
}

const AdminContext = createContext<AdminContextValue>({
  user: null,
  branches: [],
  activeBranch: null,
  setActiveBranch: () => {},
  can: () => false,
})

export const useAdmin = () => useContext(AdminContext)

const ROUTE_PERMISSIONS: Partial<Record<string, Permission>> = {
  '/admin/caja':       'cash.view',
  '/admin/clientes':   'view_clients',
  '/admin/servicios':  'manage_services',
  '/admin/horarios':   'manage_schedules',
  '/admin/sucursales': 'manage_branches',
  '/admin/usuarios':   'manage_users',
  '/admin/empresas':   'manage_companies',
}

const NAV_ITEMS = [
  { href: '/admin/dashboard',  label: 'Resumen',    icon: LayoutDashboard },
  { href: '/admin/agenda',     label: 'Agenda',     icon: Calendar },
  { href: '/admin/caja',       label: 'Caja',       icon: DollarSign,  permission: 'cash.view'         as Permission },
  { href: '/admin/clientes',   label: 'Clientes',   icon: Users,       permission: 'view_clients'      as Permission },
  { href: '/admin/servicios',  label: 'Servicios',  icon: Clock3,      permission: 'manage_services'   as Permission },
  { href: '/admin/sucursales', label: 'Sucursales', icon: Store,       permission: 'manage_branches'   as Permission },
  { href: '/admin/usuarios',   label: 'Usuarios',   icon: UserSquare2, permission: 'manage_users'      as Permission },
  { href: '/admin/empresas',   label: 'Plataforma', icon: ShieldCheck, permission: 'manage_companies'  as Permission },
]

const DRAWER_WIDTH_PX = 360
const DRAWER_CLOSE_THRESHOLD_PX = 72
const SWIPE_LOCK_DISTANCE_PX = 12
const ACTIVE_BRANCH_STORAGE_PREFIX = 'app.activeBranch'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  // Memoize so supabase.auth has a stable reference across renders —
  // prevents the bootstrap useEffect from re-firing on every state update.
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)
  const [drawerOffset, setDrawerOffset] = useState(0)
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    mode: 'idle' as 'idle' | 'pending' | 'horizontal' | 'vertical',
  })

  const [companyIdParam, setCompanyIdParam] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'superadmin') { setCompanyIdParam(null); return }
    const params = new URLSearchParams(window.location.search)
    setCompanyIdParam(params.get('company_id'))
  }, [pathname, user?.role])

  const displayBranches = useMemo(() => {
    if (user?.role === 'superadmin') {
      if (!companyIdParam) return []
      return branches.filter(b => (b as Branch & { company_id?: string }).company_id === companyIdParam)
    }
    return branches
  }, [branches, companyIdParam, user?.role])

  const can = useMemo(
    () => (permission: Permission) => {
      if (!user) return false
      return hasResolvedPermission(user.role, user.permissions, permission)
    },
    [user]
  )

  const activeBranchStorageKey = useMemo(() => {
    if (!user?.company_id) return null
    return `${ACTIVE_BRANCH_STORAGE_PREFIX}.${user.company_id}.${user.id}`
  }, [user?.company_id, user?.id])

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      if (mounted) {
        setLoading(true)
        setUser(null)
        setBranches([])
        setActiveBranch(null)
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        const bootstrapRes = await fetch('/api/auth/bootstrap', { cache: 'no-store' })

        if (!bootstrapRes.ok) {
          router.replace('/login')
          return
        }

        const { user: nextUser, branches: nextBranches } = await bootstrapRes.json()

        if (!mounted) return

        const allowedBranches = (nextUser?.role === 'barber'
          ? (nextBranches ?? []).filter((branch: Branch) => nextUser.branch_ids.includes(branch.id))
          : nextBranches ?? []) as Branch[]

        const nextUserValue = nextUser ?? null
        setUser(nextUserValue)
        setBranches(allowedBranches)

        // Superadmin lands on the agency hub unless already inside a client panel
        const hasCompanyContext = new URLSearchParams(window.location.search).has('company_id')
        if (nextUserValue?.role === 'superadmin' && !hasCompanyContext && pathname !== '/admin/empresas') {
          router.replace('/admin/empresas')
          return
        }

        const storageKey = nextUserValue?.company_id
          ? `${ACTIVE_BRANCH_STORAGE_PREFIX}.${nextUserValue.company_id}.${nextUserValue.id}`
          : null
        const storedBranchId = storageKey ? window.localStorage.getItem(storageKey) : null
        const restoredBranch = allowedBranches.find(branch => branch.id === storedBranchId) ?? null
        const nextActiveBranch = nextUser?.role === 'barber'
          ? allowedBranches[0] ?? null
          : restoredBranch ?? null

        setActiveBranch(nextActiveBranch)
      } catch {
        if (mounted) {
          router.replace('/login')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      mounted = false
    }
  }, [router, supabase.auth])

  useEffect(() => {
    setMobileOpen(false)
    setDrawerOffset(0)
    setBranchOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!activeBranchStorageKey) return

    if (activeBranch) {
      window.localStorage.setItem(activeBranchStorageKey, activeBranch.id)
    } else {
      window.localStorage.removeItem(activeBranchStorageKey)
    }
  }, [activeBranch, activeBranchStorageKey])

  useEffect(() => {
    if (!mobileOpen) {
      setDrawerOffset(0)
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!user) return

    const permission = Object.entries(ROUTE_PERMISSIONS).find(([route]) => pathname.startsWith(route))?.[1]
    if (permission && !can(permission)) {
      router.replace('/admin/dashboard')
    }
  }, [can, pathname, router, user])

  const visibleNav = NAV_ITEMS.filter(item => {
    return !item.permission || can(item.permission)
  })
  const currentNavItem = getActiveAdminNavItem(pathname, visibleNav)
  const isDashboard = currentNavItem?.href === '/admin/dashboard'
  const overlayOpacity = mobileOpen ? Math.max(0, 0.34 * (1 - (Math.abs(drawerOffset) / DRAWER_WIDTH_PX))) : 0
  const publicCompanyKey = user?.company?.slug ?? user?.company_id ?? null
  const publicBookingHref = activeBranch
    ? `/reservar?branch=${encodeURIComponent(activeBranch.id)}${publicCompanyKey ? `&company=${encodeURIComponent(publicCompanyKey)}` : ''}`
    : publicCompanyKey
      ? `/?company=${encodeURIComponent(publicCompanyKey)}`
      : '/'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function closeMobileDrawer() {
    setMobileOpen(false)
    setBranchOpen(false)
    setDrawerOffset(0)
    gestureRef.current.mode = 'idle'
  }

  function handleDrawerTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!mobileOpen) return

    const touch = event.touches[0]
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      mode: 'pending',
    }
  }

  function handleDrawerTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!mobileOpen || gestureRef.current.mode === 'idle') return

    const touch = event.touches[0]
    const deltaX = touch.clientX - gestureRef.current.startX
    const deltaY = touch.clientY - gestureRef.current.startY

    if (gestureRef.current.mode === 'pending') {
      if (Math.abs(deltaX) < SWIPE_LOCK_DISTANCE_PX && Math.abs(deltaY) < SWIPE_LOCK_DISTANCE_PX) {
        return
      }

      gestureRef.current.mode =
        deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2
          ? 'horizontal'
          : 'vertical'
    }

    if (gestureRef.current.mode !== 'horizontal') return

    event.preventDefault()
    setDrawerOffset(Math.max(deltaX, -DRAWER_WIDTH_PX))
  }

  function handleDrawerTouchEnd() {
    if (!mobileOpen) return

    const { mode, startTime } = gestureRef.current
    const elapsed = Math.max(Date.now() - startTime, 1)

    gestureRef.current.mode = 'idle'

    if (mode !== 'horizontal') {
      setDrawerOffset(0)
      return
    }

    if (shouldCloseDrawerSwipe({ drawerOffset, elapsedMs: elapsed, thresholdPx: DRAWER_CLOSE_THRESHOLD_PX })) {
      closeMobileDrawer()
      return
    }

    setDrawerOffset(0)
  }

  if (loading) {
    return (
      <div className="admin-theme min-h-screen bg-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-6 w-6" />
          <p className="text-sm text-slate-500">Cargando panel</p>
        </div>
      </div>
    )
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <BrandWordmark width={170} height={62} />
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">Backoffice operativo</p>
          </div>
          <div className="rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/5">
            <BrandLogo size={42} className="rounded-xl" />
          </div>
        </div>
      </div>

      <div className="border-b border-stone-200 px-4 py-4">
        <Link
          href="/admin/dashboard"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-[22px] border px-4 py-3 transition',
            isDashboard
              ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
              : 'border-lime-200 bg-lime-50/80 text-stone-900 hover:border-lime-300 hover:bg-lime-100/70'
          )}
        >
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-2xl',
            isDashboard ? 'bg-white/15 text-white' : 'bg-white text-lime-700 ring-1 ring-lime-200'
          )}>
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Sección principal</p>
            <p className="truncate text-sm font-semibold">Resumen</p>
          </div>
          {!isDashboard && <ChevronLeft className="h-4 w-4 rotate-180 opacity-50" />}
        </Link>
      </div>

      <div className="border-b border-stone-200 px-4 py-4">
        {user?.role === 'superadmin' && (
          <Link
            href="/admin/empresas"
            onClick={() => setMobileOpen(false)}
            className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            <ChevronLeft className="h-4 w-4" />
            Mis clientes
          </Link>
        )}
        <div className="relative">
          <button
            onClick={() => setBranchOpen(current => !current)}
            className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-stone-300"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Sucursal activa</p>
              <p className="truncate text-sm font-semibold text-stone-900">
                {activeBranch?.name ?? (user?.role === 'barber' ? 'Sin sucursal asignada' : 'Todas las sucursales')}
              </p>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-stone-400 transition', branchOpen && 'rotate-180')} />
          </button>

          {branchOpen && (
            <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
              {user?.role !== 'barber' && (
                <button
                  onClick={() => {
                    setActiveBranch(null)
                    setBranchOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50',
                    !activeBranch ? 'bg-stone-50 font-semibold text-stone-950' : 'text-stone-600'
                  )}
                >
                  Todas las sucursales
                </button>
              )}
              {displayBranches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => {
                    setActiveBranch(branch)
                    setBranchOpen(false)
                  }}
                  className={cn(
                    'w-full border-t border-stone-100 px-4 py-3 text-left text-sm transition hover:bg-stone-50',
                    activeBranch?.id === branch.id ? 'bg-stone-50 font-semibold text-stone-950' : 'text-stone-600'
                  )}
                >
                  {branch.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="safe-area-pb flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleNav.map(item => {
          const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
                active
                  ? 'bg-stone-950 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-stone-200 p-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-950">{user?.name ?? user?.email}</p>
              <p className="text-xs text-stone-500">{user?.role}</p>
            </div>
          </div>
          <Button variant="outline" className="mt-3 w-full justify-center" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
          <Link
            href={publicBookingHref}
            onClick={() => setMobileOpen(false)}
            className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-lime-100"
          >
            Ver reserva pública
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <AdminContext.Provider value={{ user, branches, activeBranch, setActiveBranch, can }}>
      <div className="admin-theme min-h-screen bg-page text-stone-900">
        <div className="lg:hidden">
          <header className="safe-area-pt sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3">
              <BrandLogo size={38} className="rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-950">{currentNavItem?.label ?? 'Panel administrativo'}</p>
                <p className="truncate text-xs text-stone-500">{activeBranch?.name ?? 'Vista global'}</p>
              </div>
              {!isDashboard && (
                <Link
                  href="/admin/dashboard"
                  className="rounded-full border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-semibold text-stone-900"
                >
                  Resumen
                </Link>
              )}
              <button
                onClick={() => setMobileOpen(current => !current)}
                className="rounded-xl border border-stone-200 bg-white p-2 text-stone-700 shadow-sm"
                aria-label={mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'}
                aria-expanded={mobileOpen}
                aria-controls="admin-mobile-drawer"
              >
                {mobileOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </header>

          <div
            className={cn(
              'fixed inset-0 z-50 transition-opacity duration-200 lg:hidden',
              mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
            )}
            aria-hidden={!mobileOpen}
          >
            <button
              type="button"
              onClick={closeMobileDrawer}
              className="absolute inset-0 w-full"
              style={{ backgroundColor: `rgba(15, 23, 42, ${overlayOpacity})` }}
              aria-label="Cerrar navegación lateral"
            />
            <div
              id="admin-mobile-drawer"
              className={cn(
                'absolute inset-y-0 left-0 w-[88%] max-w-sm overflow-hidden bg-[#fcfbf7] shadow-2xl transition-transform duration-200 ease-out',
                mobileOpen ? 'translate-x-0' : '-translate-x-full'
              )}
              style={mobileOpen ? { transform: `translateX(${drawerOffset}px)` } : undefined}
              onTouchStart={handleDrawerTouchStart}
              onTouchMove={handleDrawerTouchMove}
              onTouchEnd={handleDrawerTouchEnd}
              onTouchCancel={handleDrawerTouchEnd}
            >
              <div className="flex justify-center py-2">
                <div className="h-1.5 w-12 rounded-full bg-stone-200" />
              </div>
              <div className="h-full" style={{ touchAction: 'pan-y' }}>
                {sidebar}
              </div>
            </div>
          </div>
        </div>

        <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-stone-200 bg-[#fcfbf7] lg:block">
          {sidebar}
        </aside>

        <main className="min-h-screen lg:pl-80">
          <div className="border-b border-stone-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">{currentNavItem?.label ?? 'Operaciones'}</p>
                <p className="text-sm text-stone-600">
                  {activeBranch?.name ?? 'Vista global'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <PushNotificationToggle />
                {!isDashboard && (
                  <Link href="/admin/dashboard" className="hidden rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:text-stone-950 sm:inline-flex">
                    Volver a Resumen
                  </Link>
                )}
                <Link href={publicBookingHref} className="text-sm font-medium text-stone-500 transition hover:text-stone-950">
                  Ver reserva pública
                </Link>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  )
}
