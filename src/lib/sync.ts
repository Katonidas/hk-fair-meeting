import { db } from './db'
import { supabase, isSupabaseConfigured } from './supabase'
import { backupBeforeDelete } from './backup'
import type { Supplier, Meeting, Product } from '@/types'
import type { SearchedProduct } from '@/types/searchedProduct'

export type SyncStatus = 'synced' | 'pending' | 'error' | 'offline'

let syncInProgress = false
let lastSyncStatus: SyncStatus = 'pending'
const listeners = new Set<(status: SyncStatus) => void>()

// Tombstones: track deleted IDs so pull doesn't restore them
// Persisted to localStorage to survive page refreshes
const TOMBSTONE_KEY = 'hk-fair-tombstones'

function loadTombstones(): { meetings: string[]; products: string[]; suppliers: string[]; searched_products: string[] } {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        meetings: parsed.meetings || [],
        products: parsed.products || [],
        suppliers: parsed.suppliers || [],
        searched_products: parsed.searched_products || [],
      }
    }
  } catch { /* ignore */ }
  return { meetings: [], products: [], suppliers: [], searched_products: [] }
}

function saveTombstones() {
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify({
    meetings: [...deletedMeetingIds],
    products: [...deletedProductIds],
    suppliers: [...deletedSupplierIds],
    searched_products: [...deletedSearchedProductIds],
  }))
}

const saved = loadTombstones()
const deletedMeetingIds = new Set<string>(saved.meetings)
const deletedProductIds = new Set<string>(saved.products)
const deletedSupplierIds = new Set<string>(saved.suppliers)
const deletedSearchedProductIds = new Set<string>(saved.searched_products)

export function onSyncStatusChange(fn: (status: SyncStatus) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSyncStatus(): SyncStatus {
  return lastSyncStatus
}

function setStatus(s: SyncStatus) {
  lastSyncStatus = s
  listeners.forEach(fn => fn(s))
}

export async function syncAll(): Promise<void> {
  if (!isSupabaseConfigured() || syncInProgress) return
  if (!navigator.onLine) {
    setStatus('offline')
    return
  }

  syncInProgress = true
  setStatus('pending')

  try {
    await pushSuppliers()
    await pushMeetings()
    await pushProducts()
    await pushProductPhotos()
    await pushSearchedProducts()
    await pullSuppliers()
    await pullMeetings()
    await pullProducts()
    await pullProductPhotos()
    await pullSearchedProducts()
    setStatus('synced')
  } catch (err) {
    console.error('Sync error:', err)
    setStatus('error')
  } finally {
    syncInProgress = false
  }
}

// ── Bulk delete (Settings danger zone) ──

export async function deleteAllMeetings(): Promise<void> {
  const allMeetings = await db.meetings.toArray()
  const allProducts = await db.products.toArray()

  // BACKUP antes de borrar
  for (const m of allMeetings) {
    await backupBeforeDelete('meetings', m as unknown as Record<string, unknown>, 'bulk-delete')
  }
  for (const p of allProducts) {
    await backupBeforeDelete('products', p as unknown as Record<string, unknown>, 'bulk-delete')
  }

  // Add all IDs to tombstones
  for (const m of allMeetings) deletedMeetingIds.add(m.id)
  for (const p of allProducts) deletedProductIds.add(p.id)
  saveTombstones()

  // Clear local
  await db.products.clear()
  await db.product_photos.clear()
  await db.meetings.clear()

  // Delete from Supabase if online
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      for (const p of allProducts) {
        await supabase.from('product_photos').delete().eq('product_id', p.id)
        await supabase.from('products').delete().eq('id', p.id)
      }
      for (const m of allMeetings) {
        await supabase.from('meetings').delete().eq('id', m.id)
      }
    } catch (err) {
      console.error('Error deleting all meetings from Supabase:', err)
    }
  }
}

export async function deleteAllSuppliers(): Promise<void> {
  const allSuppliers = await db.suppliers.toArray()

  // BACKUP antes de borrar
  for (const s of allSuppliers) {
    await backupBeforeDelete('suppliers', s as unknown as Record<string, unknown>, 'bulk-delete')
  }

  for (const s of allSuppliers) deletedSupplierIds.add(s.id)
  saveTombstones()

  await db.suppliers.clear()

  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      for (const s of allSuppliers) {
        await supabase.from('suppliers').delete().eq('id', s.id)
      }
    } catch (err) {
      console.error('Error deleting all suppliers from Supabase:', err)
    }
  }
}

