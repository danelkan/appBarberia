'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Scissors, Clock, DollarSign } from 'lucide-react'
import { Button, Input, Spinner, EmptyState, Modal, PageHeader } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import type { Service } from '@/types'

const EMPTY: Partial<Service> = { name: '', price: 0, duration_minutes: 30, active: true }

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]   = useState<Partial<Service>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchServices = async () => {
    try {
      const res  = await fetch('/api/services')
      const data = await res.json()
      setServices(data.services ?? [])
    } catch {
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchServices() }, [])

  const openNew  = () => { setEditing(EMPTY); setModalOpen(true) }
  const openEdit = (s: Service) => { setEditing(s); setModalOpen(true) }

  const save = async () => {
    if (!editing.name || !editing.price || !editing.duration_minutes) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const url    = editing.id ? `/api/services/${editing.id}` : '/api/services'
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

      <PageHeader
        title="Servicios"
        subtitle={`${services.length} activo${services.length !== 1 ? 's' : ''}`}
        action={
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4" /> Nuevo servicio
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={<Scissors className="w-6 h-6" />}
          title="Sin servicios"
          description="Agregá los servicios que ofrecés"
          action={<Button size="sm" onClick={openNew}><Plus className="w-4 h-4" /> Nuevo servicio</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(s => (
            <div key={s.id} className="card p-5 hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-cream text-sm leading-tight">{s.name}</h3>
                  {!s.active && (
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-cream/40 border border-border font-medium">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/35 hover:text-cream transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    disabled={deleting === s.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-cream/35 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <DollarSign className="w-3 h-3 text-gold" />
                  </div>
                  <span className="text-sm font-bold text-cream">{formatPrice(s.price)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-surface-2 border border-border flex items-center justify-center">
                    <Clock className="w-3 h-3 text-cream/50" />
                  </div>
                  <span className="text-sm text-cream/55 font-medium">{s.duration_minutes} min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing.id ? 'Editar servicio' : 'Nuevo servicio'}
      >
        <div className="space-y-4">
          <Input
            label="Nombre del servicio *"
            value={editing.name ?? ''}
            onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
            placeholder="Ej: Corte + barba"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Precio (UYU) *"
              type="number"
              min="0"
              step="1"
              value={editing.price ?? ''}
              onChange={e => setEditing(p => ({ ...p, price: parseFloat(e.target.value) }))}
              placeholder="500"
            />
            <Input
              label="Duración (min) *"
              type="number"
              min="5"
              step="5"
              value={editing.duration_minutes ?? ''}
              onChange={e => setEditing(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))}
              placeholder="30"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={saving}
              onClick={save}
              disabled={!editing.name || !editing.price}
            >
              {editing.id ? 'Guardar cambios' : 'Crear servicio'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
