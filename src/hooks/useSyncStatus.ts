import { useEffect, useState } from 'react'
import { subscribeSync, getSyncStatus, type SyncStatus } from '@/lib/sync'

/**
 * Hook que devuelve el estado actual del motor de sincronización
 * Dexie ↔ Supabase. Suscribe al store del módulo `sync.ts`.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus())

  useEffect(() => {
    const unsubscribe = subscribeSync(setStatus)
    return unsubscribe
  }, [])

  return status
}
