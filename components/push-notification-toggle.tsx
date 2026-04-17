'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type PushState = 'unsupported' | 'disabled' | 'ready' | 'enabled' | 'loading' | 'error' | 'install'

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }
  return output
}

export function PushNotificationToggle({ className }: { className?: string }) {
  const [state, setState] = useState<PushState>('loading')
  const [message, setMessage] = useState('Preparando notificaciones')
  const supported = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext
  }, [])

  const needsIosInstall = useMemo(() => {
    if (typeof window === 'undefined') return false
    const ua = window.navigator.userAgent
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    return isIos && !standalone
  }, [])

  useEffect(() => {
    let mounted = true

    async function check() {
      if (needsIosInstall) {
        setState('install')
        setMessage('En iPhone instalá la app')
        return
      }

      if (!supported) {
        setState('unsupported')
        setMessage(window.isSecureContext ? 'Este navegador no soporta push' : 'Push requiere HTTPS')
        return
      }

      const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' }).catch(() => null)
      const keyData = keyRes?.ok ? await keyRes.json().catch(() => null) : null
      if (!mounted) return

      if (!keyData?.enabled) {
        setState('disabled')
        setMessage(keyData?.message ?? 'Push pendiente de configurar')
        return
      }

      const healthRes = await fetch('/api/push/subscriptions', { cache: 'no-store' }).catch(() => null)
      if (!healthRes?.ok) {
        const healthData = await healthRes?.json().catch(() => null)
        setState('error')
        setMessage(healthData?.error ?? 'Falta preparar la tabla push')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()
      if (!mounted) return

      setState(existing ? 'enabled' : 'ready')
      setMessage(existing ? 'Notificaciones activas' : 'Activar notificaciones')
    }

    void check().catch(() => {
      if (!mounted) return
      setState('error')
      setMessage('No se pudo preparar push')
    })

    return () => {
      mounted = false
    }
  }, [needsIosInstall, supported])

  async function enablePush() {
    if (!supported || state === 'loading' || state === 'install') return
    setState('loading')
    setMessage('Activando...')

    try {
      const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' })
      const keyData = await keyRes.json()
      if (!keyData?.enabled || !keyData.publicKey) {
        setState('disabled')
        setMessage(keyData?.message ?? 'Push pendiente de configurar')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('ready')
        setMessage('Permiso no concedido')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      })

      const res = await fetch('/api/push/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Subscription failed')
      }

      setState('enabled')
      setMessage('Notificaciones activas')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo activar')
    }
  }

  const inactive = state === 'unsupported' || state === 'disabled' || state === 'install'
  const Icon = state === 'enabled' ? Bell : BellOff

  return (
    <button
      type="button"
      onClick={enablePush}
      disabled={state === 'loading' || state === 'unsupported' || state === 'disabled' || state === 'install'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition',
        state === 'enabled'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : inactive
            ? 'border-stone-200 bg-stone-50 text-stone-400'
            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-950',
        className
      )}
      title={message}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{message}</span>
    </button>
  )
}
