import type { Meeting, Supplier, Product } from '@/types'
import { getTerms, getQOS } from './settings'
import { translateToEnglish } from './translate'

export function generateEmailSubject(supplier: Supplier): string {
  return `${supplier.name} - APPROX - Meeting HK Fair`
}

export function generateEmailBody(
  supplier: Supplier,
  meeting: Meeting,
  products: Product[],
): string {
  const L: string[] = []

  L.push('Hello,')
  L.push('')
  L.push(`Dear ${supplier.name} team,`)
  L.push('')
  L.push('It was a pleasure visiting your stand at the HK Sources Fair.')
  L.push('Please find below a summary of our meeting.')
  L.push('')

  // ── URGENT NOTES ──
  if (meeting.urgent_notes.trim()) {
    L.push('════════════════════════════════════════')
    L.push('⚠️  URGENT NOTES')
    L.push('════════════════════════════════════════')
    L.push('')
    L.push(translateToEnglish(meeting.urgent_notes.trim()))
    L.push('')
  }

  // ── TERMS & CONDITIONS ──
  L.push('════════════════════════════════════════')
  L.push('TERMS & CONDITIONS')
  L.push('════════════════════════════════════════')
  L.push('')
  L.push('IMPORTANT: Please note our standard terms and conditions.')
  L.push('All negotiations, agreed conditions and PRICES are based on and must include the following terms:')
  L.push('')
  L.push(getTerms())
  L.push('')

  // ── SERVICE REQUIREMENTS ──
  L.push('————————————————————————————————————————')
  L.push('SERVICE REQUIREMENTS')
  L.push('————————————————————————————————————————')
  L.push('')
  L.push(getQOS())
  L.push('')

  // ── PRODUCTS ──
  if (products.length > 0) {
    L.push('════════════════════════════════════════')
    L.push('PRODUCTS OF INTEREST')
    L.push('════════════════════════════════════════')
    L.push('')

    for (let i = 0; i < products.length; i++) {
      const p = products[i]
      const num = i + 1
      L.push(`── Product ${num} ──────────────────────`)
      L.push(`  PRODUCT TYPE: ${p.product_type || '—'}`)
      L.push(`  ITEM/MODEL:   ${p.item_model || '—'}`)
      L.push(`  PRICE:        ${p.price != null ? `$${p.price.toFixed(2)} ${p.price_currency}` : '—'}`)
      L.push(`  MOQ:          ${p.moq || '—'}`)
      L.push(`  FEATURES:     ${translateToEnglish(p.features) || '—'}`)
      L.push(`  OPTIONS:      ${translateToEnglish(p.options) || '—'}`)

      const sampleText = {
        collected: 'YES (collected)',
        pending: 'PENDING (supplier to send)',
        no: 'NO',
      }[p.sample_status]
      L.push(`  SAMPLE:       ${sampleText}${p.sample_units ? ` - ${p.sample_units} units` : ''}`)

      if (p.target_price) {
        L.push(`  >> WE NEED THIS PRICE: $${p.target_price.toFixed(2)} - PLEASE CHECK IT <<`)
      }
      if (p.observations) {
        L.push(`  NOTES:        ${translateToEnglish(p.observations)}`)
      }
      L.push('')
    }
  }

  // ── DATASHEETS & SAMPLES ──
  L.push('════════════════════════════════════════')
  L.push('DATASHEETS & SAMPLES')
  L.push('════════════════════════════════════════')
  L.push('')
  L.push('PLEASE SEND DATASHEET AND PICTURES OF THESE PRODUCTS ASAP.')
  L.push('')
  L.push('Regarding samples: please prepare all samples indicated above.')
  L.push('Please coordinate delivery with Mr. Chen to have them at our Shenzhen hotel on April 15-16.')
  L.push('Contact Mr. Chen ASAP to coordinate (+86 136 3268 9109).')
  L.push('')

  // ── ADDITIONAL NOTES ──
  if (meeting.other_notes.trim()) {
    L.push('————————————————————————————————————————')
    L.push('ADDITIONAL NOTES')
    L.push('————————————————————————————————————————')
    L.push('')
    L.push(translateToEnglish(meeting.other_notes.trim()))
    L.push('')
  }

  L.push('')
  L.push('Best regards,')
  L.push(`${meeting.user_name} - APPROX`)

  return L.join('\n')
}

export function buildMailtoUrl(
  to: string[],
  cc: string[],
  subject: string,
  body: string,
): string {
  // Use encodeURIComponent instead of URLSearchParams to avoid + for spaces
  const parts: string[] = []
  if (cc.length) parts.push('cc=' + encodeURIComponent(cc.join(',')))
  parts.push('subject=' + encodeURIComponent(subject))
  parts.push('body=' + encodeURIComponent(body))

  return `mailto:${encodeURIComponent(to.join(','))}?${parts.join('&')}`
}
