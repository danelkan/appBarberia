'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar, Users, Scissors, UserCog, LogOut,
  Shield, Clock, ChevronDown, MapPin, DollarSign, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import type { Branch } from '@/types'

interface UserRole {
  id: string
  email: string
  role: 'superadmin' | 'admin' | 'barber'
  barber_id?: string
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

const NAV = [
  { href: '/admin/agenda',    label: 'Agenda',    icon: Calendar   },
  { href: '/admin/caja',      label: 'Caja',      icon: DollarSign },
  { href: '/admin/clientes',  label: 'Clientes',  icon: Users      },
  { href: '/admin/servicios', label: 'Servicios', icon: Scissors   },
  { href: '/admin/barberos',  label: 'Barberos',  icon: UserCog    },
  { href: '/admin/horarios',  label: 'Horarios',  icon: Clock      },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]                 = useState<UserRole | null>(null)
  const [branches, setBranches]         = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null)
  const [branchOpen, setBranchOpen]     = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading]           = useState(true)
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => { if (d.user) setUser(d.user) })
        .catch(() => {})
    })
  }, [])

  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(d => {
        if (d.branches?.length) {
          setBranches(d.branches)
          setActiveBranch(d.branches[0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNav = NAV.filter(item => {
    if (user?.role === 'barber') return item.href.includes('agenda') || item.href.includes('horarios')
    return true
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

  const NavItem = ({ item }: { item: typeof NAV[0] }) => {
    const active = pathname.startsWith(item.href)
    return (
      <Link
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
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
            <span className="flex-1 text-left text-cream/80 truncate font-medium">
              {activeBranch ? activeBranch.name : 'Todas las sedes'}
            </span>
            <ChevronDown className={cn('text-cream/40 transition-transform flex-shrink-0', branchOpen && 'rotate-180', mobile ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
          </button>

          {branchOpen && (
            <div className={cn(
              'rounded-xl border border-border bg-white shadow-modal overflow-hidden animate-fade-in z-50',
              mobile ? 'absolute right-0 top-full mt-1 w-44' : 'mt-1.5'
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
                    'w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-surface-2 font-medium',
                    activeBranch?.id === b.id ? 'text-gold bg-gold/5' : 'text-cream/60'
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
                <p className="text-[10px] uppercase tracking-widest text-cream/35 font-medium">Admin</p>
              </div>
            </div>
          </div>

          {/* Branch selector */}
          <BranchSelector />

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {visibleNav.map(item => <NavItem key={item.href} item={item} />)}
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
              onClick={handleLogout}
              className="p-2 rounded-xl text-cream/40 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Main content ────────────────────────────────── */}
        <main className="lg:pl-60 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
          {children}
        </main>

        {/* ── Mobile bottom nav ───────────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-border safe-area-pb">
          <div className="flex items-center justify-around px-1 py-2">
            {visibleNav.slice(0, 5).map(item => {
              const active = pathname.startsWith(item.href)
              return (
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