export async function deleteAllProducts(): Promise<void> {
  const allProducts = await db.products.toArray()

  // BACKUP antes de borrar
  for (const p of allProducts) {
    await backupBeforeDelete('products', p as unknown as Record<string, unknown>, 'bulk-delete')
  }

  for (const p of allProducts) deletedProductIds.add(p.id)
  saveTombstones()

  await db.product_photos.clear()
  await db.products.clear()

  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      for (const p of allProducts) {
        await supabase.from('product_photos').delete().eq('product_id', p.id)
        await supabase.from('products').delete().eq('id', p.id)
      }
    } catch (err) {
      console.error('Error deleting all products from Supabase:', err)
    }
  }
}

// ── Delete from both local and remote ──

export async function deleteMeeting(meetingId: string): Promise<void> {
  // Track as deleted so pull won't restore
  deletedMeetingIds.add(meetingId)

  // BACKUP: guardar copia de la reunión y sus productos antes de borrar
  const meetingToBackup = await db.meetings.get(meetingId)
  if (meetingToBackup) {
    await backupBeforeDelete('meetings', meetingToBackup as unknown as Record<string, unknown>, 'user')
  }

  // Get products for this meeting before deleting
  const products = await db.products.where('meeting_id').equals(meetingId).toArray()
  for (const p of products) {
    await backupBeforeDelete('products', p as unknown as Record<string, unknown>, 'user')
    deletedProductIds.add(p.id)
  }

  // Persist tombstones
  saveTombstones()

  // Delete locally
  await db.products.where('meeting_id').equals(meetingId).delete()
  await db.meetings.delete(meetingId)

  // Delete from Supabase if configured and online
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      // Delete products first (FK constraint)
      for (const p of products) {
        await supabase.from('product_photos').delete().eq('product_id', p.id)
        await supabase.from('products').delete().eq('id', p.id)
      }
      await supabase.from('meetings').delete().eq('id', meetingId)
    } catch (err) {
      console.error('Error deleting from Supabase:', err)
    }
  }
}

export async function deleteSearchedProduct(id: string): Promise<void> {
  // BACKUP antes de borrar
  const toBackup = await db.searched_products.get(id)
  if (toBackup) {
    await backupBeforeDelete('searched_products', toBackup as unknown as Record<string, unknown>, 'user')
  }

  // Track as deleted so pull won't restore
  deletedSearchedProductIds.add(id)
  saveTombstones()

  // Delete locally
  await db.searched_products.delete(id)

  // Delete from Supabase if configured and online
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      await supabase.from('searched_products').delete().eq('id', id)
    } catch (err) {
      console.error('Error deleting searched_product from Supabase:', err)
    }
  }
}

export async function deleteAllSearchedProducts(): Promise<void> {
  const all = await db.searched_products.toArray()

  // BACKUP antes de borrar
  for (const p of all) {
    await backupBeforeDelete('searched_products', p as unknown as Record<string, unknown>, 'bulk-delete')
  }

  for (const p of all) deletedSearchedProductIds.add(p.id)
  saveTombstones()
  await db.searched_products.clear()

  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      for (const p of all) {
        await supabase.from('searched_products').delete().eq('id', p.id)
      }
    } catch (err) {
      console.error('Error deleting all searched_products from Supabase:', err)
    }
  }
}

// ── Push local changes to Supabase ──

async function pushSuppliers() {
  const unsynced = await db.suppliers
    .filter(s => !s.synced_at || s.updated_at > s.synced_at)
    .toArray()

  for (const s of unsynced) {
    const row = toSupabaseSupplier(s)
    const { error } = await supabase.from('suppliers').upsert(row, { onConflict: 'id' })
    if (!error) {
      await db.suppliers.update(s.id, { synced_at: new Date().toISOString() })
    } else {
      console.error('Push supplier error:', s.id, error)
    }
  }
}

async function pushMeetings() {
  const unsynced = await db.meetings
    .filter(m => !m.synced_at || m.updated_at > m.synced_at)
    .toArray()

  for (const m of unsynced) {
    const row = toSupabaseMeeting(m)
    const { error } = await supabase.from('meetings').upsert(row, { onConflict: 'id' })
    if (!error) {
      await db.meetings.update(m.id, { synced_at: new Date().toISOString() })
    } else {
      console.error('Push meeting error:', m.id, error)
    }
  }
}

