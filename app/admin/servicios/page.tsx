'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Scissors, Clock, DollarSign } from 'lucide-react'
import { Button, Input, Spinner, EmptyState, Modal } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import type { Service } from '@/types'

const EMPTY: Partial<Service> = { name: '', price: 0, duration_minutes: 30, active: true }

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Service>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchServices = async () => {
    const res = await fetch('/api/services')
    const data = await res.json()
    setServices(data.services ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchServices() }, [])

  const openNew = () => { setEditing(EMPTY); setModalOpen(true) }
  const openEdit = (s: Service) => { setEditing(s); setModalOpen(true) }

  const save = async () => {
    if (!editing.name || !editing.price || !editing.duration_minutes) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const url = editing.id ? `/api/services/${editing.id}` : '/api/services'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    setModalOpen(false)
    fetchServices()
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este servicio?')) return
    setDeleting(id)
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    setDeleting(null)
    fetchServices()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Servicios</h1>
          <p className="text-sm text-cream/40 mt-0.5">{services.length} activos</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4" /> Nuevo servicio
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : services.length === 0 ? (
        <EmptyState icon={<Scissors className="w-6 h-6" />} title="Sin servicios" description="Agregá los servicios que ofrecés" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(s => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-cream">{s.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/30 hover:text-cream transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(s.id)} disabled={deleting === s.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-cream/30 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-gold">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="text-sm font-medium">{formatPrice(s.price)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-cream/40">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-sm">{s.duration_minutes} min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing.id ? 'Editar servicio' : 'Nuevo servicio'}>
        <div className="space-y-4">
          <Input label="Nombre del servicio *" value={editing.name ?? ''}
            onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
            placeholder="Ej: Corte + barba" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio (USD) *" type="number" min="0" step="0.5"
              value={editing.price ?? ''}
              onChange={e => setEditing(p => ({ ...p, price: parseFloat(e.target.value) }))}
              placeholder="15" />
            <Input label="Duración (min) *" type="number" min="5" step="5"
              value={editing.duration_minutes ?? ''}
              onChange={e => setEditing(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))}
              placeholder="30" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" loading={saving} onClick={save}>
              {editing.id ? 'Guardar cambios' : 'Crear servicio'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
