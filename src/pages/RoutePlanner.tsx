import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { areProductTypesRelated } from '@/lib/synonyms'
import type { Supplier } from '@/types'

// --- Stand parsing ---
function parseStand(stand: string): { pavilion: number; aisle: string; number: number } | null {
  const match = stand.match(/^(\d{1,2})([A-Z])(\d{1,3})$/i)
  if (!match) return null
  return { pavilion: parseInt(match[1]), aisle: match[2].toUpperCase(), number: parseInt(match[3]) }
}

// --- Building mapping ---
const BUILDINGS: Record<string, number[]> = {
  'Edificio 1': [3, 6, 8, 10],
  'Edificio 2': [5, 7, 9, 11],
  'Edificio 3': [1],
  'Edificio 4': [2],
}

const BUILDING_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Edificio 1 (Pab. 3,6,8,10)', value: 'Edificio 1' },
  { label: 'Edificio 2 (Pab. 5,7,9,11)', value: 'Edificio 2' },
  { label: 'Edificio 3 (Pab. 1)', value: 'Edificio 3' },
  { label: 'Edificio 4 (Pab. 2)', value: 'Edificio 4' },
]

function getBuilding(pavilion: number): string | null {
  for (const [building, pavilions] of Object.entries(BUILDINGS)) {
    if (pavilions.includes(pavilion)) return building
  }
  return null
}

// --- Types ---
interface EnrichedSupplier {
  supplier: Supplier
  parsed: { pavilion: number; aisle: string; number: number } | null
  building: string | null
  potentialCount: number
  foundCount: number
  score: number
}

type SortKey = 'name' | 'product_type' | 'stand' | 'potential' | 'found'
type SortDir = 'asc' | 'desc'

const STORAGE_KEY = 'hk-fair-saved-route'