// Track last-pushed product hashes to avoid redundant pushes
const pushedProductHashes = new Map<string, string>()

function productHash(p: Product): string {
  return `${p.product_type}|${p.item_model}|${p.price}|${p.target_price}|${p.status}|${p.sample_status}|${p.features}|${p.photos?.length}`
}

async function pushProducts() {
  const allProducts = await db.products.toArray()
  const localMeetings = await db.meetings.toArray()
  const meetingIds = new Set(localMeetings.map(m => m.id))

  for (const p of allProducts) {
    // Push if product has a valid meeting OR a direct supplier_id (manual product)
    if (!p.supplier_id && !meetingIds.has(p.meeting_id)) continue

    // Skip if product hasn't changed since last push
    const hash = productHash(p)
    if (pushedProductHashes.get(p.id) === hash) continue

    const row = toSupabaseProduct(p)
    const { error } = await supabase.from('products').upsert(row, { onConflict: 'id' })
    if (error) {
      // If supplier_id column doesn't exist, retry without it
      if (error.message?.includes('supplier_id')) {
        const { supplier_id: _, ...rowWithout } = row as Record<string, unknown>
        const { error: e2 } = await supabase.from('products').upsert(rowWithout, { onConflict: 'id' })
        if (!e2) pushedProductHashes.set(p.id, hash)
        else console.error('Push product error (retry):', p.id, e2)
      } else {
        console.error('Push product error:', p.id, error)
      }
    } else {
      pushedProductHashes.set(p.id, hash)
    }
  }
}

async function pushProductPhotos() {
  const allPhotos = await db.product_photos.toArray()
  for (const ph of allPhotos) {
    const { error } = await supabase.from('product_photos').upsert({
      id: ph.id,
      product_id: ph.product_id,
      photo_url: ph.photo_url,
      created_at: ph.created_at,
    }, { onConflict: 'id' })
    if (error) {
      console.error('Push photo error:', ph.id, error)
    }
  }
}

// ── Pull remote changes to local ──

async function pullSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error || !data) return



  for (const remote of data) {
    // Skip suppliers that were deleted locally
    if (deletedSupplierIds.has(remote.id)) continue

    const local = await db.suppliers.get(remote.id)
    if (!local || remote.updated_at > local.updated_at) {
      await db.suppliers.put(fromSupabaseSupplier(remote))
    }
  }

  // ANTES AQUÍ SE BORRABAN suppliers locales que no estaban en remoto,
  // asumiendo "borrado en otro dispositivo". ESO CAUSABA PÉRDIDA DE DATOS
  // cuando el push fallaba por red inestable. ELIMINADO el 2026-04-13.
  // Ahora: si un supplier existe local pero no remoto, se queda local.
  // Solo se borran por acción explícita del usuario.
}

async function pullMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error || !data) return



  for (const remote of data) {
    // Skip meetings that were deleted locally
    if (deletedMeetingIds.has(remote.id)) continue

    const local = await db.meetings.get(remote.id)
    if (!local || remote.updated_at > local.updated_at) {
      await db.meetings.put(fromSupabaseMeeting(remote))
    }
  }

  // ANTES AQUÍ SE BORRABAN meetings + sus productos si no estaban en
  // remoto. ESO CAUSABA PÉRDIDA DE DATOS. ELIMINADO el 2026-04-13.
}

async function pullProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error || !data) return



  for (const remote of data) {
    // Skip products that were deleted locally
    if (deletedProductIds.has(remote.id)) continue
    // Skip products whose meeting was deleted
    if (remote.meeting_id && deletedMeetingIds.has(remote.meeting_id)) continue

    const local = await db.products.get(remote.id)
    if (!local) {
      await db.products.put(fromSupabaseProduct(remote))
    } else if (remote.updated_at && (!local.created_at || remote.updated_at > local.created_at)) {
      // Update existing products with newer remote data
      await db.products.put(fromSupabaseProduct(remote))
    }
  }

  // ANTES AQUÍ SE BORRABAN productos locales que no estaban en remoto.
  // ESO ERA LA CAUSA DE LA PÉRDIDA DE DATOS: si un push fallaba por red
  // inestable, el producto nunca llegaba a Supabase, y 30s después el pull
  // lo borraba localmente pensando "fue borrado en otro dispositivo".
  // ELIMINADO el 2026-04-13. Los productos SOLO se borran por acción
  // explícita del usuario, nunca automáticamente.
}

