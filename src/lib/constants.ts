import type { UserName } from '@/types'

export const USERS: UserName[] = ['Carlos', 'Jesús', 'Jose Luis']

export const CC_EMAILS: Record<UserName, string> = {
  'Carlos': 'carlos@approx.es',
  'Jesús': 'jesus@approx.es',
  'Jose Luis': 'joseluis@approx.es',
}

export const ALL_CC_EMAILS = [
  'joseluis@approx.es',
  'carlos@approx.es',
  'chen@approx.es',
  'jesus@approx.es',
]

export function getCCEmails(currentUser: UserName): string[] {
  const userEmail = CC_EMAILS[currentUser]
  return ALL_CC_EMAILS.filter(email => email !== userEmail)
}
