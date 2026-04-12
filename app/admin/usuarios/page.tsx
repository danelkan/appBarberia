'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  Check,
  CalendarCheck,
  EyeOff,
  Pencil,
  Plus,
  Power,
  Scissors,
  Shield,
  Trash2,
  UserSquare2,
} from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn, DAY_NAMES } from '@/lib/utils'
import { useAdmin } from '../layout'
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_DEFAULT_PERMISSIONS,
  type AppRole,
  type Branch,
  type DaySchedule,
  type Permission,
  type UserWithRole,
  type WeeklyAvailability,
} from '@/types'

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday:    { enabled: true,  start: '09:00', end: '19:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '19:00' },
  wednesday: { enabled: true,  start: '09:00', end: '19:00' },
  thursday:  { enabled: true,  start: '09:00', end: '19:00' },
  friday:    { enabled: true,  start: '09:00', end: '19:00' },
  saturday:  { enabled: true,  start: '09:00', end: '14:00' },
  sunday:    { enabled: false, start: '09:00', end: '13:00' },
}

interface UserFormState {
  user_id?: string
  name: string
  email: string
  password: string
  role: AppRole
  branch_ids: string[]
  permissions: Permission[]
  active: boolean
  is_barber: boolean
  appears_in_agenda: boolean
  availability: WeeklyAvailability
}

// Pre-tick the default permissions shown in the UI for new barbers so admins
// can see what the barber will have (and deselect anything they don't want).
const BARBER_DEFAULT_FORM_PERMISSIONS: Permission[] = [
  'cash.view', 'cash.open', 'cash.close', 'cash.add_movement',
  'view_clients', 'cancel_appointments',
]

const EMPTY_FORM: UserFormState = {
  name:         '',
  email:        '',
  password:     '',
  role:         'barber',
  branch_ids:   [],
  permissions:  BARBER_DEFAULT_FORM_PERMISSIONS,
  active:       true,
  is_barber:    true,
  appears_in_agenda: true,
  availability: DEFAULT_AVAILABILITY,
}

const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'Superadmin',
  admin:      'Admin',
  barber:     'Barbero',
}

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  superadmin: 'Acceso total al sistema',
  admin:      'Administración general',
  barber:     'Agenda y caja propia',
}

