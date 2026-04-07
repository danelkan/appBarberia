'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar, Users, Scissors, UserCog, LogOut,
  Shield, Clock, ChevronDown, MapPin, DollarSign,
  Building2, LayoutDashboard, UserCircle, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import type { Branch } from '@/types'

interface UserRole {
  id: string
  email: string
  role: 'superadmin' | 'admin' | 'barber'
  barber_id?: string
  branch_ids?: string[]
}

interface AdminContextValue {
  user: UserRole | null
  activeBranch: Branch | null
  branches: Branch[]
  setActiveBranch: (b: Branch | null) => void
}

export const AdminContext = createContext<AdminContextValue>({
  user: null, activeBranch: null, branches: [], setActiveBranch: () => {},
})
export const useAdmin = () => useContext(AdminContext)

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: ('superadmin' | 'admin' | 'barber')[]
}

const NAV: NavItem[] = [
  { href: '/admin/dashboard',  label: 'Inicio',     icon: LayoutDashboard },
  { href: '/admin/agenda',     label: 'Agenda',     icon: Calendar        },
  { href: '/admin/caja',       label: 'Caja',       icon: DollarSign      },
  { href: '/admin/clientes',   label: 'Clientes',   icon: Users,          roles: ['superadmin', 'admin'] },
  { href: '/admin/servicios',  label: 'Servicios',  icon: Scissors,       roles: ['superadmin', 'admin'] },
  { href: '/admin/barberos',   label: 'Barberos',   icon: UserCog,        roles: ['superadmin', 'admin'] },
  { href: '/admin/horarios',   label: 'Horarios',   icon: Clock           },
  { href: '/admin/sucursales', label: 'Sucursales', icon: Building2,      roles: ['superadmin', 'admin'] },
  { href: '/admin/empresas',   label: 'Empresas',   icon: Building2,      roles: ['superadmin'] },
  { href: '/admin/usuarios',   label: 'Usuarios',   icon: UserCircle,     roles: ['superadmin'] },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]                 = useState<UserRole | null>(null)
  const [branches, setBranches]         = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null)
  const [branchOpen, setBranchOpen]     = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createSupabaseBrowserClient()

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      try {
        const [userRes, branchesRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/branches'),
        ])
        const userData    = await userRes.json()
        const branchesData = await branchesRes.json()

        if (!mounted) return

        const nextUser     = userData.user ?? null
        const allBranches  = branchesData.branches ?? []
        const allowedBranches = nextUser?.role === 'barber'
          ? allBranches.filter((b: Branch) => nextUser.branch_ids?.includes(b.id))
          : allBranches

        setUser(nextUser)
        setBranches(allowedBranches)

        const defaultBranch = allowedBranches.find((b: Branch) =>
          b.name.toLowerCase().includes('punta carretas')
        ) ?? allowedBranches[0] ?? null

        setActiveBranch(nextUser?.role === 'barber' ? (allowedBranches[0] ?? null) : defaultBranch)
      } catch {
        if (mounted) setBranches([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    bootstrap()
    return () => { mounted = false }
  }, [router, supabase.auth])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNav = NAV.filter(item => {
    if (!item.roles) return true
    return user && item.roles.includes(user.role)
  })

  if (loading) {
    return (
      <div className="admin-theme min-h-screen bg-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gold border-t-transparent animate-spin" />
          <p className="text-xs uppercase tracking-widest text-cream/30 font-medium">Cargando</p>
        </div>
      </div>
    )
  }

  const NavItem = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
          active
            ? 'bg-gold/10 text-gold-dark border border-gold/20 shadow-sm'
            : 'text-cream/55 hover:text-cream hover:bg-surface-2'
        )}
      >
        <item.icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-gold' : '')} />
        {item.label}
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold" />}
      </Link>
    )
  }

  const BranchSelector = ({ mobile }: { mobile?: boolean }) => (
    <div className={cn('relative', mobile ? '' : 'px-3 py-3 border-b border-border')}>
      {!mobile && branches.length > 0 && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-cream/30 px-1 mb-2">Sede activa</p>
      )}
      {branches.length > 0 && (
        <>
          <button
            onClick={() => setBranchOpen(!branchOpen)}
            className={cn(
              'flex items-center gap-2 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-all',
              mobile ? 'px-2.5 py-1.5 text-xs' : 'w-full px-3 py-2.5 text-sm'
            )}
          >
            <MapPin className={cn('flex-shrink-0 text-gold', mobile ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
            <span className={cn('flex-1 text-left text-cream/80 truncate font-medium', mobile ? 'max-w-[80px]' : '')}>
              {activeBranch ? activeBranch.name : 'Todas las sedes'}
            </span>
            <ChevronDown className={cn('text-cream/40 transition-transform flex-shrink-0', branchOpen && 'rotate-180', mobile ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
          </button>

          {branchOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBranchOpen(false)} />
              <div className={cn(
                'rounded-xl border border-border bg-white shadow-modal overflow-hidden animate-fade-in z-50',
                mobile ? 'absolute right-0 top-full mt-1 w-48' : 'mt-1.5',
                !mobile && 'relative z-50'
              )}>
                {user?.role !== 'barber' && (
                  <button
                    onClick={() => { setActiveBranch(null); setBranchOpen(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-surface-2 font-medium',
                      activeBranch === null ? 'text-gold' : 'text-cream/60'
                    )}
                  >
                    Todas las sedes
                  </button>
                )}
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setActiveBranch(b); setBranchOpen(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-surface-2 font-medium border-t border-border/50',
                      activeBranch?.id === b.id ? 'text-gold bg-gold/5' : 'text-cream/60'
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )

  // Separate nav into main and admin sections
  const mainNav  = visibleNav.filter(item => !['superadmin'].includes(
    NAV.find(n => n.href === item.href)?.roles?.[0] ?? ''
  ) || item.href === '/admin/dashboard')
  const adminNav = visibleNav.filter(item =>
    NAV.find(n => n.href === item.href)?.roles?.[0] === 'superadmin' && item.href !== '/admin/dashboard'
  )

  return (
    <AdminContext.Provider value={{ user, activeBranch, branches, setActiveBranch }}>
      <div className="admin-theme min-h-screen bg-page">

        {/* ── Desktop sidebar ────────────────────────────── */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-border z-40">

          {/* Logo */}
          <div className="px-5 py-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shadow-sm">
                <Scissors className="w-4 h-4 text-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cream">Felito Studios</p>
                <p className="text-[10px] uppercase tracking-widest text-cream/35 font-medium">Panel Admin</p>
              </div>
            </div>
          </div>

          {/* Branch selector */}
          <BranchSelector />

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {mainNav.map(item => <NavItem key={item.href} item={item} />)}

            {adminNav.length > 0 && (
              <>
                <div className="pt-3 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-cream/25 px-3">Sistema</p>
                </div>
                {adminNav.map(item => <NavItem key={item.href} item={item} />)}
              </>
            )}
          </nav>

          {/* User + logout */}
          <div className="px-3 py-3 border-t border-border">
            {user && (
              <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl bg-surface-2">
                <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {user.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-cream truncate">{user.email}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {user.role === 'superadmin' && <Shield className="w-2.5 h-2.5 text-gold" />}
                    <p className="text-[10px] uppercase tracking-wider text-cream/35 font-semibold">{user.role}</p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-cream/40 hover:text-red-500 hover:bg-red-50 transition-all font-medium"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ── Mobile top bar ──────────────────────────────── */}
        <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-white/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-sm font-semibold text-cream">Felito Studios</span>
          </div>

          <div className="flex items-center gap-2">
            <BranchSelector mobile />
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl text-cream/50 hover:text-cream hover:bg-surface-2 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── Mobile drawer ────────────────────────────────── */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-72 bg-white flex flex-col animate-fade-in shadow-modal">
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-cream">Felito Studios</p>
                  {user && (
                    <p className="text-xs text-cream/45 font-medium truncate max-w-[160px]">{user.email}</p>
                  )}
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl hover:bg-surface-2 text-cream/40 hover:text-cream transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer nav */}
              <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {mainNav.map(item => <NavItem key={item.href} item={item} onClick={() => setMobileOpen(false)} />)}
                {adminNav.length > 0 && (
                  <>
                    <div className="pt-3 pb-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-cream/25 px-3">Sistema</p>
                    </div>
                    {adminNav.map(item => <NavItem key={item.href} item={item} onClick={() => setMobileOpen(false)} />)}
                  </>
                )}
              </nav>

              {/* Drawer footer */}
              <div className="px-3 py-3 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-cream/40 hover:text-red-500 hover:bg-red-50 transition-all font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main content ────────────────────────────────── */}
        <main className="lg:pl-60 pt-14 lg:pt-0 min-h-screen pb-4">
          {children}
        </main>

        {/* ── Mobile bottom nav (main items only) ─────────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-border safe-area-pb">
          <div className="flex items-center justify-around px-1 py-2">
            {[
              { href: '/admin/dashboard', label: 'Inicio',  icon: LayoutDashboard },
              { href: '/admin/agenda',    label: 'Agenda',  icon: Calendar        },
              { href: '/admin/caja',      label: 'Caja',    icon: DollarSign      },
              { href: '/admin/barberos',  label: 'Equipo',  icon: UserCog         },
              { href: '/admin/horarios',  label: 'Más',     icon: Menu, isMenu: true },
            ].map(item => {
              const active = 'isMenu' in item && item.isMenu
                ? false
                : pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
              return 'isMenu' in item && item.isMenu ? (
                <button
                  key="menu"
                  onClick={() => setMobileOpen(true)}
                  className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-cream/35 hover:text-cream/60 transition-all min-w-[52px]"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[9px] uppercase tracking-wider font-semibold">Más</span>
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[52px]',
                    active ? 'text-gold' : 'text-cream/35 hover:text-cream/60'
                  )}
                >
                  <item.icon className={cn('w-5 h-5 transition-transform', active && 'scale-110')} />
                  <span className="text-[9px] uppercase tracking-wider font-semibold">{item.label}</span>
                  {active && <span className="w-1 h-1 rounded-full bg-gold" />}
                </Link>
              )
            })}
          </div>
        </nav>

      </div>
    </AdminContext.Provider>
  )
}
