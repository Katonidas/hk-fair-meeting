import { db } from './db'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Supplier, Meeting, Product } from '@/types'

export type SyncStatus = 'synced' | 'pending' | 'error' | 'offline'

let syncInProgress = false
let lastSyncStatus: SyncStatus = 'pending'
const listeners = new Set<(status: SyncStatus) => void>()

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
    await pullSuppliers()
    await pullMeetings()
    await pullProducts()
    await pullProductPhotos()
    setStatus('synced')
  } catch (err) {
    console.error('Sync error:', err)
    setStatus('error')
  } finally {
    syncInProgress = false
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

async function pushProducts() {
  const allProducts = await db.products.toArray()
  const localMeetings = await db.meetings.toArray()
  const meetingIds = new Set(localMeetings.map(m => m.id))

  for (const p of allProducts) {
    if (!meetingIds.has(p.meeting_id)) continue
    const row = toSupabaseProduct(p)
    const { error } = await supabase.from('products').upsert(row, { onConflict: 'id' })
    if (error) {
      console.error('Push product error:', p.id, error)
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
    const local = await db.suppliers.get(remote.id)
    if (!local || remote.updated_at > local.updated_at) {
      await db.suppliers.put(fromSupabaseSupplier(remote))
    }
  }
}

async function pullMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error || !data) return

  for (const remote of data) {
    const local = await db.meetings.get(remote.id)
    if (!local || remote.updated_at > local.updated_at) {
      await db.meetings.put(fromSupabaseMeeting(remote))
    }
  }
}

async function pullProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error || !data) return

  for (const remote of data) {
    const local = await db.products.get(remote.id)
    if (!local) {
      await db.products.put(fromSupabaseProduct(remote))
    }
  }
}

async function pullProductPhotos() {
  const { data, error } = await supabase
    .from('product_photos')
    .select('*')

  if (error || !data) return

  for (const remote of data) {
    const local = await db.product_photos.get(remote.id)
    if (!local) {
      await db.product_photos.put({
        id: remote.id,
        product_id: remote.product_id,
        photo_url: remote.photo_url,
        created_at: remote.created_at,
      })
    }
  }
}

// ── Mappers ──

function toSupabaseSupplier(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    stand: s.stand,
    assigned_person: s.assigned_person,
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
    visited_at: m.visited_at,
    urgent_notes: m.urgent_notes,
    other_notes: m.other_notes,
    business_card_photo_url: m.business_card_photo_url,
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
    visited_at: r.visited_at as string,
    urgent_notes: (r.urgent_notes as string) || '',
    other_notes: (r.other_notes as string) || '',
    business_card_photo_url: (r.business_card_photo_url as string) || '',
    email_generated: (r.email_generated as boolean) || false,
    email_sent_at: (r.email_sent_at as string) || null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    synced_at: new Date().toISOString(),
  }
}

function toSupabaseProduct(p: Product) {
  return {
    id: p.id,
    meeting_id: p.meeting_id,
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
    created_at: p.created_at,
  }
}

function fromSupabaseProduct(r: Record<string, unknown>): Product {
  return {
    id: r.id as string,
    meeting_id: r.meeting_id as string,
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
