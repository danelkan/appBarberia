'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, KeyRound, Link2, Pencil, Plus, Trash2, UserCog } from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn, DAY_NAMES } from '@/lib/utils'
import type { Barber, Branch, DaySchedule, WeeklyAvailability } from '@/types'

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday:    { enabled: true,  start: '09:00', end: '19:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '19:00' },
  wednesday: { enabled: true,  start: '09:00', end: '19:00' },
  thursday:  { enabled: true,  start: '09:00', end: '19:00' },
  friday:    { enabled: true,  start: '09:00', end: '19:00' },
  saturday:  { enabled: true,  start: '09:00', end: '14:00' },
  sunday:    { enabled: false, start: '09:00', end: '13:00' },
}

const EMPTY_BARBER = {
  name: '',
  email: '',
  password: '',
  existing_user_email: '',
  role: 'barber' as const,
  branch_ids: [] as string[],
  availability: DEFAULT_AVAILABILITY,
}

interface BarberFormState extends Partial<Barber> {
  password?: string
  existing_user_email?: string
  role?: 'admin' | 'barber'
  branch_ids: string[]
}

export default function BarberosPage() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BarberFormState>(EMPTY_BARBER)
  const [saving, setSaving] = useState(false)
  const [linkMode, setLinkMode] = useState(false)

  async function fetchData() {
    try {
      const [barbersRes, branchesRes] = await Promise.all([
        fetch('/api/barbers'),
        fetch('/api/branches?all=1'),
      ])

      const barbersData = await barbersRes.json()
      const branchesData = await branchesRes.json()

      setBarbers(barbersData.barbers ?? [])
      setBranches(branchesData.branches ?? [])
    } catch {
      setBarbers([])
      setBranches([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  function openNew() {
    setEditing(EMPTY_BARBER)
    setLinkMode(false)
    setModalOpen(true)
  }

  function openEdit(barber: Barber) {
    setEditing({
      ...barber,
      password: '',
      role: barber.role === 'admin' || barber.role === 'superadmin' ? 'admin' : 'barber',
      branch_ids: barber.branch_ids ?? barber.branches?.map(branch => branch.id) ?? [],
    })
    setModalOpen(true)
  }

  async function save() {
    if (!editing.name || !editing.email || editing.branch_ids.length === 0) return
    if (!editing.id && !linkMode && !editing.password) return
    if (!editing.id && linkMode && !editing.existing_user_email) return

    setSaving(true)

    const payload: Record<string, unknown> = {
      name: editing.name,
      email: editing.email,
      role: editing.role,
      branch_ids: editing.branch_ids,
      availability: editing.availability,
    }

    if (linkMode && editing.existing_user_email) {
      payload.existing_user_email = editing.existing_user_email
    } else if (editing.password) {
      payload.password = editing.password
    }

    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/barbers/${editing.id}` : '/api/barbers'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) return

    setModalOpen(false)
    fetchData()
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este barbero y su acceso?')) return
    await fetch(`/api/barbers/${id}`, { method: 'DELETE' })
    fetchData()
  }

  function updateDay(day: string, field: keyof DaySchedule, value: string | boolean) {
    setEditing(prev => {
      const previousAvailability = (prev.availability ?? DEFAULT_AVAILABILITY) as WeeklyAvailability
      const previousDay = previousAvailability[day] ?? DEFAULT_AVAILABILITY[day]

      return {
        ...prev,
        availability: {
          ...previousAvailability,
          [day]: {
            ...previousDay,
            [field]: value,
          },
        },
      }
    })
  }

  function toggleBranch(branchId: string) {
    setEditing(current => ({
      ...current,
      branch_ids: current.branch_ids.includes(branchId)
        ? current.branch_ids.filter(id => id !== branchId)
        : [...current.branch_ids, branchId],
    }))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Barberos"
        subtitle="Usuarios, roles, sedes y disponibilidad del equipo"
        action={
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4" />
            Nuevo barbero
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : barbers.length === 0 ? (
        <EmptyState
          icon={<UserCog className="w-6 h-6" />}
          title="Sin barberos"
          description="Creá el primer usuario del equipo para empezar a asignar turnos y caja."
          action={<Button size="sm" onClick={openNew}><Plus className="w-4 h-4" /> Nuevo barbero</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {barbers.map(barber => {
            const activeDays = Object.entries(barber.availability ?? {})
              .filter(([, value]) => value.enabled)
              .map(([key]) => DAY_NAMES[key])

            return (
              <div key={barber.id} className="card p-5 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center text-gold font-bold text-base flex-shrink-0">
                        {barber.name[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-cream text-sm">{barber.name}</h3>
                        <p className="text-xs text-cream/45 truncate font-medium">{barber.email}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(barber.branches ?? []).map(branch => (
                        <span
                          key={branch.id}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-surface-2 text-cream/55 border border-border font-semibold"
                        >
                          <Building2 className="w-3 h-3" />
                          {branch.name}
                        </span>
                      ))}
                    </div>

                    {activeDays.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1">
                        {activeDays.map(day => (
                          <span
                            key={day}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-gold/8 text-gold-dark border border-gold/20 capitalize font-semibold"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => openEdit(barber)}
                      className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/35 hover:text-cream transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(barber.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-cream/35 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing.id ? 'Editar barbero' : 'Nuevo barbero'}
        size="lg"
      >
        <div className="space-y-5 max-h-[78vh] overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Nombre *"
              value={editing.name ?? ''}
              onChange={event => setEditing(current => ({ ...current, name: event.target.value }))}
              placeholder="Felito"
            />
            <Input
              label="Email *"
              type="email"
              value={editing.email ?? ''}
              onChange={event => setEditing(current => ({ ...current, email: event.target.value }))}
              placeholder="felito@barberia.com"
            />
          </div>

          {/* Auth mode toggle (only for new barbers) */}
          {!editing.id && (
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setLinkMode(false)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all',
                  !linkMode ? 'bg-gold/10 text-gold-dark border-r border-gold/20' : 'text-cream/50 hover:bg-surface-2'
                )}
              >
                <KeyRound className="w-3.5 h-3.5" />
                Crear usuario nuevo
              </button>
              <button
                type="button"
                onClick={() => setLinkMode(true)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all',
                  linkMode ? 'bg-gold/10 text-gold-dark' : 'text-cream/50 hover:bg-surface-2'
                )}
              >
                <Link2 className="w-3.5 h-3.5" />
                Vincular usuario existente
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {editing.id ? (
              <Input
                label="Nueva contraseña"
                type="password"
                value={editing.password ?? ''}
                onChange={event => setEditing(current => ({ ...current, password: event.target.value }))}
                placeholder="Dejar vacío para mantenerla"
              />
            ) : linkMode ? (
              <Input
                label="Email del usuario existente *"
                type="email"
                value={editing.existing_user_email ?? ''}
                onChange={event => setEditing(current => ({ ...current, existing_user_email: event.target.value }))}
                placeholder="admin@ejemplo.com"
              />
            ) : (
              <Input
                label="Contraseña *"
                type="password"
                value={editing.password ?? ''}
                onChange={event => setEditing(current => ({ ...current, password: event.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            )}

            <div>
              <label className="label">Rol de acceso</label>
              <div className="grid grid-cols-2 gap-2">
                {(['barber', 'admin'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setEditing(current => ({ ...current, role }))}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
                      editing.role === role
                        ? 'border-gold/30 bg-gold/10 text-gold-dark'
                        : 'border-border bg-surface-2 text-cream/55 hover:bg-surface-3'
                    )}
                  >
                    {role === 'admin' ? 'Admin' : 'Barbero'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Sucursales asignadas *</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => toggleBranch(branch.id)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition-all',
                    editing.branch_ids.includes(branch.id)
                      ? 'border-gold/30 bg-gold/10'
                      : 'border-border bg-surface-2 hover:bg-surface-3'
                  )}
                >
                  <p className="text-sm font-semibold text-cream">{branch.name}</p>
                  {branch.address && <p className="mt-1 text-xs text-cream/45">{branch.address}</p>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Disponibilidad semanal</p>
            <div className="space-y-1.5">
              {Object.entries(editing.availability ?? DEFAULT_AVAILABILITY).map(([day, schedule]) => (
                <div
                  key={day}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    schedule.enabled
                      ? 'border-border bg-surface-2'
                      : 'border-border/50 bg-surface-2 opacity-50'
                  )}
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={event => updateDay(day, 'enabled', event.target.checked)}
                      className="accent-gold w-3.5 h-3.5"
                    />
                    <span className="text-xs font-semibold text-cream/70 capitalize w-20">{DAY_NAMES[day]}</span>
                  </label>

                  {schedule.enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={schedule.start}
                        onChange={event => updateDay(day, 'start', event.target.value)}
                        className="input py-1 px-2 text-xs flex-1"
                      />
                      <span className="text-cream/30 text-xs font-bold">–</span>
                      <input
                        type="time"
                        value={schedule.end}
                        onChange={event => updateDay(day, 'end', event.target.value)}
                        className="input py-1 px-2 text-xs flex-1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!editing.id && (
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-cream/55">
              <div className="flex items-start gap-2">
                {linkMode ? <Link2 className="w-4 h-4 mt-0.5 text-gold flex-shrink-0" /> : <KeyRound className="w-4 h-4 mt-0.5 text-gold flex-shrink-0" />}
                <div>
                  <p className="font-semibold text-cream">{linkMode ? 'Vinculación de usuario' : 'Alta completa'}</p>
                  <p className="mt-1">
                    {linkMode
                      ? 'El usuario existente (ej: superadmin) se vinculará al barbero y aparecerá en la agenda.'
                      : 'Al guardar, se crea el barbero, su usuario de acceso y la relación con las sucursales elegidas.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={saving}
              onClick={save}
              disabled={
                !editing.name || !editing.email || editing.branch_ids.length === 0 ||
                (!editing.id && !linkMode && !editing.password) ||
                (!editing.id && linkMode && !editing.existing_user_email)
              }
            >
              {editing.id ? 'Guardar cambios' : 'Crear barbero'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
