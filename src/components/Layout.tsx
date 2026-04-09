import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useSync } from '@/hooks/useSync'
import type { UserName } from '@/types'

interface Props {
  currentUser: UserName
  onLogout: () => void
}

type TabKey = 'meetings' | 'suppliers' | 'captured-products' | 'searched-products'

export default function Layout({ currentUser, onLogout }: Props) {
  const syncStatus = useSync()
  const navigate = useNavigate()
  const location = useLocation()

  const searchParams = new URLSearchParams(location.search)
  const tabParam = searchParams.get('tab')

  const activeTab: TabKey =
    location.pathname === '/captured-products'
      ? 'captured-products'
      : location.pathname === '/searched-products'
        ? 'searched-products'
        : location.pathname.startsWith('/supplier')
          ? 'suppliers'
          : location.pathname.startsWith('/meeting')
            ? 'meetings'
            : tabParam === 'suppliers'
              ? 'suppliers'
              : 'meetings'

  const tabCls = (tab: TabKey) =>
    `flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'bg-primary text-white'
        : 'text-gray-400 hover:text-gray-600'
    }`

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
              onClick={() => navigate('/route-planner')}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              title="Planificador Rutas"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </button>
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
          + NUEVA REUNION
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 px-4 pb-2">
        <button onClick={() => navigate('/')} className={tabCls('meetings')}>
          Reuniones
        </button>
        <button onClick={() => navigate('/?tab=suppliers')} className={tabCls('suppliers')}>
          Proveedores
        </button>
        <button onClick={() => navigate('/captured-products')} className={tabCls('captured-products')}>
          <span className="text-yellow-500">&#9733;</span> Listado Productos
        </button>
        <button onClick={() => navigate('/searched-products')} className={tabCls('searched-products')}>
          &#128269; Prod. Deseados
        </button>
      </div>

      {/* Page content */}
      <div className="flex-1">
        <Outlet />
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
