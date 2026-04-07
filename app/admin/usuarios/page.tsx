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
  type Company,
  type Permission,
  type UserWithRole,
} from '@/types'

interface UserFormState {
  user_id?: string
  name: string
  email: string
  password: string
  role: AppRole
  company_id: string
  branch_ids: string[]
  permissions: Permission[]
  active: boolean
}

const EMPTY_FORM: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'barber',
  company_id: '',
  branch_ids: [],
  permissions: [],
  active: true,
}

const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  barber: 'Barbero',
}

export default function UsuariosPage() {
  const { user: me } = useAdmin()
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(true)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [usersRes, companiesRes, branchesRes] = await Promise.all([
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/companies', { cache: 'no-store' }),
        fetch('/api/branches?all=1', { cache: 'no-store' }),
      ])

      const [usersData, companiesData, branchesData] = await Promise.all([
        usersRes.json(),
        companiesRes.json(),
        branchesRes.json(),
      ])

      setUsers(usersData.users ?? [])
      setCompanies(companiesData.companies ?? [])
      setBranches(branchesData.branches ?? [])
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setIsCreating(true)
    setError('')
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(user: UserWithRole) {
    setIsCreating(false)
    setError('')
    setForm({
      user_id: user.id,
      name: user.name ?? '',
      email: user.email,
      password: '',
      role: user.role,
      company_id: user.company_id ?? '',
      branch_ids: user.branch_ids ?? [],
      permissions: user.permissions ?? [],
      active: user.active,
    })
    setModalOpen(true)
  }

  function togglePermission(permission: Permission) {
    setForm(current => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter(item => item !== permission)
        : [...current.permissions, permission],
    }))
  }

  function toggleBranch(branchId: string) {
    setForm(current => ({
      ...current,
      branch_ids: current.branch_ids.includes(branchId)
        ? current.branch_ids.filter(item => item !== branchId)
        : [...current.branch_ids, branchId],
    }))
  }

  async function saveUser() {
    setSaving(true)
    setError('')

    const response = await fetch('/api/users', {
      method: isCreating ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isCreating ? form : { ...form, user_id: form.user_id }),
    })

    const data = await response.json()
    setSaving(false)

    if (!response.ok) {
      setError(data.error ?? 'No se pudo guardar el usuario')
      return
    }

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

  const filteredBranches = form.company_id
    ? branches.filter(branch => branch.company_id === form.company_id)
    : branches

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Usuarios y permisos"
        subtitle="Gestioná acceso operativo real por rol, empresa, sucursales y permisos granulares."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UserSquare2 className="h-6 w-6" />}
          title="Todavía no hay usuarios"
          description="Creá el primer usuario operativo para empezar a usar el backoffice con roles y permisos."
          action={<Button onClick={openCreate}>Crear usuario</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_0.8fr_1fr_1fr_0.8fr] gap-4 border-b border-slate-200 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <p>Usuario</p>
            <p>Rol</p>
            <p>Empresa</p>
            <p>Sucursales</p>
            <p className="text-right">Acciones</p>
          </div>

          <div className="divide-y divide-slate-200">
            {users.map(user => (
              <div key={user.id} className={cn('grid grid-cols-[1.4fr_0.8fr_1fr_1fr_0.8fr] gap-4 px-6 py-5', !user.active && 'bg-slate-50')}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{user.name ?? 'Sin nombre'}</p>
                  <p className="truncate text-sm text-slate-500">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {user.permissions.slice(0, 3).map(permission => (
                      <span key={permission} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {PERMISSION_LABELS[permission]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {user.role === 'superadmin' && <Shield className="mr-1 inline h-3 w-3" />}
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>

                <div className="text-sm text-slate-600">
                  {user.company?.name ?? 'Sin empresa'}
                </div>

                <div className="text-sm text-slate-600">
                  {(user.branches ?? []).length > 0
                    ? (user.branches ?? []).map(branch => branch.name).join(', ')
                    : 'Sin sucursales'}
                </div>

                <div className="flex items-start justify-end gap-2">
                  {user.id !== me?.id && (
                    <>
                      <button
                        onClick={() => openEdit(user)}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(user)}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      {me?.role === 'superadmin' && (
                        <button
                          onClick={() => removeUser(user)}
                          className="rounded-xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isCreating ? 'Nuevo usuario' : 'Editar usuario'}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={form.name}
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
              placeholder="Nombre y apellido"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
              placeholder="usuario@felito.com"
              disabled={!isCreating}
            />
          </div>

          {isCreating && (
            <Input
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              placeholder="Mínimo 6 caracteres"
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Rol</label>
              <div className="grid grid-cols-3 gap-2">
                {(['barber', 'admin', 'superadmin'] as AppRole[]).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm(current => ({ ...current, role }))}
                    className={cn(
                      'rounded-2xl border px-3 py-3 text-sm font-semibold transition',
                      form.role === role
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Empresa</label>
              <select
                value={form.company_id}
                onChange={event => setForm(current => ({ ...current, company_id: event.target.value, branch_ids: [] }))}
                className="input"
              >
                <option value="">Sin empresa</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Sucursales</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredBranches.map(branch => {
                const selected = form.branch_ids.includes(branch.id)
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                      selected
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md border',
                      selected ? 'border-white/30 bg-white/10' : 'border-slate-300 bg-slate-50'
                    )}>
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    {branch.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Permisos</label>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">{group.label}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {group.permissions.map(permission => {
                      const selected = form.permissions.includes(permission)
                      return (
                        <button
                          key={permission}
                          type="button"
                          onClick={() => togglePermission(permission)}
                          className={cn(
                            'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition',
                            selected
                              ? 'border-slate-950 bg-slate-950 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          <span className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-md border',
                            selected ? 'border-white/30 bg-white/10' : 'border-slate-300 bg-slate-50'
                          )}>
                            {selected && <Check className="h-3 w-3" />}
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

          {!isCreating && (
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={event => setForm(current => ({ ...current, active: event.target.checked }))}
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

          <div className="flex gap-3">
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
