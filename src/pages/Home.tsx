import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { useSync } from '@/hooks/useSync'
import type { UserName, Relevance } from '@/types'

interface Props {
  currentUser: UserName
  onLogout: () => void
}

type Tab = 'meetings' | 'suppliers' | 'searched'

export default function Home({ currentUser, onLogout }: Props) {
  const syncStatus = useSync()
  const [tab, setTab] = useState<Tab>('meetings')
  const [search, setSearch] = useState('')
  const [meetingFilter, setMeetingFilter] = useState<'all' | 'draft' | 'saved'>('saved')
  const navigate = useNavigate()

  const allMeetings = useLiveQuery(async () => {
    const meetings = await db.meetings
      .where('user_name')
      .equals(currentUser)
      .toArray()
    meetings.sort((a, b) => b.visited_at.localeCompare(a.visited_at))

    const enriched = await Promise.all(
      meetings.map(async m => {
        const supplier = await db.suppliers.get(m.supplier_id)
        const productCount = await db.products.where('meeting_id').equals(m.id).count()
        return { ...m, supplier, productCount }
      }),
    )
    return enriched
  }, [currentUser])

  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [productFilter, setProductFilter] = useState('')
  const [sortCol, setSortCol] = useState<string>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const suppliers = useLiveQuery(async () => {
    const all = await db.suppliers.toArray()
    const allMeetings = await db.meetings.toArray()

    const enriched = all.map(s => {
      const sMeetings = allMeetings.filter(m => m.supplier_id === s.id)
      return {
        ...s,
        visited_feria: sMeetings.some(m => m.location === 'feria'),
        visited_hotel: sMeetings.some(m => m.location === 'hotel'),
      }
    })

    let filtered = enriched
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.stand.toLowerCase().includes(q))
    }
    if (productFilter) {
      const pf = productFilter.toLowerCase()
      filtered = filtered.filter(s => s.product_type.toLowerCase().includes(pf))
    }
    return filtered
  }, [search, productFilter])

  return (
    <div className="flex min-h-screen flex-col bg-gray-light">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-left">
            <h1 className="text-lg font-bold text-primary">HK Fair</h1>
            <p className="text-xs text-gray-400">{currentUser}</p>
          </button>
          <div className="flex items-center gap-2">
            <SyncIndicator status={syncStatus} />
            <button
              onClick={() => navigate('/settings')}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              title="Ajustes"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              title="Cambiar usuario"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* New Meeting Button */}
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate('/meeting/new')}
          className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-white shadow-md transition-colors hover:bg-primary-light active:bg-primary-dark"
        >
          + NUEVA REUNIÓN
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex border-b border-gray-200 px-4">
        <button
          onClick={() => setTab('meetings')}
          className={`flex-1 border-b-2 pb-2 text-sm font-medium transition-colors ${
            tab === 'meetings'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400'
          }`}
        >
          Reuniones
        </button>
        <button
          onClick={() => setTab('suppliers')}
          className={`flex-1 border-b-2 pb-2 text-sm font-medium transition-colors ${
            tab === 'suppliers'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400'
          }`}
        >
          Proveedores
        </button>
        <button
          onClick={() => navigate('/captured-products')}
          className="flex-1 cursor-pointer border-b-2 border-transparent pb-2 text-sm font-medium text-gray-400 transition-colors hover:text-primary"
        >
          ★ Listado Productos
        </button>
        <button
          onClick={() => navigate('/searched-products')}
          className="flex-1 cursor-pointer border-b-2 border-transparent pb-2 text-sm font-medium text-gray-400 transition-colors hover:text-primary"
        >
          🔍 Prod. Buscados
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3">
        {tab === 'meetings' ? (
          <>
            <div className="mb-3 flex gap-2">
              {(['all', 'saved', 'draft'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setMeetingFilter(f)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                    meetingFilter === f ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {f === 'all' ? 'Todas' : f === 'saved' ? 'Guardadas' : 'Borradores'}
                </button>
              ))}
            </div>
            <MeetingsList
              meetings={allMeetings?.filter(m =>
                meetingFilter === 'all' ? true :
                meetingFilter === 'saved' ? m.status === 'saved' :
                m.status === 'draft' || !m.status
              )}
              navigate={navigate}
              currentUser={currentUser}
            />
          </>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setShowNewSupplier(true)}
                className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 py-3 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10"
              >
                + Nuevo proveedor
              </button>
              <button
                onClick={async () => {
                  const all = await db.suppliers.toArray()
                  const rows = all.map(s => ({
                    'Nombre': s.name, 'Stand': s.stand, 'Tipo producto': s.product_type,
                    'Persona asignada': s.assigned_person, 'Emails': s.emails.join(', '),
                    'Teléfono': s.phone, 'Relevancia': s.relevance, 'Visitado': s.visited ? 'Sí' : 'No',
                    'Nuevo': s.is_new ? 'Sí' : 'No', 'Temas pendientes': s.pending_topics,
                    'Notas proveedor': s.supplier_notes,
                  }))
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Proveedores')
                  XLSX.writeFile(wb, `proveedores-${new Date().toISOString().slice(0, 10)}.xlsx`)
                }}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-3 text-xs font-medium text-gray-600"
              >
                Exportar
              </button>
            </div>
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                placeholder="Buscar proveedor o stand..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Filtrar tipo producto..."
                value={productFilter}
                onChange={e => setProductFilter(e.target.value)}
                className="w-40 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <SuppliersTable
              suppliers={suppliers}
              navigate={navigate}
              sortCol={sortCol}
              sortAsc={sortAsc}
              onSort={(col) => {
                if (col === sortCol) setSortAsc(!sortAsc)
                else { setSortCol(col); setSortAsc(true) }
              }}
            />
          </>
        )}
      </div>

      {showNewSupplier && (
        <NewSupplierModal
          currentUser={currentUser}
          onClose={() => setShowNewSupplier(false)}
          onCreated={(id) => { setShowNewSupplier(false); navigate(`/supplier/${id}`) }}
        />
      )}
    </div>
  )
}

