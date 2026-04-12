import { supabase, isSupabaseConfigured } from './supabase'
import { db } from './db'
import type { Supplier, Meeting, Product } from '@/types'

// =============================================================================
// SYNC ENGINE — Dexie (offline-first) ↔ Supabase
// =============================================================================
//
// Estrategia (minimal viable):
//
// PUSH:
//   - Por cada tabla, recoger los registros con `updated_at > synced_at`
//     (o `synced_at === null` para registros nuevos).
//   - upsert() en Supabase.
//   - En caso de éxito, marcar `synced_at = now` localmente.
//
// PULL:
//   - Recoger los registros remotos con `updated_at > lastPullAt`.
//   - put() en Dexie (last-write-wins basado en updated_at).
//
// CONFLICT RESOLUTION:
//   - Last-write-wins por updated_at. No hay merge a nivel de campo.
//   - Asumimos que los 4 usuarios del equipo APPROX no editan el mismo
//     registro a la vez. Si pasa, gana el último que sincroniza.
//
// El `lastPullAt` se guarda en localStorage por tabla.
//
// LIMITACIONES CONOCIDAS:
//   - No sincroniza eliminaciones (las deletes locales NO se propagan).
//     Para hacerlo bien haría falta una tabla de tombstones — fuera de scope.
//   - No sincroniza fotos (product_photos) — pendiente, requiere Supabase Storage.
//
// =============================================================================

const LAST_PULL_KEY_PREFIX = 'hk-fair-last-pull-'

export type SyncStatus =
  | { state: 'idle'; lastSyncAt: string | null }
  | { state: 'syncing' }
  | { state: 'error'; error: string; lastSyncAt: string | null }
  | { state: 'offline' }

type SyncListener = (status: SyncStatus) => void

let currentStatus: SyncStatus = { state: 'idle', lastSyncAt: null }
const listeners = new Set<SyncListener>()

function setStatus(next: SyncStatus) {
  currentStatus = next
  listeners.forEach(l => l(next))
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function subscribeSync(listener: SyncListener): () => void {
  listeners.add(listener)
  listener(currentStatus)
  return () => {
    listeners.delete(listener)
  }
}

function getLastPullAt(table: string): string {
  return localStorage.getItem(LAST_PULL_KEY_PREFIX + table) || '1970-01-01T00:00:00.000Z'
}

function setLastPullAt(table: string, isoDate: string): void {
  localStorage.setItem(LAST_PULL_KEY_PREFIX + table, isoDate)
}

// -----------------------------------------------------------------------------
// Push helpers — uno por tabla, casi idénticos pero tipados
// -----------------------------------------------------------------------------

async function pushSuppliers(): Promise<number> {
  const dirty = await db.suppliers
    .filter(s => s.synced_at === null || s.updated_at > (s.synced_at ?? ''))
    .toArray()
  if (dirty.length === 0) return 0

  const { error } = await supabase.from('suppliers').upsert(dirty, { onConflict: 'id' })
  if (error) throw new Error(`push suppliers: ${error.message}`)

  const now = new Date().toISOString()
  await db.suppliers.bulkPut(dirty.map(s => ({ ...s, synced_at: now })))
  return dirty.length
}

async function pushMeetings(): Promise<number> {
  const dirty = await db.meetings
    .filter(m => m.synced_at === null || m.updated_at > (m.synced_at ?? ''))
    .toArray()
  if (dirty.length === 0) return 0

  const { error } = await supabase.from('meetings').upsert(dirty, { onConflict: 'id' })
  if (error) throw new Error(`push meetings: ${error.message}`)

  const now = new Date().toISOString()
  await db.meetings.bulkPut(dirty.map(m => ({ ...m, synced_at: now })))
  return dirty.length
}

async function pushProducts(): Promise<number> {
  // Products no tiene synced_at en el tipo actual, así que usamos un enfoque
  // distinto: subimos siempre todos los productos (idempotente vía upsert).
  // Si en el futuro hay miles, añadir synced_at al schema y filtrar.
  const all = await db.products.toArray()
  if (all.length === 0) return 0

  const { error } = await supabase.from('products').upsert(all, { onConflict: 'id' })
  if (error) throw new Error(`push products: ${error.message}`)
  return all.length
}

// -----------------------------------------------------------------------------
// Pull helpers
// -----------------------------------------------------------------------------

async function pullSuppliers(): Promise<number> {
  const lastPull = getLastPullAt('suppliers')
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .gt('updated_at', lastPull)

  if (error) throw new Error(`pull suppliers: ${error.message}`)
  if (!data || data.length === 0) return 0

  const now = new Date().toISOString()
  const rows: Supplier[] = data.map(r => ({ ...r, synced_at: now }))
  await db.suppliers.bulkPut(rows)

  const maxUpdated = data.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), lastPull)
  setLastPullAt('suppliers', maxUpdated)
  return data.length
}

