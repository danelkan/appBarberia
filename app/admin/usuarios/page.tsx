'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import {
  Shield, UserCog, Pencil, Trash2, Plus, Power,
  KeyRound, Check,
} from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAdmin } from '../layout'
import { useRouter } from 'next/navigation'
import {
  PERMISSION_LABELS, PERMISSION_GROUPS,
  type UserWithRole, type AppRole, type Permission,
} from '@/types'

const ROLE_COLORS: Record<AppRole, string> = {
  superadmin: 'text-amber-700 bg-amber-50 border-amber-200',
  admin:      'text-blue-700 bg-blue-50 border-blue-200',
  barber:     'text-slate-600 bg-slate-100 border-slate-200',
}
const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'Superadmin',
  admin:      'Admin',
  barber:     'Barbero',
}

interface EditState {
  user_id: string
  role: AppRole
  permissions: Permission[]
  active: boolean
}

export default function UsuariosPage() {
  const { user: me } = useAdmin()
  const router = useRouter()
  const [users, setUsers]     = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving]   = useState(false)
  const [newModal, setNewModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPass, setNewPass]   = useState('')
  const [newRole, setNewRole]   = useState<AppRole>('barber')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  // Only superadmin can access this page
  useEffect(() => {
    if (me && me.role !== 'superadmin') router.push('/admin/agenda')
  }, [me, router])

  const fetchUsers = useCallback(async () => {
    try {
      const res  = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function openEdit(u: UserWithRole) {
    setEditing({ user_id: u.id, role: u.role, permissions: u.permissions ?? [], active: u.active })
    setFormError('')
    setEditModal(true)
  }

  function togglePerm(perm: Permission) {
    if (!editing) return
    setEditing(e => {
      if (!e) return e
      const has = e.permissions.includes(perm)
      return { ...e, permissions: has ? e.permissions.filter(p => p !== perm) : [...e.permissions, perm] }
    })
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(data.error ?? 'Error al guardar'); return }
    setEditModal(false)
    fetchUsers()
  }

  async function toggleActive(u: UserWithRole) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: u.id, active: !u.active }),
    })
    fetchUsers()
  }

  async function deleteUser(u: UserWithRole) {
    if (!confirm(`¿Eliminar el usuario ${u.email}? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/users?user_id=${u.id}`, { method: 'DELETE' })
    fetchUsers()
  }

  async function createUser() {
    if (!newEmail.trim() || !newPass.trim()) { setFormError('Email y contraseña son requeridos'); return }
    setCreating(true)
    setFormError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim(), password: newPass, role: newRole, permissions: [] }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Error al crear'); return }
    setNewModal(false)
    setNewEmail(''); setNewPass(''); setNewRole('barber')
    fetchUsers()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Usuarios"
        subtitle="Gestioná accesos, roles y permisos del sistema"
        action={
          me?.role === 'superadmin' ? (
            <Button size="sm" onClick={() => { setFormError(''); setNewModal(true) }}>
              <Plus className="w-4 h-4" /> Nuevo usuario
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UserCog className="w-6 h-6" />}
          title="Sin usuarios"
          description="No hay usuarios registrados en el sistema."
        />
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const isMe = u.id === me?.id
            return (
              <div key={u.id} className={cn('card p-4 shadow-card hover:shadow-card-hover transition-all', !u.active && 'opacity-50')}>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">
                    {u.email[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-cream">{u.email}</p>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold-dark border border-gold/20 font-semibold">Vos</span>
                      )}
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold', ROLE_COLORS[u.role])}>
                        {u.role === 'superadmin' && <Shield className="w-2.5 h-2.5 inline mr-0.5" />}
                        {ROLE_LABELS[u.role]}
                      </span>
                      {!u.active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-semibold">Inactivo</span>
                      )}
                    </div>
                    {u.barber && (
                      <p className="text-xs text-cream/45 mt-0.5 font-medium">Barbero: {u.barber.name}</p>
                    )}
                    {u.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {u.permissions.slice(0, 4).map(p => (
                          <span key={p} className="text-[10px] px-1.5 py-0.5 bg-surface-2 text-cream/40 rounded border border-border font-medium">
                            {PERMISSION_LABELS[p]}
                          </span>
                        ))}
                        {u.permissions.length > 4 && (
                          <span className="text-[10px] text-cream/35 font-medium">+{u.permissions.length - 4} más</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isMe && me?.role === 'superadmin' && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/35 hover:text-cream transition-colors"
                        title="Editar permisos"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          u.active
                            ? 'text-cream/35 hover:bg-amber-50 hover:text-amber-600'
                            : 'text-cream/35 hover:bg-emerald-50 hover:text-emerald-600'
                        )}
                        title={u.active ? 'Desactivar' : 'Activar'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-cream/35 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Edit permissions modal ──────────────────── */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar acceso" size="lg">
        {editing && (
          <div className="space-y-5">
            {/* Role */}
            <div>
              <label className="label">Rol</label>
              <div className="grid grid-cols-3 gap-2">
                {(['barber', 'admin', 'superadmin'] as AppRole[]).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setEditing(e => e ? { ...e, role } : e)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
                      editing.role === role
                        ? 'border-gold/30 bg-gold/10 text-gold-dark'
                        : 'border-border bg-surface-2 text-cream/55 hover:bg-surface-3'
                    )}
                  >
                    {role === 'superadmin' && <Shield className="w-3.5 h-3.5 inline mr-1.5" />}
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="label">Permisos adicionales</label>
              <p className="text-xs text-cream/40 mb-3">Los admins y superadmins ya tienen permisos completos por defecto.</p>
              <div className="space-y-3">
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] uppercase tracking-wider text-cream/30 font-semibold mb-1.5">{group.label}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.permissions.map(perm => {
                        const has = editing.permissions.includes(perm)
                        return (
                          <button
                            key={perm}
                            type="button"
                            onClick={() => togglePerm(perm)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all',
                              has
                                ? 'border-gold/30 bg-gold/8 text-gold-dark'
                                : 'border-border bg-surface-2 text-cream/55 hover:bg-surface-3'
                            )}
                          >
                            <div className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all',
                              has ? 'bg-gold border-gold' : 'border-border'
                            )}>
                              {has && <Check className="w-2.5 h-2.5 text-black" />}
                            </div>
                            {PERMISSION_LABELS[perm]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-3 text-sm text-cream/70 cursor-pointer hover:bg-surface-3 transition-colors">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={e => setEditing(ed => ed ? { ...ed, active: e.target.checked } : ed)}
                className="accent-gold"
              />
              Usuario activo
            </label>

            {formError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 font-medium">{formError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditModal(false)}>Cancelar</Button>
              <Button className="flex-1" loading={saving} onClick={saveEdit}>Guardar cambios</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── New user modal ────────────────────────────── */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title="Nuevo usuario">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-cream/55">
            <div className="flex items-start gap-2">
              <KeyRound className="w-4 h-4 mt-0.5 text-gold flex-shrink-0" />
              <p>Para crear un barbero con acceso completo, usá la sección <strong className="text-cream">Barberos</strong>. Acá podés crear usuarios standalone sin barbero asociado.</p>
            </div>
          </div>

          <Input
            label="Email *"
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="usuario@ejemplo.com"
          />
          <Input
            label="Contraseña *"
            type="password"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />

          <div>
            <label className="label">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              {(['barber', 'admin', 'superadmin'] as AppRole[]).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setNewRole(role)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
                    newRole === role
                      ? 'border-gold/30 bg-gold/10 text-gold-dark'
                      : 'border-border bg-surface-2 text-cream/55 hover:bg-surface-3'
                  )}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 font-medium">{formError}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setNewModal(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              loading={creating}
              onClick={createUser}
              disabled={!newEmail.trim() || !newPass.trim()}
            >
              Crear usuario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
