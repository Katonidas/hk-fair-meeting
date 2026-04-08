import type { UserName } from '@/types'
import { getCCEmailsList } from './settings'

export const USERS: UserName[] = ['Carlos', 'Jesús', 'Jose Luis']

export const CC_EMAILS: Record<UserName, string> = {
  'Carlos': 'carlos@approx.es',
  'Jesús': 'jesus@approx.es',
  'Jose Luis': 'joseluis@approx.es',
}

export function getCCEmails(currentUser: UserName): string[] {
  const userEmail = CC_EMAILS[currentUser]
  return getCCEmailsList().filter(email => email !== userEmail)
}