export default function UsuariosPage() {
  const { user: me } = useAdmin()
  const [users,    setUsers]    = useState<UserWithRole[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [isCreating, setIsCreating] = useState(true)
  const [form,  setForm]  = useState<UserFormState>(EMPTY_FORM)
  const [error, setError] = useState('')

  useEffect(() => { void loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [usersRes, branchesRes] = await Promise.all([
        fetch('/api/users',          { cache: 'no-store' }),
        fetch('/api/branches?all=1', { cache: 'no-store' }),
      ])
      const [usersData, branchesData] = await Promise.all([usersRes.json(), branchesRes.json()])
      setUsers(usersData.users ?? [])
      setBranches(branchesData.branches ?? [])
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setIsCreating(true); setError(''); setForm(EMPTY_FORM); setModalOpen(true)
  }

  function openEdit(user: UserWithRole) {
    setIsCreating(false); setError('')
    // Filter branch_ids to only real branches known to this admin.
    // Fake or out-of-scope UUIDs (e.g. from stale data) are excluded so they
    // don't silently pass the scope filter on save and trigger a 400 error.
    const realBranchIds = (user.branch_ids ?? []).filter(id => branches.some(b => b.id === id))
    setForm({
      user_id:      user.id,
      name:         user.name ?? '',
      email:        user.email,
      password:     '',
      role:         user.role,
      branch_ids:   realBranchIds,
      permissions:  user.permissions ?? [],
      active:       user.active,
      is_barber:    user.is_barber ?? !!user.barber_id,
      appears_in_agenda: user.appears_in_agenda ?? Boolean(user.barber_id),
      availability: (user.barber as any)?.availability ?? DEFAULT_AVAILABILITY,
    })
    setModalOpen(true)
  }

  function togglePermission(p: Permission) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter(x => x !== p)
        : [...f.permissions, p],
    }))
  }

  function toggleBranch(branchId: string) {
    setForm(f => ({
      ...f,
      branch_ids: f.branch_ids.includes(branchId)
        ? f.branch_ids.filter(id => id !== branchId)
        : [...f.branch_ids, branchId],
    }))
  }

  function updateDay(day: string, field: keyof DaySchedule, value: string | boolean) {
    setForm(f => {
      const avail = f.availability ?? DEFAULT_AVAILABILITY
      return {
        ...f,
        availability: {
          ...avail,
          [day]: { ...avail[day], [field]: value },
        },
      }
    })
  }

  async function saveUser() {
    setSaving(true); setError('')
    const res = await fetch('/api/users', {
      method: isCreating ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo guardar el usuario'); return }
    setModalOpen(false)
    await loadData()
  }

  async function toggleActive(user: UserWithRole) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, active: !user.active }),
    })
    await loadData()
  }

  async function removeUser(user: UserWithRole) {
    if (!confirm(`¿Eliminar el usuario ${user.email}?`)) return
    await fetch(`/api/users?user_id=${user.id}`, { method: 'DELETE' })
    await loadData()
  }

  const showPermissions = form.role === 'barber'
  const roleOptions = (me?.role === 'superadmin'
    ? ['barber', 'admin', 'superadmin']
    : ['barber', 'admin']) as AppRole[]

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Usuarios"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UserSquare2 className="h-6 w-6" />}
          title="Sin usuarios"
          description="Creá el primer usuario para gestionar accesos."
          action={<Button size="sm" onClick={openCreate}>Crear usuario</Button>}
        />
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div
              key={user.id}
              className={cn(
                'rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition',
                !user.active && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-950">
                      {user.name ?? 'Sin nombre'}
                    </p>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                      user.role === 'superadmin' ? 'bg-slate-950 text-white' :
                      user.role === 'admin'      ? 'bg-slate-100 text-slate-700' :
                                                   'bg-slate-50 text-slate-600'
                    )}>
                      {user.role === 'superadmin' && <Shield className="h-3 w-3" />}
                      {ROLE_LABELS[user.role]}
                    </span>
                    {user.barber_id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        <Scissors className="h-3 w-3" />
                        Barbero
                      </span>
                    )}
                    {user.barber_id && user.appears_in_agenda && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CalendarCheck className="h-3 w-3" />
                        En agenda
                      </span>
                    )}
                    {user.barber_id && !user.appears_in_agenda && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                        <EyeOff className="h-3 w-3" />
                        Oculto en agenda
                      </span>
                    )}
                    {!user.active && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                  {(user.branches ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(user.branches ?? []).map(b => (
                        <span key={b.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {b.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {user.id !== me?.id && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(user)}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(user)}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                      title={user.active ? 'Desactivar' : 'Activar'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    {me?.role === 'superadmin' && (
                      <button
                        onClick={() => removeUser(user)}
                        className="rounded-xl border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isCreating ? 'Nuevo usuario' : 'Editar usuario'}
        size="lg"
      >
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nombre y apellido"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="usuario@felito.com"
              disabled={!isCreating}
            />
          </div>

          {isCreating && (
            <Input
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
            />
          )}

          {/* Role */}
          <div>
            <label className="label">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              {roleOptions.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    role,
                    is_barber: role === 'barber' ? true : f.is_barber,
                    appears_in_agenda: role === 'barber' ? true : f.appears_in_agenda,
                    // Reset to role defaults when switching roles on a new user
                    permissions: isCreating
                      ? (role === 'barber' ? BARBER_DEFAULT_FORM_PERMISSIONS : [])
                      : f.permissions,
                  }))}
                  className={cn(
                    'rounded-2xl border px-3 py-3 text-left transition',
                    form.role === role
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <p className="text-sm font-semibold">{ROLE_LABELS[role]}</p>
                  <p className={cn('mt-0.5 text-xs', form.role === role ? 'text-slate-300' : 'text-slate-400')}>
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Branches */}
          <div>
            <label className="label">Sucursales</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map(branch => {
                const sel = form.branch_ids.includes(branch.id)
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition',
                      sel
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className={cn(
                      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                      sel ? 'border-white/30 bg-white/10' : 'border-slate-300'
                    )}>
                      {sel && <Check className="h-2.5 w-2.5" />}
                    </span>
                    {branch.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Es barbero toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_barber}
              onChange={e => setForm(f => ({
                ...f,
                is_barber: e.target.checked,
                appears_in_agenda: e.target.checked ? f.appears_in_agenda : false,
              }))}
              className="accent-slate-950"
            />
            <div>
              <p className="font-semibold">Es barbero</p>
              <p className="text-xs text-slate-400">Puede tener disponibilidad y atender turnos sin perder su rol administrativo.</p>
            </div>
          </label>

          <label className={cn(
            'flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700',
            form.is_barber ? 'cursor-pointer' : 'opacity-60'
          )}>
            <input
              type="checkbox"
              checked={form.is_barber && form.appears_in_agenda}
              disabled={!form.is_barber}
              onChange={e => setForm(f => ({ ...f, appears_in_agenda: e.target.checked }))}
              className="accent-slate-950"
            />
            <div>
              <p className="font-semibold">Aparece en agenda y reservas</p>
              <p className="text-xs text-slate-400">Si está activo y tiene sucursal, los clientes pueden reservarle turnos.</p>
            </div>
          </label>

          {/* Disponibilidad — solo si es barbero */}
          {form.is_barber && (
            <div>
              <label className="label">Disponibilidad semanal</label>
              <div className="space-y-2">
                {Object.entries(form.availability).map(([day, schedule]) => (
                  <div key={day} className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label className="flex items-center gap-3 text-sm font-medium capitalize text-slate-700 sm:w-36">
                        <input
                          type="checkbox"
                          checked={schedule.enabled}
                          onChange={e => updateDay(day, 'enabled', e.target.checked)}
                          className="accent-slate-950"
                        />
                        {DAY_NAMES[day]}
                      </label>
                      <div className="grid flex-1 grid-cols-2 gap-2">
                        <input
                          type="time"
                          value={schedule.start}
                          onChange={e => updateDay(day, 'start', e.target.value)}
                          className="input"
                          disabled={!schedule.enabled}
                        />
                        <input
                          type="time"
                          value={schedule.end}
                          onChange={e => updateDay(day, 'end', e.target.value)}
                          className="input"
                          disabled={!schedule.enabled}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permisos — solo para barbero */}
          {showPermissions && (
            <div>
              <label className="label">Permisos adicionales</label>
              <div className="space-y-3">
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {group.label}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {group.permissions.map(permission => {
                        const sel = form.permissions.includes(permission)
                        return (
                          <button
                            key={permission}
                            type="button"
                            onClick={() => togglePermission(permission)}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition',
                              sel
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            <span className={cn(
                              'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                              sel ? 'border-white/30 bg-white/10' : 'border-slate-300'
                            )}>
                              {sel && <Check className="h-2.5 w-2.5" />}
                            </span>
                            {PERMISSION_LABELS[permission]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showPermissions && (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Shield className="mb-1 h-4 w-4 text-slate-400 inline mr-2" />
              {form.role === 'superadmin' ? 'Superadmin tiene acceso total.' : 'Admin tiene todos los permisos operativos.'}
            </div>
          )}

          {!isCreating && (
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="accent-slate-950"
              />
              Usuario activo
            </label>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={saveUser} loading={saving}>
              {isCreating ? 'Crear usuario' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
