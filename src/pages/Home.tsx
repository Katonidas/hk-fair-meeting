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

  const suppliers = useLiveQuery(async () => {
    const all = await db.suppliers.toArray()
    if (!search) return all.sort((a, b) => a.name.localeCompare(b.name))
    const q = search.toLowerCase()
    return all
      .filter(s => s.name.toLowerCase().includes(q) || s.stand.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [search])

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
            <input
              type="text"
              placeholder="Buscar proveedor o stand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
            <SuppliersList suppliers={suppliers} navigate={navigate} currentUser={currentUser} />
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

function SuppliersList({
  suppliers,
  navigate,
  currentUser,
}: {
  suppliers: Array<{
    id: string
    name: string
    stand: string
    assigned_person: string
    visited: boolean
    relevance: number
    product_type: string
  }> | undefined
  navigate: ReturnType<typeof useNavigate>
  currentUser: string
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

  return (
    <div className="flex flex-col gap-2">
      {suppliers.map(s => {
        const isMine = s.assigned_person === currentUser || s.assigned_person === 'Todos'
        const statusColor = s.visited
          ? 'bg-green-500'
          : isMine
            ? 'bg-yellow-400'
            : 'bg-gray-300'

        return (
          <button
            key={s.id}
            onClick={() => navigate(`/supplier/${s.id}`)}
            className="flex items-center gap-3 rounded-lg bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
          >
            <div className={`h-3 w-3 rounded-full ${statusColor}`} />
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{s.name}</p>
              <p className="text-xs text-gray-400">
                Stand {s.stand} · {s.product_type || '—'} · {s.assigned_person || 'Sin asignar'}
              </p>
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3].map(i => (
                <span key={i} className={`text-xs ${i <= s.relevance ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
