'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  Check,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
  UserSquare2,
} from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAdmin } from '../layout'
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type AppRole,
  type Branch,
  type Permission,
  type UserWithRole,
} from '@/types'

interface UserFormState {
  user_id?: string
  name: string
  email: string
  password: string
  role: AppRole
  branch_ids: string[]
  permissions: Permission[]
  active: boolean
}

const EMPTY_FORM: UserFormState = {
  name:        '',
  email:       '',
  password:    '',
  role:        'barber',
  branch_ids:  [],
  permissions: [],
  active:      true,
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
  const [users,   setUsers]   = useState<UserWithRole[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [isCreating,  setIsCreating]  = useState(true)
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
    setForm({
      user_id:     user.id,
      name:        user.name ?? '',
      email:       user.email,
      password:    '',
      role:        user.role,
      branch_ids:  user.branch_ids ?? [],
      permissions: user.permissions ?? [],
      active:      user.active,
    })
    setModalOpen(true)
  }

  function togglePermission(permission: Permission) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(permission)
        ? f.permissions.filter(p => p !== permission)
        : [...f.permissions, permission],
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

  // Permissions are only meaningful for 'barber' role; admins/superadmins have all
  const showPermissions = form.role === 'barber'

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
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-950">
                      {user.name ?? 'Sin nombre'}
                    </p>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                      user.role === 'superadmin' ? 'bg-slate-950 text-white' :
                      user.role === 'admin'       ? 'bg-slate-100 text-slate-700' :
                                                    'bg-slate-50 text-slate-600'
                    )}>
                      {user.role === 'superadmin' && <Shield className="h-3 w-3" />}
                      {ROLE_LABELS[user.role]}
                    </span>
                    {!user.active && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                        Inactivo
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <p className="mt-1 text-sm text-slate-500">{user.email}</p>

                  {/* Branches */}
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

                {/* Actions */}
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

          {/* Role selection */}
          <div>
            <label className="label">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              {(['barber', 'admin', 'superadmin'] as AppRole[]).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role }))}
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

          {/* Granular permissions — only for barbers */}
          {showPermissions && (
            <div>
              <label className="label">Permisos adicionales</label>
              <p className="mb-3 text-xs text-slate-500">
                Admins y superadmins tienen todos los permisos automáticamente.
              </p>
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
