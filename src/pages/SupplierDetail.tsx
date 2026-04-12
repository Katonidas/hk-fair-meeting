import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import { formatDate, formatTime } from '@/lib/format'
import { USERS, getCCEmails } from '@/lib/constants'
import { getMatchingSearchedProducts } from '@/lib/matching'
import { buildMailtoUrl } from '@/lib/emailGenerator'
import { generatePotentialProductsEmailHTML, copyHTMLToClipboard } from '@/lib/htmlEmail'
import { getTerms } from '@/lib/settings'
import { fmtPrice } from '@/lib/price'
import type { UserName, Relevance, ProductStatus, SampleStatus } from '@/types'
import type { SearchedProduct } from '@/types/searchedProduct'
import { StatusBadge, ProductDetailModal } from '@/pages/CapturedProducts'
import type { EnrichedProduct } from '@/pages/CapturedProducts'

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
    if (!id) return [] as SearchedProduct[]
    return getMatchingSearchedProducts(id)
  }, [id])

  const supplierProducts = useLiveQuery(async () => {
    if (!id) return []
    const supplierMeetings = await db.meetings.where('supplier_id').equals(id).toArray()
    const meetingIds = new Set(supplierMeetings.map(m => m.id))
    const allProducts = await db.products.toArray()
    // Include products from meetings with this supplier OR with direct supplier_id
    return allProducts.filter(p => meetingIds.has(p.meeting_id) || p.supplier_id === id)
  }, [id])

  const [prodSortCol, setProdSortCol] = useState<string>('product_type')
  const [prodSortAsc, setProdSortAsc] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<EnrichedProduct | null>(null)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)

  const [meetingSortCol, setMeetingSortCol] = useState('visited_at')
  const [meetingSortAsc, setMeetingSortAsc] = useState(false)

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
  const [isNew, setIsNew] = useState(false)
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
      setIsNew(supplier.is_new)
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
      is_new: isNew,
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
    navigate(`/meeting/${meetingId}?from=supplier&sid=${id}`)
  }

  if (!supplier) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col pb-24">
      {/* Subheader */}
      <div className="border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">{supplier.name}</h2>
            <p className="text-xs text-gray-400">Stand {supplier.stand}</p>
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
      </div>

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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Nuevo proveedor</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsNew(true)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium ${isNew ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>Sí</button>
                    <button type="button" onClick={() => setIsNew(false)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium ${!isNew ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>No</button>
                  </div>
                </div>
                <label className="flex items-center gap-2 pt-5">
                  <input type="checkbox" checked={visited} onChange={e => setVisited(e.target.checked)} className="h-4 w-4 rounded" />
                  <span className="text-sm text-gray-600">Visitado</span>
                </label>
                <label className="flex items-center gap-2 pt-5">
                  <input type="checkbox" checked={hasCatalogue} onChange={e => setHasCatalogue(e.target.checked)} className="h-4 w-4 rounded" />
                  <span className="text-sm text-gray-600">Catálogo</span>
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
              <InfoRow label="Nuevo proveedor" value={supplier.is_new ? 'Sí' : 'No'} />
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

        {/* Meetings */}
        <SupplierMeetingsTable
          meetings={meetings}
          supplierId={id!}
          currentUser={currentUser}
          navigate={navigate}
          sortCol={meetingSortCol}
          sortAsc={meetingSortAsc}
          onSort={(col) => {
            if (col === meetingSortCol) setMeetingSortAsc(!meetingSortAsc)
            else { setMeetingSortCol(col); setMeetingSortAsc(true) }
          }}
        />

        {/* Productos */}
        <SupplierProductsTable
          products={supplierProducts}
          supplierName={supplier.name}
          supplierStand={supplier.stand}
          sortCol={prodSortCol}
          sortAsc={prodSortAsc}
          onSort={(col) => {
            if (col === prodSortCol) setProdSortAsc(!prodSortAsc)
            else { setProdSortCol(col); setProdSortAsc(true) }
          }}
          onSelectProduct={(p) => {
            const enriched: EnrichedProduct = {
              ...p,
              supplierName: supplier.name,
              supplierStand: supplier.stand,
            }
            setSelectedProduct(enriched)
          }}
        />

        {/* Productos Potenciales — siempre visible para que el usuario pueda
            añadir manualmente aunque no haya match automático */}
        {id && (
          <PotentialProductsSection
            products={matchingSearchedProducts || []}
            supplier={supplier}
            supplierId={id}
          />
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onPhotoClick={setEnlargedPhoto}
          onDeleted={() => setSelectedProduct(null)}
        />
      )}

      {/* Enlarged Photo */}
      {enlargedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={() => setEnlargedPhoto(null)}>
          <img src={enlargedPhoto} alt="Enlarged" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}

      {/* Footer Buttons */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-4 text-base font-medium text-gray-500 transition-colors hover:bg-gray-100"
          >
            ← Volver
          </button>
          <button
            onClick={handleNewMeeting}
            className="flex-1 rounded-xl bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
          >
            NUEVA REUNION CON ESTE PROVEEDOR
          </button>
        </div>
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

/* ── Meetings Table (same format as Home MeetingsList, without Proveedor column) ── */

function SupplierMeetingsTable({
  meetings,
  supplierId,
  currentUser,
  navigate,
  sortCol,
  sortAsc,
  onSort,
}: {
  meetings: Array<{
    id: string
    supplier_id: string
    user_name: string
    visited_at: string
    productCount: number
    email_generated: boolean
    status?: string
    location?: string
    urgent_notes: string
    other_notes: string
    business_card_photo_url: string
  }> | undefined
  supplierId: string
  currentUser: UserName
  navigate: (path: string) => void
  sortCol: string
  sortAsc: boolean
  onSort: (col: string) => void
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  async function handleDelete(meetingId: string) {
    if (!window.confirm('¿Eliminar esta reunión y todos sus productos?')) return
    await db.products.where('meeting_id').equals(meetingId).delete()
    await db.meetings.delete(meetingId)
    setOpenMenu(null)
  }

  async function handleDuplicate(m: NonNullable<typeof meetings>[number]) {
    const newId = uuid()
    const now = new Date().toISOString()
    await db.meetings.add({
      id: newId,
      supplier_id: m.supplier_id,
      user_name: currentUser,
      location: (m.location as 'feria' | 'hotel') || 'feria',
      status: 'draft',
      visited_at: now,
      urgent_notes: m.urgent_notes || '',
      other_notes: m.other_notes || '',
      business_card_photo_url: m.business_card_photo_url || '',
      stand_photo_url: (m as Record<string, unknown>).stand_photo_url as string || '',
      email_generated: false,
      email_sent_at: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
    const products = await db.products.where('meeting_id').equals(m.id).toArray()
    for (const p of products) {
      await db.products.add({ ...p, id: uuid(), meeting_id: newId, created_at: now })
    }
    setOpenMenu(null)
    navigate(`/meeting/${newId}?edit=1&from=supplier&sid=${supplierId}`)
  }

  const sorted = meetings ? [...meetings].sort((a, b) => {
    let cmp = 0
    switch (sortCol) {
      case 'visited_at': cmp = a.visited_at.localeCompare(b.visited_at); break
      case 'user_name': cmp = a.user_name.localeCompare(b.user_name); break
      case 'productCount': cmp = a.productCount - b.productCount; break
      case 'email': cmp = (a.email_generated ? 1 : 0) - (b.email_generated ? 1 : 0); break
      case 'location': cmp = (a.location || '').localeCompare(b.location || ''); break
    }
    return sortAsc ? cmp : -cmp
  }) : []

  const arrow = (col: string) => sortCol === col ? (sortAsc ? ' \u2191' : ' \u2193') : ''
  const thBase = "px-2 py-2 font-semibold text-gray-500 cursor-pointer whitespace-nowrap hover:text-primary"

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Reuniones ({meetings?.length || 0})
      </h2>
      {!meetings || meetings.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">Sin reuniones aún</p>
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className={`${thBase} text-left`} onClick={() => onSort('visited_at')}>Fecha{arrow('visited_at')}</th>
                <th className={`${thBase} text-left`} onClick={() => onSort('visited_at')}>Hora</th>
                <th className={`${thBase} text-left`} onClick={() => onSort('location')}>Lugar{arrow('location')}</th>
                <th className={`${thBase} text-left`} onClick={() => onSort('user_name')}>Persona{arrow('user_name')}</th>
                <th className={`${thBase} text-center`} onClick={() => onSort('productCount')}>Prod.{arrow('productCount')}</th>
                <th className={`${thBase} text-center`} onClick={() => onSort('email')}>Email{arrow('email')}</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-500 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => {
                const isDraft = m.status === 'draft' || !m.status
                const locationLabel = m.location === 'hotel' ? 'Hotel' : 'Feria'

                return (
                  <tr
                    key={m.id}
                    onClick={() => navigate(`/meeting/${m.id}?from=supplier&sid=${supplierId}`)}
                    className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50 ${
                      isDraft ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-2 py-2.5 text-gray-600">
                      <div className="flex items-center gap-1">
                        {formatDate(m.visited_at)}
                        {isDraft && <span className="rounded bg-yellow-100 px-1 py-0.5 text-[9px] font-medium text-yellow-700">B</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-gray-600">{formatTime(m.visited_at)}</td>
                    <td className="px-2 py-2.5 text-gray-500">{locationLabel}</td>
                    <td className="px-2 py-2.5 text-gray-500">{m.user_name}</td>
                    <td className="px-2 py-2.5 text-center text-gray-600">{m.productCount}</td>
                    <td className="px-2 py-2.5 text-center">
                      {m.email_generated
                        ? <span className="font-bold text-green-600">S</span>
                        : <span className="text-gray-300">N</span>}
                    </td>
                    <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {openMenu === m.id && (
                          <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button onClick={() => { setOpenMenu(null); navigate(`/meeting/${m.id}?edit=1&from=supplier&sid=${supplierId}`) }}
                              className="flex w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Editar</button>
                            <button onClick={() => handleDuplicate(m)}
                              className="flex w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Duplicar reunión</button>
                            <button onClick={() => handleDelete(m.id)}
                              className="flex w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Eliminar</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Products Table ── */

function RenderTextWithLinks({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-800">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function PotentialProductsSection({ products, supplier, supplierId }: { products: SearchedProduct[]; supplier: { name: string; emails: string[] }; supplierId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [prepareMsg, setPrepareMsg] = useState('')
  // Estado para orden de la tabla
  const [sortCol, setSortCol] = useState<'brand' | 'product_type' | 'ref_segment' | 'main_specs' | 'pvpr' | 'target_cost'>('brand')
  const [sortAsc, setSortAsc] = useState(true)
  // Menú "3 puntos" abierto por fila
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  // Diálogo de añadir manual
  const [showAddPicker, setShowAddPicker] = useState(false)
  // Lista global de searched_products para el picker (productos que NO están ya
  // en el match para añadir uno manualmente)
  const allSearchedProducts = useLiveQuery(() => db.searched_products.toArray(), [])

  function toggleSort(col: typeof sortCol) {
    if (col === sortCol) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  // Ordena el listado según la columna seleccionada
  const sorted = [...products].sort((a, b) => {
    let cmp = 0
    switch (sortCol) {
      case 'brand': cmp = (a.brand || '').localeCompare(b.brand || ''); break
      case 'product_type': cmp = (a.product_type || '').localeCompare(b.product_type || ''); break
      case 'ref_segment': cmp = (a.ref_segment || '').localeCompare(b.ref_segment || ''); break
      case 'main_specs': cmp = (a.main_specs || '').localeCompare(b.main_specs || ''); break
      case 'pvpr': cmp = (a.pvpr ?? 0) - (b.pvpr ?? 0); break
      case 'target_cost': cmp = (a.target_cost ?? 0) - (b.target_cost ?? 0); break
    }
    return sortAsc ? cmp : -cmp
  })

  const arrow = (col: typeof sortCol) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''
  const thBase = 'px-2 py-2 font-semibold text-purple-700 cursor-pointer whitespace-nowrap hover:text-purple-900 select-none'

  // Eliminar producto del match de este proveedor. Si tenía supplierId en
  // candidate_supplier_ids (link manual) lo quitamos. Para los matches
  // automáticos por tipo, añadimos a una lista de "excluidos" del supplier.
  // Por simplicidad implementamos solo el caso manual aquí: si el producto
  // estaba enlazado manualmente lo desenlazamos. Si era un match automático
  // por tipo, no se puede "deshacer" sin un campo nuevo de exclusiones, así
  // que le advertimos al usuario.
  async function handleRemoveFromList(sp: SearchedProduct) {
    if (sp.candidate_supplier_ids?.includes(supplierId)) {
      const next = sp.candidate_supplier_ids.filter(sid => sid !== supplierId)
      await db.searched_products.update(sp.id, {
        candidate_supplier_ids: next,
        updated_at: new Date().toISOString(),
      })
      setOpenMenu(null)
    } else {
      window.alert(`"${sp.product_type}" aparece aquí porque su tipo de producto coincide automáticamente con el del proveedor. Para excluirlo, edita el tipo de producto en uno de los dos.`)
    }
  }

  // Añadir manualmente un producto deseado al match de este proveedor
  async function handleAddManual(sp: SearchedProduct) {
    const current = sp.candidate_supplier_ids || []
    if (current.includes(supplierId)) {
      setShowAddPicker(false)
      return
    }
    await db.searched_products.update(sp.id, {
      candidate_supplier_ids: [...current, supplierId],
      updated_at: new Date().toISOString(),
    })
    setShowAddPicker(false)
  }

  // IDs de productos ya en el match — para excluirlos del picker
  const matchedIds = new Set(products.map(p => p.id))
  const pickerCandidates = (allSearchedProducts || [])
    .filter(p => !matchedIds.has(p.id))
    .sort((a, b) => (a.brand || '').localeCompare(b.brand || '') || a.product_type.localeCompare(b.product_type))

  async function handlePrepareHTML() {
    if (!supplier) return
    setPreparing(true)
    setPrepareMsg('')
    try {
      const currentUser = (localStorage.getItem('hk-fair-user') || 'Jesús') as UserName

      // Build supplier object stub (htmlEmail only uses emails from it indirectly)
      const supplierObj = {
        id: '', name: supplier.name, stand: '', assigned_person: '', contact_person: '',
        product_type: '', emails: supplier.emails, phone: '', relevance: 2 as const,
        visit_day: '', visit_slot: '', visited: false, pending_topics: '',
        interesting_products: '', has_catalogue: false, current_products: '',
        supplier_notes: '', is_new: false, updated_at: '', updated_by: '',
        created_at: '', synced_at: null,
      }

      // Build a map of product.id → target_cost so the calc function can return it
      const tcMap = new Map(products.map(p => [p.id, p.target_cost]))
      // Find product by matching all fields via closure — simpler: use sp.target_cost via index tracking
      let idx = 0
      const calcTC = () => {
        const p = products[idx++]
        return p ? p.target_cost : null
      }
      // Reset idx before each call: htmlEmail calls calcTC once per product sequentially
      idx = 0
      void tcMap

      const html = generatePotentialProductsEmailHTML(
        supplierObj,
        products,
        currentUser,
        calcTC
      )
      const copied = await copyHTMLToClipboard(html, 'Productos buscados APPROX')

      setPrepareMsg(copied
        ? 'HTML copiado. Abriendo Outlook... Pega con Ctrl+V.'
        : 'No se pudo copiar. Abriendo Outlook igualmente...'
      )

      const cc = getCCEmails(currentUser)
      const url = buildMailtoUrl(supplier.emails, cc, 'Productos buscados APPROX', '')
      setTimeout(() => window.open(url, '_self'), 300)
      setTimeout(() => setPrepareMsg(''), 8000)
    } finally {
      setPreparing(false)
    }
  }

  function handleSendEmail() {
    if (!supplier) return
    const terms = getTerms()
    const lines: string[] = []
    lines.push('Hello,')
    lines.push('')
    lines.push('We are looking for the following products. To make our meeting more efficient, please have ready the products that you consider may fit both in terms of specifications and price, also taking into account the examples we send regarding shape or design.')
    lines.push('')
    lines.push('Of course, if you have any alternative, we will be happy to see it. If you want to send us the information by email in advance, that would be great too. Please send us the best possible offer along with images and specifications of the product.')
    lines.push('')
    lines.push('Please remember that the prices provided must be based on and include our agreed terms and conditions:')
    lines.push('')
    lines.push(terms)
    lines.push('')
    lines.push('PRODUCTS WE ARE LOOKING FOR:')
    lines.push('****************************************')
    lines.push('')
    products.forEach((sp, i) => {
      lines.push(`******** Product ${i + 1} ********`)
      lines.push(`  ${(sp.product_type || '—').toUpperCase()} - ${sp.ref_segment || '—'} / ${sp.brand || '—'}`)
      lines.push(`  SPECS: ${sp.main_specs ? sp.main_specs.replace(/\n/g, ' | ') : '—'}`)
      lines.push(`  TARGET PRICE: ${fmtPrice(sp.target_cost)}`)
      lines.push(`  EXAMPLES: ${sp.examples || '—'}`)
      lines.push('')
    })
    lines.push('Best regards,')
    lines.push('APPROX Team')
    const body = lines.join('\n')
    const currentUser = (localStorage.getItem('hk-fair-user') || 'Jesus') as UserName
    const cc = getCCEmails(currentUser)
    const url = buildMailtoUrl(supplier.emails, cc, 'Productos buscados APPROX', body)
    window.open(url, '_blank')
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-purple-700">
          Productos Potenciales a encontrar en proveedor ({products.length})
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowAddPicker(true)}
            className="rounded-lg border border-purple-300 bg-white px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50"
          >
            + Añadir manual
          </button>
          <button
            onClick={handlePrepareHTML}
            disabled={preparing}
            className="rounded-lg border-2 border-purple-500 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            {preparing ? 'Preparando...' : 'HTML (Outlook)'}
          </button>
          <button
            onClick={handleSendEmail}
            className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700"
          >
            Texto plano
          </button>
        </div>
      </div>
      {prepareMsg && (
        <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-center text-xs font-medium text-purple-700">
          {prepareMsg}
        </div>
      )}

      {products.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">Sin productos potenciales para este proveedor.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-purple-200 bg-purple-50">
                <th className={`${thBase} text-left`} onClick={() => toggleSort('brand')}>Marca{arrow('brand')}</th>
                <th className={`${thBase} text-left`} onClick={() => toggleSort('product_type')}>Tipo{arrow('product_type')}</th>
                <th className={`${thBase} text-left`} onClick={() => toggleSort('ref_segment')}>Referencia{arrow('ref_segment')}</th>
                <th className={`${thBase} text-left`} onClick={() => toggleSort('main_specs')}>Specs{arrow('main_specs')}</th>
                <th className={`${thBase} text-right`} onClick={() => toggleSort('pvpr')}>PVPR €{arrow('pvpr')}</th>
                <th className={`${thBase} text-right`} onClick={() => toggleSort('target_cost')}>Target $ {arrow('target_cost')}</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(sp => (
                <>
                  <tr
                    key={sp.id}
                    onClick={() => setExpanded(expanded === sp.id ? null : sp.id)}
                    className="cursor-pointer border-b border-gray-100 bg-white hover:bg-purple-50"
                  >
                    <td className="px-2 py-2 font-medium text-gray-800">{sp.brand || '—'}</td>
                    <td className="px-2 py-2 text-gray-600">{sp.product_type || '—'}</td>
                    <td className="px-2 py-2 text-gray-600 max-w-[120px] truncate">{sp.ref_segment || '—'}</td>
                    <td className="px-2 py-2 text-gray-500 max-w-[180px] truncate">{sp.main_specs || '—'}</td>
                    <td className="px-2 py-2 text-right text-gray-700">{fmtPrice(sp.pvpr, 'EUR')}</td>
                    <td className="px-2 py-2 text-right font-bold text-green-700">{fmtPrice(sp.target_cost)}</td>
                    <td className="px-2 py-2 text-center relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenu(openMenu === sp.id ? null : sp.id)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Más acciones"
                      >
                        ⋮
                      </button>
                      {openMenu === sp.id && (
                        <div className="absolute right-2 top-9 z-30 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg">
                          <button
                            onClick={() => { setExpanded(sp.id); setOpenMenu(null) }}
                            className="block w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => handleRemoveFromList(sp)}
                            className="block w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                          >
                            Eliminar de la lista
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expanded === sp.id && (
                    <tr key={`${sp.id}-detail`} className="bg-purple-50/30">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                          <div><span className="font-semibold text-gray-500">Marca:</span> <span className="text-gray-800">{sp.brand || '—'}</span></div>
                          <div><span className="font-semibold text-gray-500">Tipo:</span> <span className="text-gray-800">{sp.product_type}</span></div>
                          <div><span className="font-semibold text-gray-500">Ref:</span> <span className="text-gray-800">{sp.ref_segment || '—'}</span></div>
                          <div><span className="font-semibold text-gray-500">Modelo:</span> <span className="text-gray-800">{sp.model_interno || '—'}</span></div>
                          <div><span className="font-semibold text-gray-500">Target:</span> <span className="font-bold text-green-700">{fmtPrice(sp.target_cost)}</span></div>
                          <div><span className="font-semibold text-gray-500">PVPR:</span> <span className="text-gray-800">{fmtPrice(sp.pvpr, 'EUR')}</span></div>
                          <div><span className="font-semibold text-gray-500">Margen:</span> <span className="text-gray-800">{sp.margin_target ? `${sp.margin_target}%` : '—'}</span></div>
                          <div><span className="font-semibold text-gray-500">Prioridad:</span> <span className="text-gray-800">{sp.relevance === 1 ? 'IMPRESCINDIBLE' : sp.relevance === 3 ? 'OPCIONAL' : 'IMPORTANTE'}</span></div>
                        </div>
                        {sp.main_specs && (
                          <div className="mt-2 text-xs">
                            <span className="font-semibold text-gray-500">Specs:</span>
                            <p className="mt-0.5 whitespace-pre-wrap text-gray-700">{sp.main_specs}</p>
                          </div>
                        )}
                        {sp.examples && (
                          <div className="mt-2 text-xs">
                            <span className="font-semibold text-gray-500">Ejemplos:</span>
                            <p className="mt-0.5 whitespace-pre-wrap text-gray-700"><RenderTextWithLinks text={sp.examples} /></p>
                          </div>
                        )}
                        {sp.photos && sp.photos.length > 0 && (
                          <div className="mt-2">
                            <p className="mb-1 text-xs font-semibold text-gray-500">Fotos:</p>
                            <div className="flex flex-wrap gap-2">
                              {sp.photos.map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt={`Foto ${i + 1}`}
                                  className="h-16 w-16 cursor-pointer rounded-lg object-cover border border-gray-200 hover:opacity-80"
                                  onClick={() => setEnlargedPhoto(url)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Picker para añadir manualmente */}
      {showAddPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAddPicker(false)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Añadir producto deseado</h3>
              <button onClick={() => setShowAddPicker(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <p className="mb-3 text-xs text-gray-500">Selecciona un producto buscado para vincularlo a este proveedor:</p>
            {pickerCandidates.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No hay productos buscados disponibles.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {pickerCandidates.map(sp => (
                  <button
                    key={sp.id}
                    onClick={() => handleAddManual(sp)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-purple-50 hover:border-purple-300"
                  >
                    <span className="font-bold text-gray-800">{sp.brand || '—'}</span>
                    <span className="text-gray-500"> · {sp.product_type} · {sp.ref_segment || '—'}</span>
                    <p className="mt-0.5 text-gray-500 truncate">{sp.main_specs || 'Sin specs'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {enlargedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={() => setEnlargedPhoto(null)}>
          <img src={enlargedPhoto} alt="Foto ampliada" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}

interface SupplierProduct {
  id: string
  meeting_id: string
  product_type: string
  item_model: string
  price: number | null
  price_currency: string
  target_price: number | null
  features: string
  moq: number | null
  options: string
  sample_status: SampleStatus
  sample_units: number | null
  observations: string
  photos: string[]
  status: ProductStatus
  created_at: string
}

function SupplierProductsTable({
  products,
  sortCol,
  sortAsc,
  onSort,
  onSelectProduct,
}: {
  products: SupplierProduct[] | undefined
  supplierName: string
  supplierStand: string
  sortCol: string
  sortAsc: boolean
  onSort: (col: string) => void
  onSelectProduct: (p: SupplierProduct) => void
}) {
  if (!products || products.length === 0) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Productos (0)</h2>
        <p className="py-4 text-center text-sm text-gray-400">Sin productos capturados</p>
      </div>
    )
  }

  const sorted = [...products].sort((a, b) => {
    let cmp = 0
    switch (sortCol) {
      case 'product_type': cmp = (a.product_type || '').localeCompare(b.product_type || ''); break
      case 'item_model': cmp = (a.item_model || '').localeCompare(b.item_model || ''); break
      case 'price': cmp = (a.price || 0) - (b.price || 0); break
      case 'target_price': cmp = (a.target_price || 0) - (b.target_price || 0); break
      case 'moq': cmp = (a.moq || 0) - (b.moq || 0); break
      case 'features': cmp = (a.features || '').localeCompare(b.features || ''); break
      case 'sample_status': cmp = a.sample_status.localeCompare(b.sample_status); break
      case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break
    }
    return sortAsc ? cmp : -cmp
  })

  const arrow = (col: string) => sortCol === col ? (sortAsc ? ' \u2191' : ' \u2193') : ''
  const thBase = 'px-2 py-2 font-semibold text-gray-500 cursor-pointer whitespace-nowrap hover:text-primary'

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Productos ({products.length})
      </h2>
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full min-w-[700px] text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className={`${thBase} text-left`} onClick={() => onSort('product_type')}>Tipo{arrow('product_type')}</th>
              <th className={`${thBase} text-left`} onClick={() => onSort('item_model')}>Item/Model{arrow('item_model')}</th>
              <th className={`${thBase} text-right`} onClick={() => onSort('price')}>Precio{arrow('price')}</th>
              <th className={`${thBase} text-right`} onClick={() => onSort('target_price')}>Target{arrow('target_price')}</th>
              <th className={`${thBase} text-right`} onClick={() => onSort('moq')}>MOQ{arrow('moq')}</th>
              <th className={`${thBase} text-left`} onClick={() => onSort('features')}>Features{arrow('features')}</th>
              <th className={`${thBase} text-center`} onClick={() => onSort('sample_status')}>Sample{arrow('sample_status')}</th>
              <th className={`${thBase} text-center`} onClick={() => onSort('status')}>Estado{arrow('status')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr
                key={p.id}
                onClick={() => onSelectProduct(p)}
                className="cursor-pointer border-b border-gray-100 bg-white hover:bg-blue-50"
              >
                <td className="px-2 py-2.5 text-gray-600">{p.product_type || '—'}</td>
                <td className="px-2 py-2.5 font-medium text-gray-800">{p.item_model || '—'}</td>
                <td className="px-2 py-2.5 text-right text-gray-600">{fmtPrice(p.price)}</td>
                <td className="px-2 py-2.5 text-right text-gray-600">{fmtPrice(p.target_price)}</td>
                <td className="px-2 py-2.5 text-right text-gray-600">{p.moq || '—'}</td>
                <td className="px-2 py-2.5 text-gray-500 max-w-[150px] truncate">{p.features || '—'}</td>
                <td className="px-2 py-2.5 text-center">
                  {p.sample_status === 'collected' ? (
                    <span className="text-green-600 font-bold">Recogido</span>
                  ) : p.sample_status === 'pending' ? (
                    <span className="text-yellow-600">Pdte</span>
                  ) : (
                    <span className="text-gray-300">No</span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
