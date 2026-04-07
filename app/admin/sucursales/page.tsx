'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, MapPin, Pencil, Phone, Plus } from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import type { Branch, Company } from '@/types'

const EMPTY_BRANCH: Partial<Branch> = {
  name: '',
  address: '',
  phone: '',
  active: true,
  company_id: '',
}

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Branch>>(EMPTY_BRANCH)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [branchesRes, companiesRes] = await Promise.all([
        fetch('/api/branches?all=1', { cache: 'no-store' }),
        fetch('/api/companies', { cache: 'no-store' }),
      ])
      const [branchesData, companiesData] = await Promise.all([branchesRes.json(), companiesRes.json()])
      setBranches(branchesData.branches ?? [])
      setCompanies(companiesData.companies ?? [])
    } finally {
      setLoading(false)
    }
  }

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
    const response = await fetch(editing.id ? `/api/branches/${editing.id}` : '/api/branches', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)

    if (!response.ok) return

    setModalOpen(false)
    await loadData()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Sucursales"
        subtitle="Definí qué sedes están activas, a qué empresa pertenecen y cómo se muestran en la reserva pública."
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
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
          icon={<Building2 className="h-6 w-6" />}
          title="No hay sucursales cargadas"
          description="Creá la primera sucursal para habilitar reservas y organización interna."
          action={<Button onClick={openNew}>Crear sucursal</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {branches.map(branch => (
            <div key={branch.id} className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-950">{branch.name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${branch.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {branch.active ? 'Activa' : 'Oculta'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{branch.company?.name ?? 'Sin empresa'}</p>
                </div>

                <button
                  onClick={() => openEdit(branch)}
                  className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-600">
                {branch.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {branch.address}
                  </p>
                )}
                {branch.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {branch.phone}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar sucursal' : 'Nueva sucursal'}>
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={editing.name ?? ''}
            onChange={event => setEditing(current => ({ ...current, name: event.target.value }))}
            placeholder="Cordón"
          />

          <div>
            <label className="label">Empresa</label>
            <select
              value={editing.company_id ?? ''}
              onChange={event => setEditing(current => ({ ...current, company_id: event.target.value }))}
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

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editing.active ?? true}
              onChange={event => setEditing(current => ({ ...current, active: event.target.checked }))}
              className="accent-slate-950"
            />
            Mostrar esta sucursal en la reserva pública
          </label>

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
