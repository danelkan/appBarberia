'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { Clock, Save, Shield, CheckCircle } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { cn, DAY_NAMES } from '@/lib/utils'
import { useAdmin } from '../layout'
import type { WeeklyAvailability, DaySchedule, Barber } from '@/types'

const DEFAULT_AVAIL: WeeklyAvailability = {
  monday:    { enabled: true,  start: '10:00', end: '20:00' },
  tuesday:   { enabled: true,  start: '10:00', end: '20:00' },
  wednesday: { enabled: true,  start: '10:00', end: '20:00' },
  thursday:  { enabled: true,  start: '10:00', end: '20:00' },
  friday:    { enabled: true,  start: '10:00', end: '20:00' },
  saturday:  { enabled: true,  start: '10:00', end: '20:00' },
  sunday:    { enabled: false, start: '10:00', end: '20:00' },
}

export default function HorariosPage() {
  const { user: userRole }  = useAdmin()
  const [availability, setAvailability] = useState<WeeklyAvailability>(DEFAULT_AVAIL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    if (!userRole?.barber_id) return
    fetch('/api/barbers/me')
      .then(r => r.json())
      .then((data: { barber: Barber }) => {
        if (data.barber?.availability) setAvailability(data.barber.availability)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
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

  if (!userRole) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (userRole.role !== 'barber') {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto">
        <div className="card p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-gold" />
          </div>
          <h2 className="font-serif text-xl text-cream mb-2">Acceso completo disponible</h2>
          <p className="text-cream/45 text-sm font-medium">
            Como administrador, gestionás los horarios de todos los barberos desde la sección{' '}
            <span className="text-gold-dark font-semibold">Barberos</span>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto">

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Mis Horarios</h1>
          <p className="text-sm text-cream/45 mt-0.5">
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
                'flex items-center gap-3 p-4 rounded-xl border transition-all',
                sched.enabled
                  ? 'border-border bg-white shadow-card'
                  : 'border-border bg-surface-2 opacity-55'
              )}
            >
              <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={sched.enabled}
                  onChange={e => updateDay(day, 'enabled', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
                <span className="text-sm font-semibold text-cream/75 capitalize w-24">{DAY_NAMES[day]}</span>
              </label>

              {sched.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={sched.start}
                    onChange={e => updateDay(day, 'start', e.target.value)}
                    className="input py-1.5 px-2.5 text-sm flex-1"
                  />
                  <span className="text-cream/30 text-xs font-bold flex-shrink-0">–</span>
                  <input
                    type="time"
                    value={sched.end}
                    onChange={e => updateDay(day, 'end', e.target.value)}
                    className="input py-1.5 px-2.5 text-sm flex-1"
                  />
                </div>
              ) : (
                <span className="text-xs text-cream/35 flex-1 font-medium">No disponible</span>
              )}
            </div>
          ))}
        </div>
      )}

      {saved && (
        <div className="mt-4 flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold animate-fade-up">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Horarios actualizados correctamente
        </div>
      )}
    </div>
  )
}