export default function RoutePlanner() {
  const navigate = useNavigate()

  // Filters
  const [buildingFilter, setBuildingFilter] = useState('')
  const [productTypeFilter, setProductTypeFilter] = useState('')
  const [currentPosition, setCurrentPosition] = useState('ENTRADA')
  const [priorityMode, setPriorityMode] = useState<'auto' | 'relevance' | 'potential'>('auto')

  // Sort state
  const [visitedSort, setVisitedSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })
  const [pendingSort, setPendingSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })

  // Route state
  const [optimizedRoute, setOptimizedRoute] = useState<string[] | null>(null)
  const [hasSavedRoute, setHasSavedRoute] = useState(false)

  // Check for saved route on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    setHasSavedRoute(!!saved)
  }, [])

  // Data from Dexie
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), [])
  const meetings = useLiveQuery(() => db.meetings.toArray(), [])
  const products = useLiveQuery(() => db.products.toArray(), [])
  const searchedProducts = useLiveQuery(() => db.searched_products.toArray(), [])

  // Compute potential products count per supplier (synonym-aware matching)
  const potentialCounts = useMemo(() => {
    if (!suppliers || !searchedProducts) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const s of suppliers) {
      let count = 0
      for (const sp of searchedProducts) {
        if (sp.candidate_supplier_ids?.includes(s.id)) {
          count++
          continue
        }
        if (!s.product_type) continue
        if (areProductTypesRelated(s.product_type, sp.product_type)) {
          count++
        }
      }
      map.set(s.id, count)
    }
    return map
  }, [suppliers, searchedProducts])

  // Compute found products count per supplier
  const foundCounts = useMemo(() => {
    if (!products || !meetings) return new Map<string, number>()
    const meetingSupplierMap = new Map<string, string>()
    for (const m of meetings) {
      meetingSupplierMap.set(m.id, m.supplier_id)
    }
    const map = new Map<string, number>()
    for (const p of products) {
      const supplierId = p.supplier_id || meetingSupplierMap.get(p.meeting_id)
      if (supplierId) {
        map.set(supplierId, (map.get(supplierId) || 0) + 1)
      }
    }
    return map
  }, [products, meetings])

  // Set of visited supplier IDs (has at least one meeting)
  const visitedSupplierIds = useMemo(() => {
    if (!meetings) return new Set<string>()
    return new Set(meetings.map(m => m.supplier_id))
  }, [meetings])

  // Enrich suppliers
  const enrichedSuppliers = useMemo(() => {
    if (!suppliers) return []
    return suppliers.map(s => {
      const parsed = parseStand(s.stand || '')
      const building = parsed ? getBuilding(parsed.pavilion) : null
      const potentialCount = potentialCounts.get(s.id) || 0
      const foundCount = foundCounts.get(s.id) || 0
      const relevanceScore = s.relevance === 1 ? 30 : s.relevance === 2 ? 20 : 10
      let score: number
      switch (priorityMode) {
        case 'relevance': score = relevanceScore; break
        case 'potential': score = potentialCount; break
        default: score = relevanceScore * 10 + potentialCount * 3; break
      }
      return { supplier: s, parsed, building, potentialCount, foundCount, score }
    })
  }, [suppliers, potentialCounts, foundCounts, priorityMode])

  // Split into visited / pending
  const visited = useMemo(() =>
    enrichedSuppliers.filter(e => visitedSupplierIds.has(e.supplier.id)),
    [enrichedSuppliers, visitedSupplierIds]
  )

  const pending = useMemo(() =>
    enrichedSuppliers.filter(e => !visitedSupplierIds.has(e.supplier.id)),
    [enrichedSuppliers, visitedSupplierIds]
  )

  // Sort helper — numeric stand sorting
  function compareStands(a: EnrichedSupplier, b: EnrichedSupplier): number {
    const ap = a.parsed
    const bp = b.parsed
    if (!ap && !bp) return (a.supplier.stand || '').localeCompare(b.supplier.stand || '')
    if (!ap) return 1
    if (!bp) return -1
    if (ap.pavilion !== bp.pavilion) return ap.pavilion - bp.pavilion
    if (ap.aisle !== bp.aisle) return ap.aisle.localeCompare(bp.aisle)
    return ap.number - bp.number
  }

  function sortList(list: EnrichedSupplier[], sort: { key: SortKey; dir: SortDir }): EnrichedSupplier[] {
    const sorted = [...list]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'name':
          cmp = a.supplier.name.localeCompare(b.supplier.name)
          break
        case 'product_type':
          cmp = (a.supplier.product_type || '').localeCompare(b.supplier.product_type || '')
          break
        case 'stand':
          cmp = compareStands(a, b)
          break
        case 'potential':
          cmp = a.potentialCount - b.potentialCount
          break
        case 'found':
          cmp = a.foundCount - b.foundCount
          break
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return sorted
  }

  // Apply filters to pending for display (non-route mode)
  function applyFilters(list: EnrichedSupplier[]): EnrichedSupplier[] {
    let filtered = list
    if (buildingFilter) {
      const pavilions = BUILDINGS[buildingFilter] || []
      filtered = filtered.filter(e => e.parsed && pavilions.includes(e.parsed.pavilion))
    }
    if (productTypeFilter.trim()) {
      const types = productTypeFilter.split(',').map(t => t.trim()).filter(t => t.length > 0)
      if (types.length > 0) {
        filtered = filtered.filter(e => {
          return types.some(t => areProductTypesRelated(e.supplier.product_type || '', t))
        })
      }
    }
    return filtered
  }

  // Parse current position to determine starting building/pavilion
  function parsePosition(): { pavilion: number; aisle: string } | null {
    const pos = currentPosition.trim().toUpperCase()
    if (!pos || pos === 'ENTRADA') return null
    const match = pos.match(/^(\d{1,2})([A-Z])?$/i)
    if (!match) return null
    return { pavilion: parseInt(match[1]), aisle: match[2] || 'A' }
  }

  // Route optimization
  function generateRoute() {
    const candidates = applyFilters(pending)

    // Group by building
    const buildingGroups = new Map<string, EnrichedSupplier[]>()
    const noBuildingGroup: EnrichedSupplier[] = []
    for (const e of candidates) {
      if (e.building) {
        const group = buildingGroups.get(e.building) || []
        group.push(e)
        buildingGroups.set(e.building, group)
      } else {
        noBuildingGroup.push(e)
      }
    }

    // Score each building
    const buildingScores: { building: string; totalScore: number; items: EnrichedSupplier[] }[] = []
    for (const [building, items] of buildingGroups.entries()) {
      const totalScore = items.reduce((sum, e) => sum + e.score, 0)
      buildingScores.push({ building, totalScore, items })
    }

    // Determine starting building from position
    const startPos = parsePosition()
    const startBuilding = startPos ? getBuilding(startPos.pavilion) : null

    // Sort buildings: starting building first, then by score descending
    buildingScores.sort((a, b) => {
      if (startBuilding) {
        if (a.building === startBuilding && b.building !== startBuilding) return -1
        if (b.building === startBuilding && a.building !== startBuilding) return 1
      }
      return b.totalScore - a.totalScore
    })

    // Within each building, sort by pavilion order
    const routeIds: string[] = []
    for (const bg of buildingScores) {
      const pavilionOrder = BUILDINGS[bg.building] || []

      // Determine direction based on starting position or scores
      let orderedPavilions: number[]
      if (startPos && bg.building === startBuilding) {
        // Start from the pavilion closest to our position
        const startPavIdx = pavilionOrder.indexOf(startPos.pavilion)
        if (startPavIdx >= 0) {
          // If near the end (high index), go reverse
          orderedPavilions = startPavIdx >= pavilionOrder.length / 2
            ? [...pavilionOrder].reverse()
            : [...pavilionOrder]
        } else {
          orderedPavilions = [...pavilionOrder]
        }
      } else {
        // Default: check which end has higher scores
        const firstPavScore = bg.items
          .filter(e => e.parsed && e.parsed.pavilion === pavilionOrder[0])
          .reduce((s, e) => s + e.score, 0)
        const lastPavScore = bg.items
          .filter(e => e.parsed && e.parsed.pavilion === pavilionOrder[pavilionOrder.length - 1])
          .reduce((s, e) => s + e.score, 0)

        orderedPavilions = lastPavScore > firstPavScore
          ? [...pavilionOrder].reverse()
          : [...pavilionOrder]
      }

      // Sort items within building: by pavilion order, then aisle, then stand number
      const pavIndex = new Map<number, number>()
      orderedPavilions.forEach((p, i) => pavIndex.set(p, i))

      bg.items.sort((a, b) => {
        const aPavIdx = a.parsed ? (pavIndex.get(a.parsed.pavilion) ?? 999) : 999
        const bPavIdx = b.parsed ? (pavIndex.get(b.parsed.pavilion) ?? 999) : 999
        if (aPavIdx !== bPavIdx) return aPavIdx - bPavIdx
        const aAisle = a.parsed?.aisle || ''
        const bAisle = b.parsed?.aisle || ''
        if (aAisle !== bAisle) return aAisle.localeCompare(bAisle)
        const aNum = a.parsed?.number ?? 0
        const bNum = b.parsed?.number ?? 0
        return aNum - bNum
      })

      for (const e of bg.items) {
        routeIds.push(e.supplier.id)
      }
    }

    // Append suppliers without building at the end
    noBuildingGroup.sort((a, b) => b.score - a.score)
    for (const e of noBuildingGroup) {
      routeIds.push(e.supplier.id)
    }

    setOptimizedRoute(routeIds)
  }

  function saveRoute() {
    if (!optimizedRoute) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(optimizedRoute))
    setHasSavedRoute(true)
  }

  function loadRoute() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setOptimizedRoute(JSON.parse(saved))
      } catch {
        // ignore invalid JSON
      }
    }
  }

  // Get the pending list to display (with route ordering or sort)
  const displayPending = useMemo(() => {
    if (optimizedRoute) {
      // Show in route order, but only items that are still pending
      const pendingMap = new Map(pending.map(e => [e.supplier.id, e]))
      const ordered: EnrichedSupplier[] = []
      for (const id of optimizedRoute) {
        const e = pendingMap.get(id)
        if (e) ordered.push(e)
      }
      // Add any pending not in route at end
      for (const e of pending) {
        if (!optimizedRoute.includes(e.supplier.id)) {
          ordered.push(e)
        }
      }
      return ordered
    }
    return sortList(applyFilters(pending), pendingSort)
  }, [optimizedRoute, pending, pendingSort, buildingFilter, productTypeFilter])

  const displayVisited = useMemo(() =>
    sortList(applyFilters(visited), visitedSort),
    [visited, visitedSort, buildingFilter, productTypeFilter]
  )

  // Toggle sort
  function toggleSort(
    current: { key: SortKey; dir: SortDir },
    setter: (v: { key: SortKey; dir: SortDir }) => void,
    key: SortKey
  ) {
    if (current.key === key) {
      setter({ key, dir: current.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      setter({ key, dir: 'asc' })
    }
  }

  if (!suppliers || !meetings || !products || !searchedProducts) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-light">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-primary">PLANIFICADOR DE RUTAS</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Edificio</label>
              <select
                value={buildingFilter}
                onChange={e => { setBuildingFilter(e.target.value); setOptimizedRoute(null) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {BUILDING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Tipo producto (separar por coma)</label>
              <input
                type="text"
                value={productTypeFilter}
                onChange={e => { setProductTypeFilter(e.target.value); setOptimizedRoute(null) }}
                placeholder="ej: lampara, mesa, silla"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Posicion actual</label>
              <input
                type="text"
                value={currentPosition}
                onChange={e => { setCurrentPosition(e.target.value); setOptimizedRoute(null) }}
                placeholder="Ej: 10A, 3F, ENTRADA"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Priorizar</label>
              <select
                value={priorityMode}
                onChange={e => { setPriorityMode(e.target.value as 'auto' | 'relevance' | 'potential'); setOptimizedRoute(null) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="auto">Automatico</option>
                <option value="relevance">Importancia proveedor</option>
                <option value="potential">Productos potenciales</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={generateRoute}
            className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow hover:bg-primary-light active:bg-primary-dark"
          >
            GENERAR RUTA
          </button>
          <button
            onClick={saveRoute}
            disabled={!optimizedRoute}
            className="whitespace-nowrap rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary shadow hover:bg-primary hover:text-white disabled:border-gray-300 disabled:text-gray-300 disabled:hover:bg-white"
          >
            Guardar ruta
          </button>
          {hasSavedRoute && (
            <button
              onClick={loadRoute}
              className="whitespace-nowrap rounded-lg border border-yellow-500 px-4 py-2 text-sm font-medium text-yellow-600 shadow hover:bg-yellow-500 hover:text-white"
            >
              Cargar ruta
            </button>
          )}
        </div>
        {optimizedRoute && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ruta optimizada generada — {optimizedRoute.length} proveedores pendientes
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 px-4 py-3 text-sm">
        <span className="rounded-full bg-green-100 px-3 py-1 text-green-700 font-medium">
          Visitados: {displayVisited.length}
        </span>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700 font-medium">
          Pendientes: {displayPending.length}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 pb-2 text-[11px]">
        <span className="font-medium text-gray-500">Relevancia:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-red-100 border border-red-300"></span> <span className="text-red-700 font-bold">IMPRESCINDIBLE</span></span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-yellow-100 border border-yellow-300"></span> <span className="text-yellow-700 font-bold">IMPORTANTE</span></span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-gray-100 border border-gray-300"></span> <span className="text-gray-500 font-bold">OPCIONAL</span></span>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col gap-4 px-4 pb-8 lg:flex-row">
        {/* Visited panel */}
        <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-green-50 px-4 py-2.5">
            <h2 className="text-sm font-bold text-green-800">VISITADOS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <ThBtn label="Proveedor" sortKey="name" sortState={visitedSort} toggle={(k) => toggleSort(visitedSort, setVisitedSort, k)} />
                  <ThBtn label="Tipo Prod." sortKey="product_type" sortState={visitedSort} toggle={(k) => toggleSort(visitedSort, setVisitedSort, k)} />
                  <ThBtn label="Stand" sortKey="stand" sortState={visitedSort} toggle={(k) => toggleSort(visitedSort, setVisitedSort, k)} />
                  <ThBtn label="Pot." sortKey="potential" sortState={visitedSort} toggle={(k) => toggleSort(visitedSort, setVisitedSort, k)} />
                  <ThBtn label="Enc." sortKey="found" sortState={visitedSort} toggle={(k) => toggleSort(visitedSort, setVisitedSort, k)} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayVisited.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin proveedores visitados</td></tr>
                ) : displayVisited.map(e => {
                  const relevanceBgV = e.supplier.relevance === 1
                    ? 'bg-red-50 border-l-4 border-l-red-400'
                    : e.supplier.relevance === 2
                      ? 'bg-yellow-50 border-l-4 border-l-yellow-400'
                      : 'bg-gray-50/50 border-l-4 border-l-gray-200'
                  return (
                  <tr
                    key={e.supplier.id}
                    className={`cursor-pointer hover:bg-blue-50 ${relevanceBgV}`}
                    onClick={() => navigate(`/supplier/${e.supplier.id}`)}
                  >
                    <td className="px-3 py-2 font-medium text-gray-800">{e.supplier.name}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{e.supplier.product_type}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">{e.supplier.stand}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{e.potentialCount}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{e.foundCount}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending panel */}
        <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-orange-50 px-4 py-2.5">
            <h2 className="text-sm font-bold text-orange-800">
              PENDIENTES
              {optimizedRoute && ' (RUTA OPTIMIZADA)'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {optimizedRoute && (
                    <th className="px-3 py-2 text-xs font-medium text-gray-500">#</th>
                  )}
                  <ThBtn label="Proveedor" sortKey="name" sortState={pendingSort} toggle={(k) => { toggleSort(pendingSort, setPendingSort, k); setOptimizedRoute(null) }} />
                  <ThBtn label="Tipo Prod." sortKey="product_type" sortState={pendingSort} toggle={(k) => { toggleSort(pendingSort, setPendingSort, k); setOptimizedRoute(null) }} />
                  <ThBtn label="Stand" sortKey="stand" sortState={pendingSort} toggle={(k) => { toggleSort(pendingSort, setPendingSort, k); setOptimizedRoute(null) }} />
                  <ThBtn label="Pot." sortKey="potential" sortState={pendingSort} toggle={(k) => { toggleSort(pendingSort, setPendingSort, k); setOptimizedRoute(null) }} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayPending.length === 0 ? (
                  <tr><td colSpan={optimizedRoute ? 5 : 4} className="px-4 py-6 text-center text-gray-400">Sin proveedores pendientes</td></tr>
                ) : displayPending.map((e, idx) => {
                  const relevanceBg = e.supplier.relevance === 1
                    ? 'bg-red-50 border-l-4 border-l-red-400'
                    : e.supplier.relevance === 2
                      ? 'bg-yellow-50 border-l-4 border-l-yellow-400'
                      : 'bg-gray-50/50 border-l-4 border-l-gray-200'
                  return (
                    <tr
                      key={e.supplier.id}
                      className={`cursor-pointer hover:bg-blue-50 ${relevanceBg}`}
                      onClick={() => navigate(`/supplier/${e.supplier.id}`)}
                    >
                      {optimizedRoute && (
                        <td className="px-3 py-2 text-center text-xs font-bold text-primary">{idx + 1}</td>
                      )}
                      <td className="px-3 py-2 font-medium text-gray-800">{e.supplier.name}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{e.supplier.product_type}</td>
                      <td className="px-3 py-2 text-gray-500 font-mono text-xs">{e.supplier.stand}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{e.potentialCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sortable table header button
function ThBtn({
  label,
  sortKey,
  sortState,
  toggle,
}: {
  label: string
  sortKey: SortKey
  sortState: { key: SortKey; dir: SortDir }
  toggle: (key: SortKey) => void
}) {
  const active = sortState.key === sortKey
  const arrow = active ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : ''
  return (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-xs font-medium whitespace-nowrap ${
        active ? 'text-primary' : 'text-gray-500'
      } hover:text-primary`}
      onClick={() => toggle(sortKey)}
    >
      {label}{arrow}
    </th>
  )
}
