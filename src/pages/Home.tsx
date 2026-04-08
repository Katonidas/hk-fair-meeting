import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useSync } from '@/hooks/useSync'
import type { UserName } from '@/types'

interface Props {
  currentUser: UserName
  onLogout: () => void
}

type Tab = 'meetings' | 'suppliers'

export default function Home({ currentUser, onLogout }: Props) {
  const syncStatus = useSync()
  const [tab, setTab] = useState<Tab>('meetings')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const todayMeetings = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const meetings = await db.meetings
      .where('user_name')
      .equals(currentUser)
      .toArray()
    const todayOnly = meetings.filter(m => m.visited_at.slice(0, 10) === today)
    todayOnly.sort((a, b) => b.visited_at.localeCompare(a.visited_at))

    const enriched = await Promise.all(
      todayOnly.map(async m => {
        const supplier = await db.suppliers.get(m.supplier_id)
        const productCount = await db.products.where('meeting_id').equals(m.id).count()
        return { ...m, supplier, productCount }
      }),
    )
    return enriched
  }, [currentUser])

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
          <div>
            <h1 className="text-lg font-bold text-primary">HK Fair</h1>
            <p className="text-xs text-gray-400">{currentUser}</p>
          </div>
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
          Mis reuniones hoy
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
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3">
        {tab === 'meetings' ? (
          <MeetingsList meetings={todayMeetings} navigate={navigate} />
        ) : (
          <>
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
}: {
  meetings: Array<{
    id: string
    supplier_id: string
    visited_at: string
    productCount: number
    email_generated: boolean
    supplier?: { name: string; stand: string } | undefined
  }> | undefined
  navigate: ReturnType<typeof useNavigate>
}) {
  if (!meetings || meetings.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-4xl">📋</p>
        <p className="mt-2">No hay reuniones hoy</p>
        <p className="text-xs">Pulsa "NUEVA REUNIÓN" para empezar</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {meetings.map(m => (
        <button
          key={m.id}
          onClick={() => navigate(`/meeting/${m.id}`)}
          className="flex items-center justify-between rounded-lg bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
        >
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{m.supplier?.name || 'Proveedor'}</p>
            <p className="text-xs text-gray-400">
              Stand {m.supplier?.stand} · {new Date(m.visited_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {m.productCount} prod
            </span>
            {m.email_generated ? (
              <span className="text-lg text-success">✓</span>
            ) : (
              <span className="text-lg text-warning">⏳</span>
            )}
          </div>
        </button>
      ))}
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
