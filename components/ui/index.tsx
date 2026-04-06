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
    const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none rounded-lg'
    const variants = {
      gold:    'bg-gold text-black hover:bg-gold-dark shadow-sm',
      outline: 'border border-border bg-white text-cream/70 hover:border-gold/50 hover:text-cream hover:bg-surface-2',
      ghost:   'text-cream/60 hover:text-cream hover:bg-surface-2',
      danger:  'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
    }
    const sizes = {
      sm: 'px-3.5 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-sm',
    }
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
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
      <input
        ref={ref}
        className={cn(
          'input',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>}
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
  size?: 'sm' | 'md' | 'lg'
}
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const maxW = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={cn(
        'relative w-full bg-white border border-border rounded-t-2xl sm:rounded-2xl shadow-modal p-6 animate-fade-up',
        maxW
      )}>
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-base text-cream">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/40 hover:text-cream transition-colors"
            >
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
export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-cream/25 mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-cream/50">{title}</p>
      {description && <p className="text-xs text-cream/35 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Page header ─────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: {
  title: React.ReactNode
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="font-serif text-2xl text-cream">{title}</h1>
        {subtitle && <p className="text-sm text-cream/45 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
