'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, Link2, Pencil, Plus, Trash2, UserCog } from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn, DAY_NAMES } from '@/lib/utils'
import type { Barber, Branch, DaySchedule, WeeklyAvailability } from '@/types'

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: { enabled: true, start: '09:00', end: '19:00' },
  tuesday: { enabled: true, start: '09:00', end: '19:00' },
  wednesday: { enabled: true, start: '09:00', end: '19:00' },
  thursday: { enabled: true, start: '09:00', end: '19:00' },
  friday: { enabled: true, start: '09:00', end: '19:00' },
  saturday: { enabled: true, start: '09:00', end: '14:00' },
  sunday: { enabled: false, start: '09:00', end: '13:00' },
}

interface BarberFormState extends Partial<Barber> {
  password?: string
  existing_user_email?: string
  role?: 'admin' | 'barber'
  branch_ids: string[]
}

const EMPTY_BARBER: BarberFormState = {
  name: '',
  email: '',
  password: '',
  existing_user_email: '',
  role: 'barber',
  branch_ids: [],
  availability: DEFAULT_AVAILABILITY,
}

export default function BarberosPage() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [linkMode, setLinkMode] = useState(false)
  const [editing, setEditing] = useState<BarberFormState>(EMPTY_BARBER)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [barbersRes, branchesRes] = await Promise.all([
        fetch('/api/barbers', { cache: 'no-store' }),
        fetch('/api/branches?all=1', { cache: 'no-store' }),
      ])
      const [barbersData, branchesData] = await Promise.all([barbersRes.json(), branchesRes.json()])
      setBarbers(barbersData.barbers ?? [])
      setBranches(branchesData.branches ?? [])
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(EMPTY_BARBER)
    setLinkMode(false)
    setModalOpen(true)
  }

  function openEdit(barber: Barber) {
    setEditing({
      ...barber,
      role: barber.role === 'admin' || barber.role === 'superadmin' ? 'admin' : 'barber',
      password: '',
      branch_ids: barber.branch_ids ?? barber.branches?.map(branch => branch.id) ?? [],
    })
    setModalOpen(true)
  }

  function toggleBranch(branchId: string) {
    setEditing(current => ({
      ...current,
      branch_ids: current.branch_ids.includes(branchId)
        ? current.branch_ids.filter(item => item !== branchId)
        : [...current.branch_ids, branchId],
    }))
  }

  function updateDay(day: string, field: keyof DaySchedule, value: string | boolean) {
    setEditing(current => {
      const currentAvailability = (current.availability ?? DEFAULT_AVAILABILITY) as WeeklyAvailability
      const currentDay = currentAvailability[day] ?? DEFAULT_AVAILABILITY[day]
      return {
        ...current,
        availability: {
          ...currentAvailability,
          [day]: {
            ...currentDay,
            [field]: value,
          },
        },
      }
    })
  }

  async function saveBarber() {
    const payload: Record<string, unknown> = {
      name: editing.name,
      email: editing.email,
      role: editing.role,
      branch_ids: editing.branch_ids,
      availability: editing.availability,
    }

    if (editing.id) {
      if (editing.password) payload.password = editing.password
    } else if (linkMode) {
      payload.existing_user_email = editing.existing_user_email
    } else {
      payload.password = editing.password
    }

    setSaving(true)
    const response = await fetch(editing.id ? `/api/barbers/${editing.id}` : '/api/barbers', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)

    if (!response.ok) return

    setModalOpen(false)
    await loadData()
  }

  async function removeBarber(id: string) {
    if (!confirm('¿Eliminar este barbero y su acceso?')) return
    await fetch(`/api/barbers/${id}`, { method: 'DELETE' })
    await loadData()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Barberos"
        subtitle="Administrá equipo, roles, accesos, sucursales y disponibilidad semanal desde una sola pantalla."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo barbero
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : barbers.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-6 w-6" />}
          title="Todavía no hay barberos"
          description="Creá el primer miembro del equipo para empezar a tomar turnos y operar caja."
          action={<Button onClick={openCreate}>Crear barbero</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {barbers.map(barber => {
            const activeDays = Object.entries(barber.availability ?? {})
              .filter(([, value]) => value.enabled)
              .map(([day]) => DAY_NAMES[day])

            return (
              <div key={barber.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        {barber.name[0]}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{barber.name}</p>
                        <p className="text-sm text-slate-500">{barber.email}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {barber.role === 'admin' || barber.role === 'superadmin' ? 'Admin' : 'Barbero'}
                      </span>
                      {(barber.branches ?? []).map(branch => (
                        <span key={branch.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                          <Building2 className="h-3 w-3" />
                          {branch.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => openEdit(barber)} className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => removeBarber(barber.id)} className="rounded-2xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Disponibilidad</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeDays.map(day => (
                      <span key={day} className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-medium capitalize text-white">
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar barbero' : 'Nuevo barbero'} size="lg">
        <div className="max-h-[78vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={editing.name ?? ''}
              onChange={event => setEditing(current => ({ ...current, name: event.target.value }))}
              placeholder="Nombre del barbero"
            />
            <Input
              label="Email"
              type="email"
              value={editing.email ?? ''}
              onChange={event => setEditing(current => ({ ...current, email: event.target.value }))}
              placeholder="barbero@felito.com"
            />
          </div>

          {!editing.id && (
            <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setLinkMode(false)}
                className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition', !linkMode ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                Crear acceso
              </button>
              <button
                type="button"
                onClick={() => setLinkMode(true)}
                className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition', linkMode ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                <Link2 className="h-4 w-4" />
                Vincular usuario
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {editing.id ? (
              <Input
                label="Nueva contraseña"
                type="password"
                value={editing.password ?? ''}
                onChange={event => setEditing(current => ({ ...current, password: event.target.value }))}
                placeholder="Opcional"
              />
            ) : linkMode ? (
              <Input
                label="Email del usuario existente"
                type="email"
                value={editing.existing_user_email ?? ''}
                onChange={event => setEditing(current => ({ ...current, existing_user_email: event.target.value }))}
                placeholder="usuario existente"
              />
            ) : (
              <Input
                label="Contraseña"
                type="password"
                value={editing.password ?? ''}
                onChange={event => setEditing(current => ({ ...current, password: event.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            )}

            <div>
              <label className="label">Rol</label>
              <div className="grid grid-cols-2 gap-2">
                {(['barber', 'admin'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setEditing(current => ({ ...current, role }))}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-sm font-semibold transition',
                      editing.role === role ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {role === 'admin' ? 'Admin' : 'Barbero'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Sucursales</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map(branch => {
                const selected = editing.branch_ids.includes(branch.id)
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left text-sm font-medium transition',
                      selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {branch.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Disponibilidad semanal</label>
            <div className="space-y-3">
              {Object.entries(editing.availability ?? DEFAULT_AVAILABILITY).map(([day, schedule]) => (
                <div key={day} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-3 text-sm font-medium capitalize text-slate-700 sm:w-40">
                      <input
                        type="checkbox"
                        checked={schedule.enabled}
                        onChange={event => updateDay(day, 'enabled', event.target.checked)}
                        className="accent-slate-950"
                      />
                      {DAY_NAMES[day]}
                    </label>
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <input
                        type="time"
                        value={schedule.start}
                        onChange={event => updateDay(day, 'start', event.target.value)}
                        className="input"
                        disabled={!schedule.enabled}
                      />
                      <input
                        type="time"
                        value={schedule.end}
                        onChange={event => updateDay(day, 'end', event.target.value)}
                        className="input"
                        disabled={!schedule.enabled}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={saveBarber} loading={saving}>
              {editing.id ? 'Guardar cambios' : 'Crear barbero'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
