import { useState, useCallback } from 'react'
import type { UserName } from '@/types'

const STORAGE_KEY = 'hk-fair-current-user'

export function useCurrentUser() {
  const [currentUser, setCurrentUserState] = useState<UserName | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && ['Carlos', 'Jesús', 'Tote', 'Jose Luis'].includes(stored)) {
      return stored as UserName
    }
    return null
  })

  const setCurrentUser = useCallback((user: UserName) => {
    localStorage.setItem(STORAGE_KEY, user)
    setCurrentUserState(user)
  }, [])

  const clearUser = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setCurrentUserState(null)
  }, [])

  return { currentUser, setCurrentUser, clearUser }
}
