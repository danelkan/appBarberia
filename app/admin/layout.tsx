'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Calendar, Users, Scissors, UserCog, Menu, X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const NAV = [
  { href: '/admin/agenda',    label: 'Agenda',    icon: Calendar },
  { href: '/admin/clientes',  label: 'Clientes',  icon: Users },
  { href: '/admin/servicios', label: 'Servicios', icon: Scissors },
  { href: '/admin/barberos',  label: 'Barberos',  icon: UserCog },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  const NavLinks = () => (
    <>
      {NAV.map(item => {
        const Icon = item.icon
        const active = pathname === item.href
        return (
          <Link key={item.href} href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
              active ? 'bg-gold/10 text-gold border border-gold/20' : 'text-cream/50 hover:text-cream hover:bg-surface-2'
            )}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen bg-black flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-surface shrink-0">
        <div className="p-5 border-b border-border">
          <h1 className="font-serif text-lg text-cream">Felito Studios</h1>
          <p className="text-xs text-cream/30 mt-0.5">Panel de gestión</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks />
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <Link href="/reservar" target="_blank"
            className="flex items-center gap-2 px-3 py-2 text-xs text-cream/30 hover:text-cream/60 transition-colors rounded-lg hover:bg-surface-2">
            <Scissors className="w-3.5 h-3.5" />
            Ver reservas
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-3 py-2 w-full text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-lg disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/80" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-border p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="font-serif text-lg text-cream">Felito Studios</h1>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/40">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="space-y-1 flex-1"><NavLinks /></nav>
            <div className="pt-4 mt-4 border-t border-border">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 px-3 py-2 w-full text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-lg disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-surface text-cream/60">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif text-cream">
            {NAV.find(n => n.href === pathname)?.label ?? 'Admin'}
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
