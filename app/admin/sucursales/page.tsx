'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, MapPin, Pencil, Phone, Plus } from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { useAdmin } from '../layout'
import type { Branch } from '@/types'

const EMPTY_BRANCH: Partial<Branch> = {
  name:    '',
  address: '',
  phone:   '',
  active:  true,
}

export default function SucursalesPage() {
  const { user: me } = useAdmin()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Partial<Branch>>(EMPTY_BRANCH)

  const isSuperadmin = me?.role === 'superadmin'
  // Admins can edit branches but cannot create or delete them
  const canEdit = isSuperadmin || me?.role === 'admin'

  useEffect(() => { void loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res  = await fetch('/api/branches?all=1', { cache: 'no-store' })
      const data = await res.json()
      setBranches(data.branches ?? [])
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(EMPTY_BRANCH); setError(''); setModalOpen(true)
  }

  function openEdit(branch: Branch) {
    setEditing(branch); setError(''); setModalOpen(true)
  }

  async function saveBranch() {
    if (!editing.name?.trim()) return
    setSaving(true); setError('')
    const res = await fetch(editing.id ? `/api/branches/${editing.id}` : '/api/branches', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
    setModalOpen(false)
    await loadData()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Sucursales"
        action={
          isSuperadmin ? (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nueva sucursal
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : branches.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Sin sucursales"
          description="Creá la primera sucursal para habilitar reservas."
          action={isSuperadmin ? <Button size="sm" onClick={openNew}>Crear sucursal</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map(branch => (
            <div key={branch.id} className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-950">{branch.name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      branch.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {branch.active ? 'Activa' : 'Oculta'}
                    </span>
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={() => openEdit(branch)}
                    className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                    title="Editar sucursal"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {branch.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    {branch.address}
                  </p>
                )}
                {branch.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    {branch.phone}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing.id ? 'Editar sucursal' : 'Nueva sucursal'}
        // Only superadmin should ever reach the "new" branch modal
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={editing.name ?? ''}
            onChange={e => setEditing(d => ({ ...d, name: e.target.value }))}
            placeholder="Cordón"
          />
          <Input
            label="Dirección"
            value={editing.address ?? ''}
            onChange={e => setEditing(d => ({ ...d, address: e.target.value }))}
            placeholder="Av. 18 de Julio 1234"
          />
          <Input
            label="Teléfono"
            value={editing.phone ?? ''}
            onChange={e => setEditing(d => ({ ...d, phone: e.target.value }))}
            placeholder="096 000 000"
          />

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={editing.active ?? true}
              onChange={e => setEditing(d => ({ ...d, active: e.target.checked }))}
              className="accent-slate-950"
            />
            Visible en reserva pública
          </label>

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={saveBranch} loading={saving}>
              {editing.id ? 'Guardar cambios' : 'Crear sucursal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
