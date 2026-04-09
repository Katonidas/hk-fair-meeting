import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import { formatDate, formatTime } from '@/lib/format'
import { normalize } from '@/lib/normalize'
import { USERS } from '@/lib/constants'
import type { UserName, Relevance } from '@/types'

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

  const matchingSearchedProducts = useLiveQuery(async () => {
    if (!supplier?.product_type) return []
    const supplierTypes = normalize(supplier.product_type).split(/[,;/]/).map(t => t.trim()).filter(Boolean)
    if (supplierTypes.length === 0) return []
    const all = await db.searched_products.toArray()
    return all.filter(sp => {
      const spType = normalize(sp.product_type)
      return supplierTypes.some(st => spType.includes(st) || st.includes(spType))
    })
  }, [supplier?.product_type])

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [stand, setStand] = useState('')
  const [emails, setEmails] = useState('')
  const [phone, setPhone] = useState('')
  const [assignedPerson, setAssignedPerson] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [productType, setProductType] = useState('')
  const [relevance, setRelevance] = useState<Relevance>(2)
  const [visited, setVisited] = useState(false)
  const [pendingTopics, setPendingTopics] = useState('')
  const [interestingProducts, setInterestingProducts] = useState('')
  const [hasCatalogue, setHasCatalogue] = useState(false)
  const [currentProducts, setCurrentProducts] = useState('')
  const [supplierNotes, setSupplierNotes] = useState('')

  useEffect(() => {
    if (supplier) {
      setName(supplier.name)
      setStand(supplier.stand)
      setEmails(supplier.emails.join(', '))
      setPhone(supplier.phone)
      setAssignedPerson(supplier.assigned_person)
      setContactPerson(supplier.contact_person || '')
      setProductType(supplier.product_type)
      setRelevance(supplier.relevance)
      setVisited(supplier.visited)
      setPendingTopics(supplier.pending_topics)
      setInterestingProducts(supplier.interesting_products)
      setHasCatalogue(supplier.has_catalogue)
      setCurrentProducts(supplier.current_products)
      setSupplierNotes(supplier.supplier_notes)
    }
  }, [supplier])

  async function handleSave() {
    if (!id) return
    const now = new Date().toISOString()
    await db.suppliers.update(id, {
      name: name.trim(),
      stand: stand.trim(),
      emails: emails.split(',').map(e => e.trim()).filter(Boolean),
      phone: phone.trim(),
      assigned_person: assignedPerson.trim(),
      contact_person: contactPerson.trim(),
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
    setEditing(false)
  }

  async function handleNewMeeting() {
    if (!id) return
    const meetingId = uuid()
    const now = new Date().toISOString()
    await db.meetings.add({
      id: meetingId,
      supplier_id: id,
      user_name: currentUser,
      location: 'feria',
      status: 'draft',
      visited_at: now,
      urgent_notes: '',
      other_notes: '',
      business_card_photo_url: '',
      stand_photo_url: '',
      email_generated: false,
      email_sent_at: null,
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
    <div className="flex min-h-screen flex-col bg-gray-light pb-24">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-lg font-bold text-primary">HK Fair</button>
            <span className="mx-2 text-gray-300">/</span>
            <div>
              <h1 className="text-sm font-bold text-gray-800">{supplier.name}</h1>
              <p className="text-xs text-gray-400">Stand {supplier.stand}</p>
            </div>
          </div>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              editing ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {editing ? 'Guardar' : 'Editar'}
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 px-4 pt-4">
        {/* Supplier Info */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Datos del proveedor</h2>
          {editing ? (
            <div className="flex flex-col gap-3">
              <EditField label="Nombre" value={name} onChange={setName} />
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Tipo de producto" value={productType} onChange={setProductType} />
                <EditField label="Stand" value={stand} onChange={setStand} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Contacto (Nombre)" value={contactPerson} onChange={setContactPerson} />
                <EditField label="Teléfono" value={phone} onChange={setPhone} />
              </div>
              <EditField label="Emails (separados por coma)" value={emails} onChange={setEmails} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Persona asignada</label>
                  <select value={assignedPerson} onChange={e => setAssignedPerson(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none">
                    <option value="">— Sin asignar —</option>
                    {USERS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Relevancia</label>
                  <div className="flex gap-1">
                    {([1, 2, 3] as const).map(r => (
                      <button key={r} type="button" onClick={() => setRelevance(r)}
                        className={`flex-1 rounded-lg py-2 text-[10px] font-bold leading-tight ${relevance === r
                          ? r === 1 ? 'bg-red-500 text-white' : r === 2 ? 'bg-yellow-400 text-white' : 'bg-gray-400 text-white'
                          : 'bg-gray-100 text-gray-400'
                        }`}>{r === 1 ? 'IMPRESCINDIBLE' : r === 2 ? 'IMPORTANTE' : 'OPCIONAL'}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={visited} onChange={e => setVisited(e.target.checked)} className="h-4 w-4 rounded" />
                  <span className="text-sm text-gray-600">Visitado</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={hasCatalogue} onChange={e => setHasCatalogue(e.target.checked)} className="h-4 w-4 rounded" />
                  <span className="text-sm text-gray-600">Tiene catálogo</span>
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Temas pendientes <span className="font-normal text-gray-400">— incidencias o temas a tratar con el proveedor</span></label>
                <textarea value={pendingTopics} onChange={e => setPendingTopics(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
              </div>
              <EditField label="Productos interesantes" value={interestingProducts} onChange={setInterestingProducts} multiline />
              <EditField label="Productos actuales" value={currentProducts} onChange={setCurrentProducts} multiline />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Notas del proveedor <span className="font-normal text-gray-400">— datos a tener en cuenta a nivel interno</span></label>
                <textarea value={supplierNotes} onChange={e => setSupplierNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <InfoRow label="Tipo producto" value={supplier.product_type || '—'} />
              <InfoRow label="Stand" value={supplier.stand} />
              <InfoRow label="Contacto (Nombre)" value={supplier.contact_person || '—'} />
              <InfoRow label="Teléfono" value={supplier.phone || '—'} />
              <InfoRow label="Emails" value={supplier.emails.join(', ') || '—'} />
              <InfoRow label="Persona asignada" value={supplier.assigned_person || '—'} />
              <InfoRow label="Relevancia" value={supplier.relevance === 1 ? 'IMPRESCINDIBLE' : supplier.relevance === 2 ? 'IMPORTANTE' : 'OPCIONAL'} />
              <InfoRow label="Visitado" value={supplier.visited ? 'Sí' : 'No'} />
              <InfoRow label="Catálogo" value={supplier.has_catalogue ? 'Sí' : 'No'} />
              {supplier.pending_topics && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-700">Temas pendientes — incidencias o temas a tratar</p>
                  <p className="mt-1 text-sm text-amber-900 whitespace-pre-wrap">{supplier.pending_topics}</p>
                </div>
              )}
              {supplier.interesting_products && <InfoRow label="Productos interesantes" value={supplier.interesting_products} />}
              {supplier.current_products && <InfoRow label="Productos actuales" value={supplier.current_products} />}
              {supplier.supplier_notes && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-700">Notas del proveedor — datos internos</p>
                  <p className="mt-1 text-sm text-blue-900 whitespace-pre-wrap">{supplier.supplier_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Matching Searched Products */}
        {matchingSearchedProducts && matchingSearchedProducts.length > 0 && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <h2 className="mb-2 text-sm font-semibold text-purple-700">
              Productos deseados que coinciden ({matchingSearchedProducts.length})
            </h2>
            <div className="flex flex-col gap-2">
              {matchingSearchedProducts.map(sp => (
                <div key={sp.id} className="rounded-lg bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{sp.brand} — {sp.product_type}</span>
                    {sp.target_cost && <span className="text-purple-600 font-bold">${sp.target_cost}</span>}
                  </div>
                  <p className="mt-1 text-gray-500">
                    {sp.ref_segment && <>{sp.ref_segment} · </>}
                    {sp.main_specs || 'Sin specs'}
                    {sp.model_interno && <> · Modelo: {sp.model_interno}</>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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
                      {formatDate(m.visited_at)} {formatTime(m.visited_at)}
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
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
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

function EditField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}) {
  const cls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none'
  return (
    <div>
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