async function pullProductPhotos() {
  const { data, error } = await supabase
    .from('product_photos')
    .select('*')

  if (error || !data) return

  for (const remote of data) {
    const local = await db.product_photos.get(remote.id)
    if (!local || (remote.created_at && remote.created_at > (local.created_at || ''))) {
      await db.product_photos.put({
        id: remote.id,
        product_id: remote.product_id,
        photo_url: remote.photo_url,
        created_at: remote.created_at,
      })
    }
  }
}

// ── Searched products (productos deseados) ──

async function pushSearchedProducts() {
  const unsynced = await db.searched_products
    .filter(p => !p.synced_at || p.updated_at > p.synced_at)
    .toArray()

  for (const p of unsynced) {
    const row = toSupabaseSearchedProduct(p)
    const { error } = await supabase.from('searched_products').upsert(row, { onConflict: 'id' })
    if (!error) {
      await db.searched_products.update(p.id, { synced_at: new Date().toISOString() })
    } else {
      console.error('Push searched_product error:', p.id, error)
    }
  }
}

async function pullSearchedProducts() {
  const { data, error } = await supabase
    .from('searched_products')
    .select('*')

  if (error || !data) {
    if (error) console.error('Pull searched_products error:', error)
    return
  }



  for (const remote of data) {
    // Skip ones deleted locally (tombstone)
    if (deletedSearchedProductIds.has(remote.id as string)) continue

    const local = await db.searched_products.get(remote.id as string)
    if (!local || (remote.updated_at && (remote.updated_at as string) > local.updated_at)) {
      await db.searched_products.put(fromSupabaseSearchedProduct(remote))
    }
  }

  // Auto-delete de searched_products eliminado por seguridad (2026-04-13).
}

