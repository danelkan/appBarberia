'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar, Users, Scissors, UserCog, LogOut,
  Shield, Clock, ChevronDown, MapPin, DollarSign,
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
  { href: '/admin/agenda',   label: 'Agenda',    icon: Calendar  },
  { href: '/admin/caja',     label: 'Caja',      icon: DollarSign},
  { href: '/admin/clientes', label: 'Clientes',  icon: Users     },
  { href: '/admin/servicios',label: 'Servicios', icon: Scissors  },
  { href: '/admin/barberos', label: 'Barberos',  icon: UserCog   },
  { href: '/admin/horarios', label: 'Horarios',  icon: Clock     },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<UserRole | null>(null)
  const [branches, setBranches]       = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null)
  const [branchOpen, setBranchOpen]   = useState(false)
  const [loading, setLoading]         = useState(true)
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (d.user) setUser(d.user)
      })
    })
  }, [])

  useEffect(() => {
    fetch('/api/branches').then(r => r.json()).then(d => {
      if (d.branches) {
        setBranches(d.branches)
        setActiveBranch(d.branches[0] ?? null)
      }
      setLoading(false)
    })
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout')
    router.push('/login')
  }

  const visibleNav = NAV.filter(item => {
    if (user?.role === 'barber') return ['agenda'].some(k => item.href.includes(k))
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gold border-t-transparent animate-spin" />
          <p className="text-xs uppercase tracking-widest text-cream/30">Cargando</p>
        </div>
      </div>
    )
  }

  return (
    <AdminContext.Provider value={{ user, activeBranch, branches, setActiveBranch }}>
      <div className="min-h-screen bg-[#0a0a0a]">

        {/* ── Desktop sidebar ────────────────────────────── */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-white/[0.06] bg-[#0f0f0f] z-40">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/25 flex items-center justify-center">
                <Scissors className="w-4 h-4 text-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cream">Felito Studios</p>
                <p className="text-[10px] uppercase tracking-widest text-cream/30">Admin</p>
              </div>
            </div>
          </div>

          {/* Branch selector */}
          {branches.length > 0 && (
            <div className="px-3 py-3 border-b border-white/[0.06]">
              <button
                onClick={() => setBranchOpen(!branchOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-all"
              >
                <MapPin className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                <span className="flex-1 text-left text-sm text-cream truncate">
                  {activeBranch ? activeBranch.name : 'Todas las sedes'}
                </span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-cream/40 transition-transform', branchOpen && 'rotate-180')} />
              </button>
              {branchOpen && (
                <div className="mt-1 rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden animate-fade-up">
                  {user?.role !== 'barber' && (
                    <button
                      onClick={() => { setActiveBranch(null); setBranchOpen(false) }}
                      className={cn('w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/[0.05]',
                        activeBranch === null ? 'text-gold' : 'text-cream/60')}
                    >
                      Todas las sedes
                    </button>
                  )}
                  {branches.map(b => (
                    <button
                      key={b.id}
                      onClick={() => { setActiveBranch(b); setBranchOpen(false) }}
                      className={cn('w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/[0.05]',
                        activeBranch?.id === b.id ? 'text-gold' : 'text-cream/60')}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            {visibleNav.map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                    active
                      ? 'bg-gold/10 text-gold border border-gold/20'
                      : 'text-cream/50 hover:text-cream hover:bg-white/[0.04]'
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User + logout */}
          <div className="px-3 py-3 border-t border-white/[0.06]">
            {user && (
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center text-xs font-semibold text-gold">
                  {user.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-cream truncate">{user.email}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {user.role === 'superadmin' && <Shield className="w-3 h-3 text-gold" />}
                    <p className="text-[10px] uppercase tracking-wider text-cream/30">{user.role}</p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-cream/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </aside>

        {/* ── Mobile top bar ──────────────────────────────── */}
        <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/20 flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-sm font-semibold text-cream">Felito Studios</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile branch selector */}
            {branches.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setBranchOpen(!branchOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-cream/70"
                >
                  <MapPin className="w-3 h-3 text-gold" />
                  {activeBranch?.name ?? 'Todas'}
                  <ChevronDown className={cn('w-3 h-3 transition-transform', branchOpen && 'rotate-180')} />
                </button>
                {branchOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/[0.08] bg-[#1a1a1a] shadow-xl overflow-hidden animate-fade-up z-50">
                    {user?.role !== 'barber' && (
                      <button
                        onClick={() => { setActiveBranch(null); setBranchOpen(false) }}
                        className={cn('w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.05]',
                          activeBranch === null ? 'text-gold' : 'text-cream/60')}
                      >
                        Todas las sedes
                      </button>
                    )}
                    {branches.map(b => (
                      <button
                        key={b.id}
                        onClick={() => { setActiveBranch(b); setBranchOpen(false) }}
                        className={cn('w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.05]',
                          activeBranch?.id === b.id ? 'text-gold' : 'text-cream/60')}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-cream/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-sm border-t border-white/[0.06]">
          <div className="flex items-center justify-around px-1 py-2 safe-area-pb">
            {visibleNav.slice(0, 5).map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[52px]',
                    active ? 'text-gold' : 'text-cream/35 hover:text-cream/70'
                  )}
                >
                  <item.icon className={cn('w-5 h-5 transition-transform', active && 'scale-110')} />
                  <span className="text-[9px] uppercase tracking-wider font-medium">{item.label}</span>
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