function NewSupplierModal({
  currentUser,
  onClose,
  onCreated,
}: {
  currentUser: UserName
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [stand, setStand] = useState('')
  const [productType, setProductType] = useState('')
  const [emails, setEmails] = useState('')
  const [phone, setPhone] = useState('')
  const [assignedPerson, setAssignedPerson] = useState('')
  const [relevance, setRelevance] = useState<Relevance>(2)
  const [pendingTopics, setPendingTopics] = useState('')
  const [supplierNotes, setSupplierNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const id = uuid()
    const now = new Date().toISOString()
    await db.suppliers.add({
      id,
      name: name.trim(),
      stand: stand.trim(),
      assigned_person: assignedPerson.trim() || currentUser,
      product_type: productType.trim(),
      emails: emails.split(',').map(e => e.trim()).filter(Boolean),
      phone: phone.trim(),
      relevance,
      visit_day: '',
      visit_slot: '',
      visited: false,
      pending_topics: pendingTopics.trim(),
      interesting_products: '',
      has_catalogue: false,
      current_products: '',
      supplier_notes: supplierNotes.trim(),
      is_new: true,
      updated_at: now,
      updated_by: currentUser,
      created_at: now,
      synced_at: null,
    })
    onCreated(id)
  }

  const fieldCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Nuevo proveedor</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nombre *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={fieldCls} placeholder="Shenzhen Tech Co." autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Stand</label>
              <input type="text" value={stand} onChange={e => setStand(e.target.value)} className={fieldCls} placeholder="3F-A12" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Tipo de productos</label>
              <input type="text" value={productType} onChange={e => setProductType(e.target.value)} className={fieldCls} placeholder="LED, cables..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Persona asignada</label>
              <input type="text" value={assignedPerson} onChange={e => setAssignedPerson(e.target.value)} className={fieldCls} placeholder={currentUser} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Relevancia</label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map(r => (
                  <button key={r} type="button" onClick={() => setRelevance(r)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${relevance === r
                      ? r === 1 ? 'bg-red-500 text-white' : r === 2 ? 'bg-yellow-400 text-white' : 'bg-gray-400 text-white'
                      : 'bg-gray-100 text-gray-400'
                    }`}>{r}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Email(s) — separados por coma</label>
            <input type="text" value={emails} onChange={e => setEmails(e.target.value)} className={fieldCls} placeholder="sales@company.com" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Teléfono</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={fieldCls} placeholder="+86 ..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Temas pendientes <span className="font-normal text-gray-400">— incidencias o temas a tratar</span></label>
            <textarea value={pendingTopics} onChange={e => setPendingTopics(e.target.value)} rows={2} className={fieldCls} placeholder="Reclamación pendiente, revisar precios..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Notas del proveedor <span className="font-normal text-gray-400">— datos internos</span></label>
            <textarea value={supplierNotes} onChange={e => setSupplierNotes(e.target.value)} rows={2} className={fieldCls} placeholder="Fábrica propia, buen servicio posventa..." />
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="mt-1 w-full rounded-lg bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark disabled:opacity-50">
            {saving ? 'Creando...' : 'Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SyncIndicator({ status }: { status: string }) {
  const config = {
    synced: { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500', label: 'Sincronizado' },
    pending: { bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-400', label: 'Sincronizando...' },
    error: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: 'Error sync' },
    offline: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'Offline' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'Offline' }

  return (
    <div className={`flex items-center gap-1 rounded-full ${config.bg} px-2 py-1 text-xs ${config.text}`}>
      <div className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </div>
  )
}

function MeetingsList({
  meetings,
  navigate,
  currentUser,
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
    supplier?: { name: string; stand: string } | undefined
  }> | undefined
  navigate: (path: string) => void
  currentUser: string
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  if (!meetings || meetings.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-4xl">📋</p>
        <p className="mt-2">No hay reuniones</p>
        <p className="text-xs">Pulsa "NUEVA REUNIÓN" para empezar</p>
      </div>
    )
  }

  async function handleDelete(meetingId: string) {
    if (!window.confirm('¿Eliminar esta reunión y todos sus productos?')) return
    await db.products.where('meeting_id').equals(meetingId).delete()
    await db.meetings.delete(meetingId)
    setOpenMenu(null)
  }

  async function handleDuplicate(m: typeof meetings extends (infer T)[] | undefined ? T : never) {
    const newId = uuid()
    const now = new Date().toISOString()
    await db.meetings.add({
      id: newId,
      supplier_id: m.supplier_id,
      user_name: currentUser as 'Carlos' | 'Jesús' | 'Jose Luis',
      location: (m.location as 'feria' | 'hotel') || 'feria',
      status: 'draft',
      visited_at: now,
      urgent_notes: m.urgent_notes || '',
      other_notes: m.other_notes || '',
      business_card_photo_url: m.business_card_photo_url || '',
      email_generated: false,
      email_sent_at: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
    // Duplicate products
    const products = await db.products.where('meeting_id').equals(m.id).toArray()
    for (const p of products) {
      await db.products.add({ ...p, id: uuid(), meeting_id: newId, created_at: now })
    }
    setOpenMenu(null)
    navigate(`/meeting/${newId}?edit=1`)
  }

  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[650px] text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-2 py-2 text-left font-semibold text-gray-500">Fecha</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-500">Hora</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-500">Proveedor</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-500">Persona</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-500">Productos</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-500">Email</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-500 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {meetings.map(m => {
            const isDraft = m.status === 'draft' || !m.status
            const dateStr = new Date(m.visited_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
            const timeStr = new Date(m.visited_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

            return (
              <tr
                key={m.id}
                onClick={() => navigate(`/meeting/${m.id}`)}
                className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50 ${
                  isDraft ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <td className="px-2 py-2.5 text-gray-600">
                  <div className="flex items-center gap-1">
                    {dateStr}
                    {isDraft && <span className="rounded bg-yellow-100 px-1 py-0.5 text-[9px] font-medium text-yellow-700">B</span>}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-gray-600">{timeStr}</td>
                <td className="px-2 py-2.5 font-medium text-gray-800">{m.supplier?.name || '—'}</td>
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
                        <button onClick={() => { setOpenMenu(null); navigate(`/meeting/${m.id}?edit=1`) }}
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
  )
}

interface EnrichedSupplier {
  id: string
  name: string
  product_type: string
  stand: string
  relevance: number
  is_new: boolean
  visited_feria: boolean
  visited_hotel: boolean
}

function SuppliersTable({
  suppliers,
  navigate,
  sortCol,
  sortAsc,
  onSort,
}: {
  suppliers: EnrichedSupplier[] | undefined
  navigate: ReturnType<typeof useNavigate>
  sortCol: string
  sortAsc: boolean
  onSort: (col: string) => void
}) {
  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-4xl">🏭</p>
        <p className="mt-2">No hay proveedores</p>
        <p className="text-xs">Importa desde Excel en Ajustes</p>
      </div>
    )
  }

  const sorted = [...suppliers].sort((a, b) => {
    let cmp = 0
    switch (sortCol) {
      case 'name': cmp = a.name.localeCompare(b.name); break
      case 'product_type': cmp = a.product_type.localeCompare(b.product_type); break
      case 'stand': cmp = a.stand.localeCompare(b.stand); break
      case 'relevance': cmp = a.relevance - b.relevance; break
      case 'is_new': cmp = (a.is_new ? 1 : 0) - (b.is_new ? 1 : 0); break
      case 'visited_feria': cmp = (a.visited_feria ? 1 : 0) - (b.visited_feria ? 1 : 0); break
      case 'visited_hotel': cmp = (a.visited_hotel ? 1 : 0) - (b.visited_hotel ? 1 : 0); break
    }
    return sortAsc ? cmp : -cmp
  })

  const columns: { key: string; label: string; cls?: string }[] = [
    { key: 'name', label: 'Proveedor', cls: 'text-left' },
    { key: 'product_type', label: 'Tipo', cls: 'text-left' },
    { key: 'stand', label: 'Stand', cls: 'text-left' },
    { key: 'relevance', label: 'Rel', cls: 'text-center w-10' },
    { key: 'is_new', label: 'Nuevo', cls: 'text-center w-14' },
    { key: 'visited_feria', label: 'V.Feria', cls: 'text-center w-16' },
    { key: 'visited_hotel', label: 'V.Hotel', cls: 'text-center w-16' },
  ]

  const arrow = (col: string) =>
    sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''

  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[600px] text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columns.map(c => (
              <th
                key={c.key}
                onClick={() => onSort(c.key)}
                className={`cursor-pointer whitespace-nowrap px-3 py-2 font-semibold text-gray-500 hover:text-primary ${c.cls || ''}`}
              >
                {c.label}{arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => (
            <tr
              key={s.id}
              onClick={() => navigate(`/supplier/${s.id}`)}
              className="cursor-pointer border-b border-gray-100 bg-white transition-colors hover:bg-blue-50"
            >
              <td className="px-3 py-2.5 font-medium text-gray-800">{s.name}</td>
              <td className="px-3 py-2.5 text-gray-500">{s.product_type || '—'}</td>
              <td className="px-3 py-2.5 text-gray-500">{s.stand || '—'}</td>
              <td className="px-3 py-2.5 text-center">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  s.relevance === 1 ? 'bg-red-100 text-red-700' :
                  s.relevance === 2 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {s.relevance}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center">{s.is_new ? 'S' : 'N'}</td>
              <td className="px-3 py-2.5 text-center">
                {s.visited_feria
                  ? <span className="text-green-600 font-bold">S</span>
                  : <span className="text-gray-300">N</span>}
              </td>
              <td className="px-3 py-2.5 text-center">
                {s.visited_hotel
                  ? <span className="text-green-600 font-bold">S</span>
                  : <span className="text-gray-300">N</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
