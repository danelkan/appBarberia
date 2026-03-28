'use client'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react'
import { Button, Input, Spinner, EmptyState, Modal } from '@/components/ui'
import { cn, DAY_NAMES } from '@/lib/utils'
import type { Barber, WeeklyAvailability, DaySchedule } from '@/types'

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday:    { enabled: true,  start: '09:00', end: '19:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '19:00' },
  wednesday: { enabled: true,  start: '09:00', end: '19:00' },
  thursday:  { enabled: true,  start: '09:00', end: '19:00' },
  friday:    { enabled: true,  start: '09:00', end: '19:00' },
  saturday:  { enabled: true,  start: '09:00', end: '14:00' },
  sunday:    { enabled: false, start: '09:00', end: '13:00' },
}

const EMPTY_BARBER = { name: '', email: '', availability: DEFAULT_AVAILABILITY }

export default function BarberosPage() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Barber>>(EMPTY_BARBER)
  const [saving, setSaving] = useState(false)

  const fetchBarbers = async () => {
    const res = await fetch('/api/barbers')
    const data = await res.json()
    setBarbers(data.barbers ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchBarbers() }, [])

  const openNew = () => { setEditing(EMPTY_BARBER); setModalOpen(true) }
  const openEdit = (b: Barber) => { setEditing({ ...b }); setModalOpen(true) }

  const save = async () => {
    if (!editing.name || !editing.email) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/barbers/${editing.id}` : '/api/barbers'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    setModalOpen(false)
    fetchBarbers()
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este barbero? Se eliminarán sus turnos también.')) return
    await fetch(`/api/barbers/${id}`, { method: 'DELETE' })
    fetchBarbers()
  }

  const updateDay = (day: string, field: keyof DaySchedule, value: any) => {
    setEditing(prev => {
      const prevAvail = (prev.availability ?? DEFAULT_AVAILABILITY) as WeeklyAvailability
      const prevDay = prevAvail[day] ?? DEFAULT_AVAILABILITY[day]
      const updatedDay: DaySchedule = {
        enabled: prevDay.enabled,
        start: prevDay.start,
        end: prevDay.end,
        [field]: value,
      }
      return {
        ...prev,
        availability: {
          ...prevAvail,
          [day]: updatedDay,
        },
      } as Partial<Barber>
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Barberos</h1>
          <p className="text-sm text-cream/40 mt-0.5">{barbers.length} en el equipo</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4" /> Agregar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : barbers.length === 0 ? (
        <EmptyState icon={<UserCog className="w-6 h-6" />} title="Sin barberos" description="Agregá los barberos del equipo" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {barbers.map(b => {
            const activeDays = Object.entries(b.availability ?? {})
              .filter(([, v]) => v.enabled).map(([k]) => DAY_NAMES[k])
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-serif text-lg flex-shrink-0">
                      {b.name[0]}
                    </div>
                    <div>
                      <h3 className="font-medium text-cream">{b.name}</h3>
                      <p className="text-xs text-cream/40">{b.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/30 hover:text-cream transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(b.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-cream/30 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {activeDays.map(d => (
                    <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold/80 capitalize">{d}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing.id ? 'Editar barbero' : 'Nuevo barbero'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre *" value={editing.name ?? ''}
              onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
              placeholder="Felipe" />
            <Input label="Email *" type="email" value={editing.email ?? ''}
              onChange={e => setEditing(p => ({ ...p, email: e.target.value }))}
              placeholder="felipe@..." />
          </div>

          <div>
            <p className="label">Disponibilidad semanal</p>
            <div className="space-y-2">
              {Object.entries(editing.availability ?? DEFAULT_AVAILABILITY).map(([day, sched]) => (
                <div key={day} className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                  sched.enabled ? 'border-border bg-surface-2' : 'border-border/30 opacity-50'
                )}>
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input type="checkbox" checked={sched.enabled}
                      onChange={e => updateDay(day, 'enabled', e.target.checked)}
                      className="accent-gold w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs text-cream capitalize w-20">{DAY_NAMES[day]}</span>
                  </label>
                  {sched.enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={sched.start}
                        onChange={e => updateDay(day, 'start', e.target.value)}
                        className="input py-1 px-2 text-xs flex-1" />
                      <span className="text-cream/20 text-xs">–</span>
                      <input type="time" value={sched.end}
                        onChange={e => updateDay(day, 'end', e.target.value)}
                        className="input py-1 px-2 text-xs flex-1" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-surface">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" loading={saving} onClick={save}>
              {editing.id ? 'Guardar' : 'Agregar barbero'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
