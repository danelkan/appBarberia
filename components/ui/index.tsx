'use client'
import { cn } from '@/lib/utils'
import { Loader2, X } from 'lucide-react'
import { forwardRef, useEffect } from 'react'

// ─── Button ───────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', size = 'md', loading, children, className, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none rounded-lg'
    const variants = {
      gold: 'bg-gold text-black hover:bg-gold-light',
      outline: 'border border-border text-cream/70 hover:border-gold/40 hover:text-cream hover:bg-surface',
      ghost: 'text-cream/60 hover:text-cream hover:bg-surface',
      danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
    }
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3.5 text-base',
    }
    return (
      <button ref={ref} disabled={disabled || loading} className={cn(base, variants[variant], sizes[size], className)} {...props}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ─── Badge ────────────────────────────────────────────────────────
interface BadgeProps { children: React.ReactNode; className?: string }
export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn('badge', className)}>{children}</span>
  )
}

// ─── Input ────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input ref={ref} className={cn('input', error && 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10', className)} {...props} />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

// ─── Spinner ──────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('w-5 h-5 animate-spin text-gold', className)} />
}

// ─── Modal ────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-6 animate-fade-up">
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-serif text-lg text-cream">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/40 hover:text-cream transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────
export function EmptyState({ icon, title, description }: {
  icon: React.ReactNode; title: string; description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-cream/20 mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-cream/60">{title}</p>
      {description && <p className="text-xs text-cream/30 mt-1 max-w-xs">{description}</p>}
    </div>
  )
}
