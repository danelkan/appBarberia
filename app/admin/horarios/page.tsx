'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { Clock, Save, Shield } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { cn, DAY_NAMES } from '@/lib/utils'
import { useAdmin } from "../layout"
import type { WeeklyAvailability, DaySchedule, Barber } from '@/types'

const DEFAULT_AVAIL: WeeklyAvailability = {
  monday:    { enabled: true,  start: '09:00', end: '19:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '19:00' },
  wednesday: { enabled: true,  start: '09:00', end: '19:00' },
  thursday:  { enabled: true,  start: '09:00', end: '19:00' },
  friday:    { enabled: true,  start: '09:00', end: '19:00' },
  saturday:  { enabled: true,  start: '09:00', end: '14:00' },
  sunday:    { enabled: false, start: '09:00', end: '13:00' },
}

export default function HorariosPage() {
  const { user: userRole } = useAdmin()
  const [availability, setAvailability] = useState<WeeklyAvailability>(DEFAULT_AVAIL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!userRole?.barber_id) return
    fetch('/api/barbers')
      .then(r => r.json())
      .then((data: { barbers: Barber[] }) => {
        const me = data.barbers.find(b => b.id === userRole.barber_id)
        if (me?.availability) setAvailability(me.availability)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userRole])

  const updateDay = (day: string, field: keyof DaySchedule, value: any) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...(prev[day] ?? DEFAULT_AVAIL[day]), [field]: value },
    }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/barbers/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (!userRole) return <div className="flex justify-center py-20"><Spinner /></div>

  // Superadmin no debería llegar acá — tiene todo en /admin/barberos
  if (userRole.role !== 'barber') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <Shield className="w-10 h-10 text-gold mx-auto mb-4" />
        <h2 className="font-serif text-xl text-cream mb-2">Acceso completo disponible</h2>
        <p className="text-cream/40 text-sm">Como superadmin, gestionás los horarios de todos los barberos desde la sección Barberos.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Mis Horarios</h1>
          <p className="text-sm text-cream/40 mt-0.5">
            Configurá los días y horarios en que estás disponible
          </p>
        </div>
        <Button onClick={save} loading={saving} size="sm">
          <Save className="w-4 h-4" />
          {saved ? '¡Guardado!' : 'Guardar'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {Object.entries(availability).map(([day, sched]) => (
            <div
              key={day}
              className={cn(
                'flex items-center gap-3 p-3.5 rounded-xl border transition-all',
                sched.enabled
                  ? 'border-border bg-surface'
                  : 'border-border/30 bg-surface/40 opacity-60'
              )}
            >
              <label className="flex items-center gap-3 cursor-pointer min-w-0 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={sched.enabled}
                  onChange={e => updateDay(day, 'enabled', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
                <span className="text-sm text-cream capitalize w-24">{DAY_NAMES[day]}</span>
              </label>

              {sched.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={sched.start}
                    onChange={e => updateDay(day, 'start', e.target.value)}
                    className="input py-1.5 px-2.5 text-sm flex-1"
                  />
                  <span className="text-cream/20 text-xs flex-shrink-0">–</span>
                  <input
                    type="time"
                    value={sched.end}
                    onChange={e => updateDay(day, 'end', e.target.value)}
                    className="input py-1.5 px-2.5 text-sm flex-1"
                  />
                </div>
              ) : (
                <span className="text-xs text-cream/30 flex-1">No disponible</span>
              )}
            </div>
          ))}
        </div>
      )}

      {saved && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
          Horarios actualizados correctamente
        </div>
      )}
    </div>
  )
}
