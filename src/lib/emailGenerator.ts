import type { Meeting, Supplier, Product } from '@/types'
import { getTerms, getQOS } from './settings'

export function generateEmailSubject(supplier: Supplier): string {
  return `${supplier.name} - APPROX - Meeting HK Fair`
}

export function generateEmailBody(
  supplier: Supplier,
  meeting: Meeting,
  products: Product[],
): string {
  const lines: string[] = []

  lines.push('Hello,')
  lines.push('')
  lines.push(`Dear ${supplier.name} team,`)
  lines.push('')
  lines.push('It was a pleasure visiting your stand at the HK Sources Fair.')
  lines.push('Please find below a summary of our meeting.')
  lines.push('')

  if (meeting.urgent_notes.trim()) {
    lines.push('⚠️ URGENT NOTES:')
    lines.push(meeting.urgent_notes.trim())
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('*** TERMS & CONDITIONS ***')
  lines.push('')
  lines.push('IMPORTANT — Please note our standard terms and conditions.')
  lines.push('All negotiations, agreed conditions and PRICES are based on and must include the following terms:')
  lines.push('')
  lines.push(getTerms())
  lines.push('')
  lines.push('SERVICE REQUIREMENTS:')
  lines.push(getQOS())
  lines.push('')

  if (products.length > 0) {
    lines.push('---')
    lines.push('')
    lines.push('We are interested in the following products:')
    lines.push('')

    for (const p of products) {
      lines.push(`PRODUCT: ${p.product_type || '—'} — ITEM: ${p.item_model || '—'}`)
      lines.push(`  PRICE: ${p.price ? `$${p.price} ${p.price_currency}` : '—'}`)
      lines.push(`  FEATURES: ${p.features || '—'}`)
      lines.push(`  MOQ: ${p.moq || '—'}`)
      lines.push(`  OPTIONS: ${p.options || '—'}`)

      const sampleText = {
        collected: 'YES (collected)',
        pending: 'PENDING (supplier to send)',
        no: 'NO',
      }[p.sample_status]
      lines.push(`  SAMPLE: ${sampleText}${p.sample_units ? ` — ${p.sample_units} units` : ''}`)

      const notes: string[] = []
      if (p.target_price) {
        notes.push(`WE NEED THIS PRICE: $${p.target_price} — PLEASE CHECK IT`)
      }
      if (p.observations) {
        notes.push(p.observations)
      }
      if (notes.length) {
        lines.push(`  NOTES: ${notes.join(' | ')}`)
      }
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('PLEASE SEND DATASHEET AND PICTURES OF THESE PRODUCTS ASAP.')
  lines.push('')
  lines.push('Regarding samples: please prepare all samples indicated in the table above.')
  lines.push('Please coordinate delivery with Mr. Chen to have them at our Shenzhen hotel on April 15-16.')
  lines.push('Contact Mr. Chen ASAP to coordinate (+86 136 3268 9109).')

  if (meeting.other_notes.trim()) {
    lines.push('')
    lines.push('ADDITIONAL NOTES:')
    lines.push(meeting.other_notes.trim())
  }

  lines.push('')
  lines.push('Best regards,')
  lines.push(`${meeting.user_name} - APPROX`)

  return lines.join('\n')
}

export function buildMailtoUrl(
  to: string[],
  cc: string[],
  subject: string,
  body: string,
): string {
  const params = new URLSearchParams()
  if (cc.length) params.set('cc', cc.join(','))
  params.set('subject', subject)
  params.set('body', body)

  return `mailto:${to.join(',')}?${params.toString()}`
}
