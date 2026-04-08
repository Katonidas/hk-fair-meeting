import { useState, useEffect } from 'react'
import { startAutoSync, onSyncStatusChange, getSyncStatus, type SyncStatus } from '@/lib/sync'

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())

  useEffect(() => {
    startAutoSync()
    const unsub = onSyncStatusChange(setStatus)
    return () => { unsub() }
  }, [])

  return status
}
