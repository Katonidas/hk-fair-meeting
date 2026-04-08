import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import type { UserName, Supplier, MeetingLocation } from '@/types'

function getLocalDatetime() {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  currentUser: UserName
}

export default function NewMeeting({ currentUser }: Props) {
  const [mode, setMode] = useState<'select' | 'new'>('select')
  const [search, setSearch] = useState('')
  const [meetingDatetime, setMeetingDatetime] = useState(getLocalDatetime())
  const [meetingLocation, setMeetingLocation] = useState<MeetingLocation>('feria')
  const navigate = useNavigate()

  const suppliers = useLiveQuery(async () => {
    const all = await db.suppliers.toArray()
    if (!search) return all.sort((a, b) => a.name.localeCompare(b.name))
    const q = search.toLowerCase()
    return all
      .filter(s => s.name.toLowerCase().includes(q) || s.stand.toLowerCase().includes(q) || s.product_type.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [search])

  async function createMeetingForSupplier(supplierId: string) {
    const meetingId = uuid()
    const now = new Date().toISOString()
    const visitedAt = new Date(meetingDatetime).toISOString()
    await db.meetings.add({
      id: meetingId,
      supplier_id: supplierId,
      user_name: currentUser,
      location: meetingLocation,
      status: 'draft',
      visited_at: visitedAt,
      urgent_notes: '',
      other_notes: '',
      business_card_photo_url: '',
      email_generated: false,
      email_sent_at: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
    navigate(`/meeting/${meetingId}`)
  }

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  async function handleConfirmSupplier() {
    if (selectedSupplier) await createMeetingForSupplier(selectedSupplier.id)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800">Nueva Reunión</h1>
        </div>
      </header>

      {/* Date/Time & Location */}
      <div className="flex gap-3 px-4 pt-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Fecha y hora</label>
          <input
            type="datetime-local"
            value={meetingDatetime}
            onChange={e => setMeetingDatetime(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-gray-500">Lugar</label>
          <select
            value={meetingLocation}
            onChange={e => setMeetingLocation(e.target.value as MeetingLocation)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="feria">Feria</option>
            <option value="hotel">Hotel</option>
          </select>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-2 px-4 pt-4">
        <button
          onClick={() => setMode('select')}
          className={`flex-1 rounded-lg py-3 text-sm font-medium transition-colors ${
            mode === 'select' ? 'bg-primary text-white' : 'bg-white text-gray-500'
          }`}
        >
          De la lista
        </button>
        <button
          onClick={() => setMode('new')}
          className={`flex-1 rounded-lg py-3 text-sm font-medium transition-colors ${
            mode === 'new' ? 'bg-primary text-white' : 'bg-white text-gray-500'
          }`}
        >
          Nuevo proveedor
        </button>
      </div>

      {mode === 'select' ? (
        <div className="flex-1 px-4 py-3">
          <input
            type="text"
            placeholder="Buscar por nombre, stand o producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none"
            autoFocus
          />
          {selectedSupplier ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-800">{selectedSupplier.name}</p>
                    <p className="text-xs text-gray-400">Stand {selectedSupplier.stand} · {selectedSupplier.product_type || '—'}</p>
                  </div>
                  <button onClick={() => setSelectedSupplier(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 text-xs">Cambiar</button>
                </div>
              </div>

              {selectedSupplier.pending_topics && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-700">Temas pendientes — no olvidar durante la reunión</p>
                  <p className="mt-1 text-sm text-amber-900 whitespace-pre-wrap">{selectedSupplier.pending_topics}</p>
                </div>
              )}

              {selectedSupplier.supplier_notes && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-blue-700">Notas del proveedor — datos internos</p>
                  <p className="mt-1 text-sm text-blue-900 whitespace-pre-wrap">{selectedSupplier.supplier_notes}</p>
                </div>
              )}

              {!selectedSupplier.pending_topics && !selectedSupplier.supplier_notes && (
                <p className="py-2 text-center text-xs text-gray-400">Sin notas ni temas pendientes para este proveedor</p>
              )}

              <button
                onClick={handleConfirmSupplier}
                className="w-full rounded-xl bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
              >
                INICIAR REUNIÓN
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {suppliers?.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSupplier(s)}
                  className="flex items-center justify-between rounded-lg bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      Stand {s.stand} · {s.assigned_person || '—'} · {s.product_type || '—'}
                    </p>
                  </div>
                  <svg className="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              {suppliers?.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No hay proveedores. Importa desde Excel en Ajustes.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <NewSupplierForm currentUser={currentUser} onCreated={createMeetingForSupplier} />
      )}
    </div>
  )
}

function NewSupplierForm({
  currentUser,
  onCreated,
}: {
  currentUser: UserName
  onCreated: (id: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [stand, setStand] = useState('')
  const [productType, setProductType] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [emails, setEmails] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const id = uuid()
    const now = new Date().toISOString()
    await db.suppliers.add({
      id,
      name: name.trim(),
      stand: stand.trim(),
      assigned_person: contactPerson.trim() || currentUser,
      product_type: productType.trim(),
      emails: emails.split(',').map(e => e.trim()).filter(Boolean),
      phone: phone.trim(),
      relevance: 2,
      visit_day: '',
      visit_slot: '',
      visited: false,
      pending_topics: '',
      interesting_products: '',
      has_catalogue: false,
      current_products: '',
      supplier_notes: '',
      is_new: true,
      updated_at: now,
      updated_by: currentUser,
      created_at: now,
      synced_at: null,
    })

    await onCreated(id)
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 px-4 py-4">
      <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nombre del proveedor *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Ej: Shenzhen Tech Co."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Número de stand</label>
          <input
            type="text"
            value={stand}
            onChange={e => setStand(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Ej: 3F-A12"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Tipo de productos</label>
          <input
            type="text"
            value={productType}
            onChange={e => setProductType(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Ej: LED lighting, cables, adapters..."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Persona de contacto</label>
          <input
            type="text"
            value={contactPerson}
            onChange={e => setContactPerson(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Ej: Mr. Wang"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Email(s) — separados por coma</label>
          <input
            type="text"
            value={emails}
            onChange={e => setEmails(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="sales@company.com, export@company.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="+86 ..."
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full rounded-lg bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark disabled:opacity-50"
        >
          {saving ? 'Creando...' : 'Crear y continuar'}
        </button>
      </div>
    </form>
  )
}
