import type { UserName, Relevance } from '@/types'

// Etiquetas de importancia para productos deseados.
// 1 = más importante, 3 = menos importante (criterio definido por CEO).
export const PRODUCT_RELEVANCE_LABELS: Record<Relevance, string> = {
  1: 'Imprescindible',
  2: 'Importante',
  3: 'Opcional',
}

export const PRODUCT_RELEVANCE_LEVELS: Relevance[] = [1, 2, 3]

export const USERS: UserName[] = ['Carlos', 'Jesús', 'Tote', 'Jose Luis']

export const CC_EMAILS: Record<UserName, string> = {
  'Carlos': 'carlos@approx.es',
  'Jesús': 'jesus@approx.es',
  'Tote': 'joseluis@approx.es',
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