function toSupabaseSearchedProduct(p: SearchedProduct): Record<string, unknown> {
  return {
    id: p.id,
    brand: p.brand,
    product_type: p.product_type,
    ref_segment: p.ref_segment,
    main_specs: p.main_specs,
    target_cost: p.target_cost,
    examples: p.examples,
    margin_target: p.margin_target,
    pvpr: p.pvpr,
    model_interno: p.model_interno,
    relevance: p.relevance,
    candidate_product_ids: p.candidate_product_ids,
    candidate_supplier_ids: p.candidate_supplier_ids,
    photos: p.photos,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

function fromSupabaseSearchedProduct(r: Record<string, unknown>): SearchedProduct {
  const rawRelevance = r.relevance as number | undefined
  const relevance: 1 | 2 | 3 = (rawRelevance === 1 || rawRelevance === 3) ? rawRelevance : 2
  return {
    id: r.id as string,
    brand: (r.brand as string) || '',
    product_type: (r.product_type as string) || '',
    ref_segment: (r.ref_segment as string) || '',
    main_specs: (r.main_specs as string) || '',
    target_cost: (r.target_cost as number) ?? null,
    examples: (r.examples as string) || '',
    margin_target: (r.margin_target as string) || '',
    pvpr: (r.pvpr as number) ?? null,
    model_interno: (r.model_interno as string) || '',
    relevance,
    candidate_product_ids: (r.candidate_product_ids as string[]) || [],
    candidate_supplier_ids: (r.candidate_supplier_ids as string[]) || [],
    photos: (r.photos as string[]) || [],
    created_at: (r.created_at as string) || new Date().toISOString(),
    updated_at: (r.updated_at as string) || new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }
}

// ── Mappers ──

function toSupabaseSupplier(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    stand: s.stand,
    assigned_person: s.assigned_person,
    contact_person: s.contact_person,
    product_type: s.product_type,
    emails: s.emails,
    phone: s.phone,
    relevance: s.relevance,
    visit_day: s.visit_day,
    visit_slot: s.visit_slot,
    visited: s.visited,
    pending_topics: s.pending_topics,
    interesting_products: s.interesting_products,
    has_catalogue: s.has_catalogue,
    current_products: s.current_products,
    supplier_notes: s.supplier_notes,
    is_new: s.is_new,
    updated_at: s.updated_at,
    updated_by: s.updated_by,
    created_at: s.created_at,
  }
}

function fromSupabaseSupplier(r: Record<string, unknown>): Supplier {
  return {
    id: r.id as string,
    name: r.name as string,
    stand: (r.stand as string) || '',
    assigned_person: (r.assigned_person as string) || '',
    contact_person: (r.contact_person as string) || '',
    product_type: (r.product_type as string) || '',
    emails: (r.emails as string[]) || [],
    phone: (r.phone as string) || '',
    relevance: (r.relevance as 1 | 2 | 3) || 2,
    visit_day: (r.visit_day as string) || '',
    visit_slot: (r.visit_slot as string) || '',
    visited: (r.visited as boolean) || false,
    pending_topics: (r.pending_topics as string) || '',
    interesting_products: (r.interesting_products as string) || '',
    has_catalogue: (r.has_catalogue as boolean) || false,
    current_products: (r.current_products as string) || '',
    supplier_notes: (r.supplier_notes as string) || '',
    is_new: (r.is_new as boolean) || false,
    updated_at: r.updated_at as string,
    updated_by: (r.updated_by as string) || '',
    created_at: r.created_at as string,
    synced_at: new Date().toISOString(),
  }
}

function toSupabaseMeeting(m: Meeting) {
  return {
    id: m.id,
    supplier_id: m.supplier_id,
    user_name: m.user_name,
    location: m.location,
    status: m.status,
    visited_at: m.visited_at,
    urgent_notes: m.urgent_notes,
    other_notes: m.other_notes,
    business_card_photo_url: m.business_card_photo_url,
    stand_photo_url: m.stand_photo_url,
    email_generated: m.email_generated,
    email_sent_at: m.email_sent_at,
    created_at: m.created_at,
    updated_at: m.updated_at,
  }
}

function fromSupabaseMeeting(r: Record<string, unknown>): Meeting {
  return {
    id: r.id as string,
    supplier_id: r.supplier_id as string,
    user_name: r.user_name as Meeting['user_name'],
    location: (r.location as Meeting['location']) || 'feria',
    status: (r.status as Meeting['status']) || 'draft',
    visited_at: r.visited_at as string,
    urgent_notes: (r.urgent_notes as string) || '',
    other_notes: (r.other_notes as string) || '',
    business_card_photo_url: (r.business_card_photo_url as string) || '',
    stand_photo_url: (r.stand_photo_url as string) || '',
    email_generated: (r.email_generated as boolean) || false,
    email_sent_at: (r.email_sent_at as string) || null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    synced_at: new Date().toISOString(),
  }
}

function toSupabaseProduct(p: Product) {
  const row: Record<string, unknown> = {
    id: p.id,
    meeting_id: p.meeting_id || null,
    product_type: p.product_type,
    item_model: p.item_model,
    price: p.price,
    price_currency: p.price_currency,
    target_price: p.target_price,
    features: p.features,
    moq: p.moq,
    options: p.options,
    sample_status: p.sample_status,
    sample_units: p.sample_units,
    observations: p.observations,
    photos: p.photos,
    status: p.status,
    created_at: p.created_at,
  }
  // Only include supplier_id if it has a value (column may not exist in Supabase yet)
  if (p.supplier_id) row.supplier_id = p.supplier_id
  return row
}

function fromSupabaseProduct(r: Record<string, unknown>): Product {
  return {
    id: r.id as string,
    meeting_id: (r.meeting_id as string) || '',
    supplier_id: (r.supplier_id as string) || undefined,
    product_type: (r.product_type as string) || '',
    item_model: (r.item_model as string) || '',
    price: (r.price as number) ?? null,
    price_currency: (r.price_currency as string) || 'USD',
    target_price: (r.target_price as number) ?? null,
    features: (r.features as string) || '',
    moq: (r.moq as number) ?? null,
    options: (r.options as string) || '',
    sample_status: (r.sample_status as Product['sample_status']) || 'no',
    sample_units: (r.sample_units as number) ?? null,
    observations: (r.observations as string) || '',
    photos: (r.photos as string[]) || [],
    status: (r.status as Product['status']) || 'interesting',
    created_at: r.created_at as string,
  }
}

// ── Auto-sync ──

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startAutoSync(intervalMs = 30_000) {
  if (syncInterval) return
  syncAll()
  syncInterval = setInterval(syncAll, intervalMs)

  window.addEventListener('online', () => syncAll())
  window.addEventListener('offline', () => setStatus('offline'))
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}
