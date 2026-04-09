// Format price with 2 decimals, or '—' if null/undefined
export function fmtPrice(value: number | null | undefined, currency?: string): string {
  if (value == null) return '—'
  const formatted = value.toFixed(2)
  if (currency === 'EUR' || currency === '€') return `${formatted} €`
  if (currency === 'USD' || currency === '$') return `$${formatted}`
  return currency ? `${formatted} ${currency}` : `$${formatted}`
}