async function pullMeetings(): Promise<number> {
  const lastPull = getLastPullAt('meetings')
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .gt('updated_at', lastPull)

  if (error) throw new Error(`pull meetings: ${error.message}`)
  if (!data || data.length === 0) return 0

  const now = new Date().toISOString()
  const rows: Meeting[] = data.map(r => ({ ...r, synced_at: now }))
  await db.meetings.bulkPut(rows)

  const maxUpdated = data.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), lastPull)
  setLastPullAt('meetings', maxUpdated)
  return data.length
}

async function pullProducts(): Promise<number> {
  // Products no tiene updated_at en el schema actual — usamos created_at.
  const lastPull = getLastPullAt('products')
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .gt('created_at', lastPull)

  if (error) throw new Error(`pull products: ${error.message}`)
  if (!data || data.length === 0) return 0

  const rows: Product[] = data
  await db.products.bulkPut(rows)

  const maxCreated = data.reduce((max, r) => (r.created_at > max ? r.created_at : max), lastPull)
  setLastPullAt('products', maxCreated)
  return data.length
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export interface SyncDiagnosis {
  configured: boolean
  online: boolean
  reachable: boolean
  tables: {
    suppliers: 'ok' | { error: string }
    meetings: 'ok' | { error: string }
    products: 'ok' | { error: string }
  }
  localCounts: {
    suppliers: number
    meetings: number
    products: number
  }
  pendingPush: {
    suppliers: number
    meetings: number
  }
  lastPullAt: {
    suppliers: string
    meetings: string
    products: string
  }
}

/**
 * Diagnostico completo del sync. Devuelve un objeto con TODA la info que
 * necesitas para entender por qué los datos no aparecen en el otro
 * dispositivo. Mostrar en Settings con un botón "Probar conexión".
 */
export async function diagnoseSync(): Promise<SyncDiagnosis> {
  const localCounts = {
    suppliers: await db.suppliers.count(),
    meetings: await db.meetings.count(),
    products: await db.products.count(),
  }

  const dirtySuppliers = await db.suppliers
    .filter(s => s.synced_at === null || s.updated_at > (s.synced_at ?? ''))
    .count()
  const dirtyMeetings = await db.meetings
    .filter(m => m.synced_at === null || m.updated_at > (m.synced_at ?? ''))
    .count()

  const lastPullAt = {
    suppliers: getLastPullAt('suppliers'),
    meetings: getLastPullAt('meetings'),
    products: getLastPullAt('products'),
  }

  const result: SyncDiagnosis = {
    configured: isSupabaseConfigured(),
    online: navigator.onLine,
    reachable: false,
    tables: {
      suppliers: { error: 'no comprobado' },
      meetings: { error: 'no comprobado' },
      products: { error: 'no comprobado' },
    },
    localCounts,
    pendingPush: {
      suppliers: dirtySuppliers,
      meetings: dirtyMeetings,
    },
    lastPullAt,
  }

  if (!result.configured) return result
  if (!result.online) return result

  // Intentar leer 1 fila de cada tabla — si falla la tabla no existe o
  // RLS está bloqueando.
  const probeTable = async (table: 'suppliers' | 'meetings' | 'products') => {
    try {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error) return { error: error.message }
      return 'ok' as const
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'unknown' }
    }
  }

  const [s, m, p] = await Promise.all([
    probeTable('suppliers'),
    probeTable('meetings'),
    probeTable('products'),
  ])
  result.tables = { suppliers: s, meetings: m, products: p }
  result.reachable = s === 'ok' || m === 'ok' || p === 'ok'

  return result
}

export async function syncNow(): Promise<void> {
  if (!isSupabaseConfigured()) {
    setStatus({ state: 'offline' })
    return
  }
  if (!navigator.onLine) {
    setStatus({ state: 'offline' })
    return
  }

  setStatus({ state: 'syncing' })

  try {
    // PUSH primero (subir lo nuestro), luego PULL (bajar lo de los demás).
    // Si invirtiéramos el orden, un cambio local pendiente podría perderse
    // al recibir una versión más antigua del servidor.
    await pushSuppliers()
    await pushMeetings()
    await pushProducts()

    await pullSuppliers()
    await pullMeetings()
    await pullProducts()

    setStatus({ state: 'idle', lastSyncAt: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync error'
    console.error('[sync]', message)
    setStatus({
      state: 'error',
      error: message,
      lastSyncAt: currentStatus.state === 'idle' ? currentStatus.lastSyncAt : null,
    })
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null

export function startBackgroundSync(intervalMs = 30_000): () => void {
  // Sincroniza al arrancar y cada `intervalMs`.
  void syncNow()
  intervalId = setInterval(() => void syncNow(), intervalMs)

  const onOnline = () => void syncNow()
  window.addEventListener('online', onOnline)

  return () => {
    if (intervalId) clearInterval(intervalId)
    intervalId = null
    window.removeEventListener('online', onOnline)
  }
}
