'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, Globe, Mail, MapPin, Phone, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAdmin } from '../layout'
import { useRouter } from 'next/navigation'
import type { Company } from '@/types'

const EMPTY: Partial<Company> = { name: '', email: '', phone: '', address: '', active: true }

export default function EmpresasPage() {
  const { user } = useAdmin()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading]    = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]    = useState<Partial<Company>>(EMPTY)
  const [saving, setSaving]      = useState(false)
  const [error, setError]        = useState('')

  // Only superadmins and admins can access
  useEffect(() => {
    if (user && user.role === 'barber') router.push('/admin/agenda')
  }, [user, router])

  async function fetchCompanies() {
    try {
      const res  = await fetch('/api/companies?branches=1')
      const data = await res.json()
      setCompanies(data.companies ?? [])
    } catch {
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompanies() }, [])

  function openNew() {
    setEditing(EMPTY)
    setError('')
    setModalOpen(true)
  }

  function openEdit(company: Company) {
    setEditing({ ...company })
    setError('')
    setModalOpen(true)
  }

  async function save() {
    if (!editing.name?.trim()) return
    setSaving(true)
    setError('')
    const isEdit = Boolean(editing.id)
    const url    = isEdit ? `/api/companies/${editing.id}` : '/api/companies'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
    setModalOpen(false)
    fetchCompanies()
  }

  async function toggleActive(company: Company) {
    await fetch(`/api/companies/${company.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...company, active: !company.active }),
    })
    fetchCompanies()
  }

  async function remove(company: Company) {
    if (!confirm(`¿Eliminar "${company.name}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/companies/${company.id}`, { method: 'DELETE' })
    fetchCompanies()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Empresas"
        subtitle="Gestioná las empresas y su estructura de sucursales"
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4" /> Nueva empresa
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No hay empresas"
          description="Creá la primera empresa para estructurar tus sucursales."
          action={<Button size="sm" onClick={openNew}><Plus className="w-4 h-4" /> Nueva empresa</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {companies.map(company => (
            <div key={company.id} className={cn('card p-5 shadow-card hover:shadow-card-hover transition-all', !company.active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-gold" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-cream text-base">{company.name}</h3>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full border font-semibold',
                        company.active
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-slate-500 bg-slate-100 border-slate-200'
                      )}>
                        {company.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    {company.slug && (
                      <p className="text-xs text-cream/35 font-mono mt-0.5">{company.slug}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(company)}
                    className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/35 hover:text-cream transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(company)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      company.active
                        ? 'text-cream/35 hover:bg-amber-50 hover:text-amber-600'
                        : 'text-cream/35 hover:bg-emerald-50 hover:text-emerald-600'
                    )}
                    title={company.active ? 'Desactivar' : 'Activar'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  {user?.role === 'superadmin' && (
                    <button
                      onClick={() => remove(company)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-cream/35 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {company.email && (
                  <p className="flex items-center gap-2 text-cream/50">
                    <Mail className="w-3.5 h-3.5 text-cream/30 flex-shrink-0" />
                    {company.email}
                  </p>
                )}
                {company.phone && (
                  <p className="flex items-center gap-2 text-cream/50">
                    <Phone className="w-3.5 h-3.5 text-cream/30 flex-shrink-0" />
                    {company.phone}
                  </p>
                )}
                {company.address && (
                  <p className="flex items-center gap-2 text-cream/50">
                    <MapPin className="w-3.5 h-3.5 text-cream/30 flex-shrink-0" />
                    {company.address}
                  </p>
                )}
              </div>

              {/* Branches */}
              {(company.branches ?? []).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] uppercase tracking-widest text-cream/30 font-semibold mb-2">Sucursales</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(company.branches ?? []).map(branch => (
                      <span
                        key={branch.id}
                        className={cn(
                          'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium',
                          branch.active
                            ? 'bg-surface-2 text-cream/60 border-border'
                            : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                        )}
                      >
                        <Globe className="w-3 h-3" />
                        {branch.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing.id ? 'Editar empresa' : 'Nueva empresa'}
      >
        <div className="space-y-4">
          <Input
            label="Nombre *"
            value={editing.name ?? ''}
            onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
            placeholder="Felito Studios"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              value={editing.email ?? ''}
              onChange={e => setEditing(p => ({ ...p, email: e.target.value }))}
              placeholder="contacto@empresa.com"
            />
            <Input
              label="Teléfono"
              value={editing.phone ?? ''}
              onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))}
              placeholder="096 000 000"
            />
          </div>
          <Input
            label="Dirección"
            value={editing.address ?? ''}
            onChange={e => setEditing(p => ({ ...p, address: e.target.value }))}
            placeholder="Calle 123, Ciudad"
          />
          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-3 text-sm text-cream/70 cursor-pointer hover:bg-surface-3 transition-colors">
            <input
              type="checkbox"
              checked={editing.active ?? true}
              onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))}
              className="accent-gold"
            />
            Empresa activa
          </label>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 font-medium">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={saving}
              onClick={save}
              disabled={!editing.name?.trim() || saving}
            >
              {editing.id ? 'Guardar cambios' : 'Crear empresa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
