import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import { formatLocalDateTime } from '@/lib/dates'
import type { UserName, Relevance, Supplier } from '@/types'

interface Props {
  currentUser: UserName
}

export default function SupplierDetail({ currentUser }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const supplier = useLiveQuery(() => (id ? db.suppliers.get(id) : undefined), [id])
  const meetings = useLiveQuery(async () => {
    if (!id) return []
    const all = await db.meetings.where('supplier_id').equals(id).toArray()
    all.sort((a, b) => b.visited_at.localeCompare(a.visited_at))
    const enriched = await Promise.all(
      all.map(async m => {
        const productCount = await db.products.where('meeting_id').equals(m.id).count()
        return { ...m, productCount }
      }),
    )
    return enriched
  }, [id])

  const [editing, setEditing] = useState(false)

  async function handleNewMeeting() {
    if (!id) return
    const meetingId = uuid()
    const now = new Date().toISOString()
    await db.meetings.add({
      id: meetingId,
      supplier_id: id,
      user_name: currentUser,
      visited_at: now,
      urgent_notes: '',
      other_notes: '',
      business_card_photo_url: '',
      email_generated: false,
      email_sent_at: null,
      email_to_draft: '',
      email_subject_draft: '',
      email_body_draft: '',
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
    navigate(`/meeting/${meetingId}`)
  }

  if (!supplier) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="rounded-lg p-3 text-gray-500 hover:bg-gray-100" aria-label="Volver al inicio">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-800">{supplier.name}</h1>
              <p className="text-xs text-gray-400">Stand {supplier.stand}</p>
            </div>
          </div>
          <button
            onClick={() => setEditing(e => !e)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              editing ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 pt-4">
        {/* Supplier Info */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Datos del proveedor</h2>
          {editing ? (
            <SupplierEditForm
              key={supplier.id}
              supplier={supplier}
              currentUser={currentUser}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <div className="space-y-2 text-sm">
              <InfoRow label="Stand" value={supplier.stand} />
              <InfoRow label="Persona asignada" value={supplier.assigned_person || '—'} />
              <InfoRow label="Producto" value={supplier.product_type || '—'} />
              <InfoRow label="Emails" value={supplier.emails.join(', ') || '—'} />
              <InfoRow label="Teléfono" value={supplier.phone || '—'} />
              <InfoRow label="Relevancia" value={'★'.repeat(supplier.relevance) + '☆'.repeat(3 - supplier.relevance)} />
              <InfoRow label="Visitado" value={supplier.visited ? 'Sí ✓' : 'No'} />
              <InfoRow label="Catálogo" value={supplier.has_catalogue ? 'Sí' : 'No'} />
              {supplier.pending_topics && <InfoRow label="Temas pendientes" value={supplier.pending_topics} />}
              {supplier.interesting_products && <InfoRow label="Productos interesantes" value={supplier.interesting_products} />}
              {supplier.current_products && <InfoRow label="Productos actuales" value={supplier.current_products} />}
              {supplier.supplier_notes && <InfoRow label="Notas" value={supplier.supplier_notes} />}
            </div>
          )}
        </div>

        {/* Meetings */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Reuniones ({meetings?.length || 0})
          </h2>
          {meetings && meetings.length > 0 ? (
            <div className="flex flex-col gap-2">
              {meetings.map(m => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/meeting/${m.id}`)}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">{m.user_name}</p>
                    <p className="text-xs text-gray-400">
                      {formatLocalDateTime(m.visited_at)}
                      {' · '}{m.productCount} productos
                    </p>
                  </div>
                  {m.email_generated ? (
                    <span className="text-lg text-green-500">✓</span>
                  ) : (
                    <span className="text-lg text-yellow-400">⏳</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">Sin reuniones aún</p>
          )}
        </div>
      </div>

      {/* New Meeting Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg md:static md:mx-auto md:w-full md:max-w-3xl md:border-0 md:bg-transparent md:px-4 md:py-6 md:pb-6 md:shadow-none">
        <button
          onClick={handleNewMeeting}
          className="w-full rounded-xl bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
        >
          NUEVA REUNIÓN CON ESTE PROVEEDOR
        </button>
      </div>
    </div>
  )
}

function SupplierEditForm({
  supplier,
  currentUser,
  onSaved,
}: {
  supplier: Supplier
  currentUser: UserName
  onSaved: () => void
}) {
  // Lazy init: el formulario se rellena UNA sola vez con el supplier actual.
  // El `key={supplier.id}` del padre garantiza un montaje fresco al cambiar
  // de proveedor. Cambios concurrentes vía Dexie ya no machacan los edits.
  const [name, setName] = useState(supplier.name)
  const [stand, setStand] = useState(supplier.stand)
  const [emails, setEmails] = useState(() => supplier.emails.join(', '))
  const [phone, setPhone] = useState(supplier.phone)
  const [assignedPerson, setAssignedPerson] = useState(supplier.assigned_person)
  const [productType, setProductType] = useState(supplier.product_type)
  const [relevance, setRelevance] = useState<Relevance>(supplier.relevance)
  const [visited, setVisited] = useState(supplier.visited)
  const [pendingTopics, setPendingTopics] = useState(supplier.pending_topics)
  const [interestingProducts, setInterestingProducts] = useState(supplier.interesting_products)
  const [hasCatalogue, setHasCatalogue] = useState(supplier.has_catalogue)
  const [currentProducts, setCurrentProducts] = useState(supplier.current_products)
  const [supplierNotes, setSupplierNotes] = useState(supplier.supplier_notes)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const now = new Date().toISOString()
    await db.suppliers.update(supplier.id, {
      name: name.trim(),
      stand: stand.trim(),
      emails: emails.split(',').map(e => e.trim()).filter(Boolean),
      phone: phone.trim(),
      assigned_person: assignedPerson.trim(),
      product_type: productType.trim(),
      relevance,
      visited,
      pending_topics: pendingTopics.trim(),
      interesting_products: interestingProducts.trim(),
      has_catalogue: hasCatalogue,
      current_products: currentProducts.trim(),
      supplier_notes: supplierNotes.trim(),
      updated_at: now,
      updated_by: currentUser,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <EditField label="Nombre" value={name} onChange={setName} />
      <EditField label="Stand" value={stand} onChange={setStand} />
      <EditField label="Emails (separados por coma)" value={emails} onChange={setEmails} className="md:col-span-2" />
      <EditField label="Teléfono" value={phone} onChange={setPhone} />
      <EditField label="Persona asignada" value={assignedPerson} onChange={setAssignedPerson} />
      <EditField label="Tipo de producto" value={productType} onChange={setProductType} className="md:col-span-2" />
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-500">Relevancia</label>
        <div className="flex gap-2">
          {([1, 2, 3] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRelevance(r)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                relevance === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {'★'.repeat(r)}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={visited} onChange={e => setVisited(e.target.checked)} className="h-4 w-4 rounded" />
        <span className="text-sm text-gray-600">Visitado</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={hasCatalogue} onChange={e => setHasCatalogue(e.target.checked)} className="h-4 w-4 rounded" />
        <span className="text-sm text-gray-600">Tiene catálogo</span>
      </label>
      <EditField label="Temas pendientes" value={pendingTopics} onChange={setPendingTopics} multiline className="md:col-span-2" />
      <EditField label="Productos interesantes" value={interestingProducts} onChange={setInterestingProducts} multiline className="md:col-span-2" />
      <EditField label="Productos actuales" value={currentProducts} onChange={setCurrentProducts} multiline className="md:col-span-2" />
      <EditField label="Notas del proveedor" value={supplierNotes} onChange={setSupplierNotes} multiline className="md:col-span-2" />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-2 w-full rounded-lg bg-green-500 py-3 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50 md:col-span-2"
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  multiline,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  className?: string
}) {
  const cls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none'
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={cls} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-400">{label}</span>
      <span className="text-right text-gray-700">{value}</span>
    </div>
  )
}
