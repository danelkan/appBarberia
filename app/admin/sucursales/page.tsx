'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, MapPin, Phone, Plus, Pencil } from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import type { Branch } from '@/types'

const EMPTY_BRANCH = {
  name: '',
  address: '',
  phone: '',
  active: true,
}

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Branch>>(EMPTY_BRANCH)

  async function fetchBranches() {
    try {
      const res = await fetch('/api/branches?all=1')
      const data = await res.json()
      setBranches(data.branches ?? [])
    } catch {
      setBranches([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [])

  function openNew() {
    setEditing(EMPTY_BRANCH)
    setModalOpen(true)
  }

  function openEdit(branch: Branch) {
    setEditing(branch)
    setModalOpen(true)
  }

  async function saveBranch() {
    if (!editing.name?.trim()) return

    setSaving(true)

    const isEditing = Boolean(editing.id)
    const res = await fetch(isEditing ? `/api/branches/${editing.id}` : '/api/branches', {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })

    setSaving(false)

    if (!res.ok) return

    setModalOpen(false)
    fetchBranches()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Sucursales"
        subtitle="Gestioná qué sedes están visibles y disponibles para reservas"
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4" />
            Nueva sucursal
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : branches.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No hay sucursales"
          description="Creá la primera sede para empezar a recibir reservas."
          action={
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />
              Nueva sucursal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map(branch => (
            <div key={branch.id} className="card p-5 hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-cream">{branch.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${branch.active ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                      {branch.active ? 'Activa' : 'Oculta'}
                    </span>
                  </div>
                  {branch.address && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-cream/50">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      {branch.address}
                    </p>
                  )}
                  {branch.phone && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-cream/50">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      {branch.phone}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => openEdit(branch)}
                  className="p-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-cream/45 hover:text-cream transition-colors"
                  title="Editar sucursal"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing.id ? 'Editar sucursal' : 'Nueva sucursal'}
      >
        <div className="space-y-4">
          <Input
            label="Nombre *"
            value={editing.name ?? ''}
            onChange={event => setEditing(current => ({ ...current, name: event.target.value }))}
            placeholder="Punta Carretas"
          />

          <Input
            label="Dirección"
            value={editing.address ?? ''}
            onChange={event => setEditing(current => ({ ...current, address: event.target.value }))}
            placeholder="Dirección de la sucursal"
          />

          <Input
            label="Teléfono"
            value={editing.phone ?? ''}
            onChange={event => setEditing(current => ({ ...current, phone: event.target.value }))}
            placeholder="096 000 000"
          />

          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-3 text-sm text-cream/70">
            <input
              type="checkbox"
              checked={editing.active ?? true}
              onChange={event => setEditing(current => ({ ...current, active: event.target.checked }))}
              className="accent-gold"
            />
            Mostrar esta sucursal en la reserva pública
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={saveBranch} loading={saving} disabled={!editing.name?.trim()}>
              {editing.id ? 'Guardar cambios' : 'Crear sucursal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
