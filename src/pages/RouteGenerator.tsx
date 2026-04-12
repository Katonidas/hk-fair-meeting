import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import { USERS } from '@/lib/constants'
import type { RouteFilters, SavedRoute, Supplier } from '@/types'

const DEFAULT_FILTERS: RouteFilters = {
  search: '',
  assignedPerson: '',
  visitDay: '',
  visitSlot: '',
  minRelevance: null,
  visitedStatus: null,
  productType: '',
  sortBy: 'name',
}

/**
 * Generador de ruta. Aplica filtros sobre la lista de proveedores y permite
 * guardar la combinación de filtros con un nombre para reutilizarla luego.
 *
 * Las rutas guardadas se persisten en Dexie (tabla `saved_routes`).
 */
export default function RouteGenerator() {
  const navigate = useNavigate()

  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_FILTERS)
  const [showSaved, setShowSaved] = useState(false)
  const [savingName, setSavingName] = useState<string | null>(null)

  const allSuppliers = useLiveQuery(() => db.suppliers.toArray(), [])
  const savedRoutes = useLiveQuery(
    () => db.saved_routes.orderBy('updated_at').reverse().toArray(),
    [],
  )

  // Lista única de días y slots disponibles, derivada de los datos.
  const availableDays = useMemo(
    () => uniqueValues(allSuppliers, s => s.visit_day),
    [allSuppliers],
  )
  const availableSlots = useMemo(
    () => uniqueValues(allSuppliers, s => s.visit_slot),
    [allSuppliers],
  )
  const availableProductTypes = useMemo(
    () => uniqueValues(allSuppliers, s => s.product_type),
    [allSuppliers],
  )

  // Aplica los filtros y la ordenación al listado completo.
  const filtered = useMemo(() => {
    if (!allSuppliers) return []
    return applyFilters(allSuppliers, filters)
  }, [allSuppliers, filters])

  function updateFilter<K extends keyof RouteFilters>(key: K, value: RouteFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  async function handleSaveRoute() {
    const name = window.prompt('Nombre de la ruta:', savingName ?? '')
    if (!name || !name.trim()) return
    const now = new Date().toISOString()
    const route: SavedRoute = {
      id: uuid(),
      name: name.trim(),
      filters,
      created_at: now,
      updated_at: now,
    }
    try {
      await db.saved_routes.add(route)
      setSavingName(name.trim())
      window.alert(`Ruta "${name.trim()}" guardada.`)
    } catch (err) {
      console.error('[saveRoute]', err)
      window.alert('No se pudo guardar la ruta.')
    }
  }

  function loadRoute(route: SavedRoute) {
    setFilters(route.filters)
    setSavingName(route.name)
    setShowSaved(false)
  }

  async function deleteRoute(route: SavedRoute, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar la ruta "${route.name}"?`)) return
    await db.saved_routes.delete(route.id)
  }

  // Detectar si los filtros están en su estado por defecto. Solo
  // habilitamos el botón GUARDAR cuando hay al menos un filtro activo.
  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.assignedPerson !== '' ||
    filters.visitDay !== '' ||
    filters.visitSlot !== '' ||
    filters.minRelevance !== null ||
    filters.visitedStatus !== null ||
    filters.productType.trim() !== '' ||
    filters.sortBy !== 'name'

  return (
    <div className="flex min-h-screen flex-col bg-gray-light pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg p-3 text-gray-500 hover:bg-gray-100"
              aria-label="Volver al inicio"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-800">Generador de ruta</h1>
          </div>
          <button
            onClick={() => setShowSaved(s => !s)}
            className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            Rutas guardadas {savedRoutes ? `(${savedRoutes.length})` : ''} ▾
          </button>
        </div>

        {/* Dropdown de rutas guardadas */}
        {showSaved && (
          <div className="mx-auto mt-2 max-w-3xl">
            <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-md">
              {savedRoutes && savedRoutes.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {savedRoutes.map(r => (
                    <button
                      key={r.id}
                      onClick={() => loadRoute(r)}
                      className="flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{r.name}</p>
                        <p className="text-xs text-gray-400">{summarizeFilters(r.filters)}</p>
                      </div>
                      <button
                        onClick={e => deleteRoute(r, e)}
                        className="ml-2 rounded p-2 text-red-500 hover:bg-red-50"
                        aria-label={`Eliminar ruta ${r.name}`}
                      >
                        ✕
                      </button>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-4 text-center text-sm text-gray-400">
                  Aún no hay rutas guardadas. Aplica filtros y pulsa GUARDAR.
                </p>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
        {/* Filtros */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Filtros</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <FilterField label="Búsqueda libre">
              <input
                type="search"
                value={filters.search}
                onChange={e => updateFilter('search', e.target.value)}
                placeholder="Nombre, stand..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </FilterField>
            <FilterField label="Persona asignada">
              <select
                value={filters.assignedPerson}
                onChange={e => updateFilter('assignedPerson', e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Todos</option>
                {USERS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
                <option value="Todos">Todos (etiqueta)</option>
              </select>
            </FilterField>
            <FilterField label="Día de visita">
              <select
                value={filters.visitDay}
                onChange={e => updateFilter('visitDay', e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Todos</option>
                {availableDays.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Slot de visita">
              <select
                value={filters.visitSlot}
                onChange={e => updateFilter('visitSlot', e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Todos</option>
                {availableSlots.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Tipo de producto">
              <select
                value={filters.productType}
                onChange={e => updateFilter('productType', e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Todos</option>
                {availableProductTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Ordenar por">
              <select
                value={filters.sortBy}
                onChange={e => updateFilter('sortBy', e.target.value as RouteFilters['sortBy'])}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="name">Nombre (A-Z)</option>
                <option value="stand">Stand (A-Z)</option>
                <option value="relevance">Relevancia (mayor a menor)</option>
              </select>
            </FilterField>
            <FilterField label="Relevancia mínima">
              <div className="flex gap-2">
                {([null, 1, 2, 3] as const).map(r => (
                  <button
                    key={r ?? 'all'}
                    type="button"
                    onClick={() => updateFilter('minRelevance', r)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium ${
                      filters.minRelevance === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {r === null ? 'Todas' : '★'.repeat(r)}
                  </button>
                ))}
              </div>
            </FilterField>
            <FilterField label="Estado de visita">
              <div className="flex gap-2">
                {([null, 'not_visited', 'visited'] as const).map(v => (
                  <button
                    key={v ?? 'all'}
                    type="button"
                    onClick={() => updateFilter('visitedStatus', v)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium ${
                      filters.visitedStatus === v ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {v === null ? 'Todos' : v === 'visited' ? 'Visitados' : 'Pendientes'}
                  </button>
                ))}
              </div>
            </FilterField>
          </div>

          {/* Acciones de filtros */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={clearFilters}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Limpiar filtros
            </button>
            <button
              onClick={handleSaveRoute}
              className="ml-auto rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-light disabled:opacity-50"
            >
              GUARDAR RUTA
            </button>
          </div>
          {!hasActiveFilters && (
            <p className="mt-2 text-xs text-gray-400">
              Tip: aplica al menos un filtro para que la ruta guardada tenga sentido.
            </p>
          )}
        </div>

        {/* Resultado */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Resultado ({filtered.length} {filtered.length === 1 ? 'proveedor' : 'proveedores'})
          </h2>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Ningún proveedor cumple los filtros.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/supplier/${s.id}`)}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
                >
                  <div className={`h-3 w-3 rounded-full ${s.visited ? 'bg-green-500' : 'bg-yellow-400'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{s.name}</p>
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function uniqueValues(suppliers: Supplier[] | undefined, getter: (s: Supplier) => string): string[] {
  if (!suppliers) return []
  const set = new Set<string>()
  for (const s of suppliers) {
    const v = getter(s).trim()
    if (v) set.add(v)
  }
  return Array.from(set).sort()
}

function applyFilters(suppliers: Supplier[], f: RouteFilters): Supplier[] {
  const q = f.search.trim().toLowerCase()
  const filtered = suppliers.filter(s => {
    if (q) {
      const haystack = `${s.name} ${s.stand} ${s.product_type}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (f.assignedPerson && s.assigned_person !== f.assignedPerson) return false
    if (f.visitDay && s.visit_day !== f.visitDay) return false
    if (f.visitSlot && s.visit_slot !== f.visitSlot) return false
    if (f.productType && s.product_type !== f.productType) return false
    if (f.minRelevance !== null && s.relevance > f.minRelevance) return false
    if (f.visitedStatus === 'visited' && !s.visited) return false
    if (f.visitedStatus === 'not_visited' && s.visited) return false
    return true
  })

  // Ordenación.
  filtered.sort((a, b) => {
    if (f.sortBy === 'stand') return a.stand.localeCompare(b.stand)
    if (f.sortBy === 'relevance') return a.relevance - b.relevance
    return a.name.localeCompare(b.name)
  })

  return filtered
}

function summarizeFilters(f: RouteFilters): string {
  const parts: string[] = []
  if (f.search) parts.push(`"${f.search}"`)
  if (f.assignedPerson) parts.push(f.assignedPerson)
  if (f.visitDay) parts.push(f.visitDay)
  if (f.visitSlot) parts.push(f.visitSlot)
  if (f.productType) parts.push(f.productType)
  if (f.minRelevance !== null) parts.push(`★≤${f.minRelevance}`)
  if (f.visitedStatus === 'visited') parts.push('visitados')
  if (f.visitedStatus === 'not_visited') parts.push('pendientes')
  return parts.length > 0 ? parts.join(' · ') : 'sin filtros'
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}
