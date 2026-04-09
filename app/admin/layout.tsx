'use client'

export const dynamic = 'force-dynamic'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar,
  ChevronDown,
  Clock3,
  Crown,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  ShieldCheck,
  Store,
  Users,
  UserSquare2,
  X,
} from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
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
}

const NAV_ITEMS = [
  { href: '/admin/dashboard',  label: 'Resumen',    icon: LayoutDashboard },
  { href: '/admin/agenda',     label: 'Agenda',     icon: Calendar },
  { href: '/admin/caja',       label: 'Caja',       icon: DollarSign,  permission: 'cash.view'       as Permission },
  { href: '/admin/clientes',   label: 'Clientes',   icon: Users,       permission: 'view_clients'    as Permission },
  { href: '/admin/servicios',  label: 'Servicios',  icon: Clock3,      permission: 'manage_services' as Permission },
  { href: '/admin/sucursales', label: 'Sucursales', icon: Store,       permission: 'manage_branches' as Permission },
  { href: '/admin/usuarios',   label: 'Usuarios',   icon: UserSquare2, permission: 'manage_users'    as Permission },
  { href: '/admin/master',     label: 'Panel Maestro', icon: Crown,    superadminOnly: true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)

  const can = useMemo(
    () => (permission: Permission) => {
      if (!user) return false
      return hasResolvedPermission(user.role, user.permissions, permission)
    },
    [user]
  )

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        const [meRes, branchesRes] = await Promise.all([
          fetch('/api/auth/me', { cache: 'no-store' }),
          fetch('/api/branches?all=1', { cache: 'no-store' }),
        ])

        if (!meRes.ok) {
          router.replace('/login')
          return
        }

        const [{ user: nextUser }, { branches: nextBranches }] = await Promise.all([
          meRes.json(),
          branchesRes.json(),
        ])

        if (!mounted) return

        const allowedBranches = (nextUser?.role === 'barber'
          ? (nextBranches ?? []).filter((branch: Branch) => nextUser.branch_ids.includes(branch.id))
          : nextBranches ?? []) as Branch[]

        setUser(nextUser ?? null)
        setBranches(allowedBranches)

        const storedBranchId = window.localStorage.getItem('felito.activeBranch')
        const restoredBranch = allowedBranches.find(branch => branch.id === storedBranchId) ?? null
        const nextActiveBranch = nextUser?.role === 'barber'
          ? allowedBranches[0] ?? null
          : restoredBranch ?? allowedBranches[0] ?? null

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
  }, [pathname])

  useEffect(() => {
    if (activeBranch) {
      window.localStorage.setItem('felito.activeBranch', activeBranch.id)
    }
  }, [activeBranch])

  useEffect(() => {
    if (!user) return

    const permission = Object.entries(ROUTE_PERMISSIONS).find(([route]) => pathname.startsWith(route))?.[1]
    if (permission && !can(permission)) {
      router.replace('/admin/dashboard')
    }
  }, [can, pathname, router, user])

  const visibleNav = NAV_ITEMS.filter(item => {
    if ((item as any).superadminOnly) return user?.role === 'superadmin'
    return !item.permission || can(item.permission)
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
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
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Felito Barber Studio</p>
            <p className="text-xs text-slate-500">Backoffice operativo</p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 px-4 py-4">
        <div className="relative">
          <button
            onClick={() => setBranchOpen(current => !current)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-slate-300"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Sucursal activa</p>
              <p className="truncate text-sm font-semibold text-slate-900">
                {activeBranch?.name ?? (user?.role === 'barber' ? 'Sin sucursal asignada' : 'Todas las sucursales')}
              </p>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', branchOpen && 'rotate-180')} />
          </button>

          {branchOpen && (
            <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              {user?.role !== 'barber' && (
                <button
                  onClick={() => {
                    setActiveBranch(null)
                    setBranchOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50',
                    !activeBranch ? 'bg-slate-50 font-semibold text-slate-950' : 'text-slate-600'
                  )}
                >
                  Todas las sucursales
                </button>
              )}
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => {
                    setActiveBranch(branch)
                    setBranchOpen(false)
                  }}
                  className={cn(
                    'w-full border-t border-slate-100 px-4 py-3 text-left text-sm transition hover:bg-slate-50',
                    activeBranch?.id === branch.id ? 'bg-slate-50 font-semibold text-slate-950' : 'text-slate-600'
                  )}
                >
                  {branch.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNav.map(item => {
          const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
                active
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">{user?.name ?? user?.email}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
          </div>
          <Button variant="outline" className="mt-3 w-full justify-center" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <AdminContext.Provider value={{ user, branches, activeBranch, setActiveBranch, can }}>
      <div className="admin-theme min-h-screen bg-page text-slate-900">
        <div className="lg:hidden">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
            <div>
              <p className="text-sm font-semibold text-slate-950">Felito Barber Studio</p>
              <p className="text-xs text-slate-500">{activeBranch?.name ?? 'Panel administrativo'}</p>
            </div>
            <button
              onClick={() => setMobileOpen(current => !current)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </header>

          {mobileOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm">
              <div className="h-full w-[88%] max-w-sm bg-slate-50 shadow-2xl">
                {sidebar}
              </div>
            </div>
          )}
        </div>

        <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-slate-200 bg-slate-50 lg:block">
          {sidebar}
        </aside>

        <main className="min-h-screen lg:pl-80">
          <div className="border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Operaciones</p>
                <p className="text-sm text-slate-600">
                  {activeBranch?.name ?? 'Vista global'}
                </p>
              </div>
              <Link href="/" className="text-sm font-medium text-slate-500 transition hover:text-slate-950">
                Ver reserva pública
              </Link>
            </div>
          </div>
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  )
}
