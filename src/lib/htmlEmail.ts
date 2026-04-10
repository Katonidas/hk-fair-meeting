import type { Meeting, Supplier, Product } from '@/types'
import type { SearchedProduct } from '@/types/searchedProduct'
import { getTerms, getQOS } from './settings'
import { fmtPrice } from './price'

const STYLE = {
  wrap: 'font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.5; max-width: 720px;',
  h1: 'color: #1a2f5f; font-size: 18px; margin: 24px 0 12px 0; padding: 8px 12px; background: #f0f4fa; border-left: 4px solid #1a2f5f; border-radius: 4px;',
  h2: 'color: #5a6678; font-size: 14px; margin: 20px 0 8px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;',
  p: 'margin: 8px 0;',
  urgent: 'background: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin: 16px 0;',
  urgentTitle: 'color: #856404; font-weight: bold; margin: 0 0 6px 0; font-size: 13px;',
  urgentBody: 'color: #856404; margin: 0; white-space: pre-wrap;',
  terms: 'background: #f8f9fa; border-left: 3px solid #6c757d; padding: 10px 14px; margin: 12px 0; font-size: 12px; white-space: pre-wrap; color: #495057;',
  product: 'border: 1px solid #dee2e6; border-radius: 6px; padding: 12px 16px; margin: 10px 0; background: #fff;',
  productTitle: 'color: #1a2f5f; font-weight: bold; margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #dee2e6; padding-bottom: 6px;',
  label: 'color: #6c757d; font-size: 11px; text-transform: uppercase; font-weight: 600; display: inline-block; min-width: 95px;',
  value: 'color: #212529; font-size: 13px;',
  targetPrice: 'background: #d4edda; color: #155724; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 13px; display: inline-block; margin: 4px 0;',
  sample: 'display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold;',
  sampleYes: 'background: #d4edda; color: #155724;',
  samplePdte: 'background: #fff3cd; color: #856404;',
  sampleNo: 'background: #e9ecef; color: #6c757d;',
  signature: 'margin-top: 24px; padding-top: 16px; border-top: 2px solid #1a2f5f; color: #1a2f5f;',
  signatureName: 'font-weight: bold; font-size: 15px; margin: 0;',
  signatureCompany: 'color: #6c757d; font-size: 12px; margin: 2px 0 0 0;',
}

function esc(s: string): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br>')
}

export function generateMeetingEmailHTML(
  supplier: Supplier,
  meeting: Meeting,
  products: Product[],
): string {
  const L: string[] = []

  L.push(`<div style="${STYLE.wrap}">`)

  L.push(`<p style="${STYLE.p}">Hello,</p>`)
  L.push(`<p style="${STYLE.p}">Dear <strong>${esc(supplier.name)}</strong> team,</p>`)
  L.push(`<p style="${STYLE.p}">It was a pleasure visiting your stand at the HK Sources Fair. Please find below a summary of our meeting.</p>`)

  // URGENT NOTES
  if (meeting.urgent_notes?.trim()) {
    L.push(`<div style="${STYLE.urgent}">`)
    L.push(`<p style="${STYLE.urgentTitle}">&#9888; URGENT NOTES</p>`)
    L.push(`<p style="${STYLE.urgentBody}">${nl2br(meeting.urgent_notes.trim())}</p>`)
    L.push(`</div>`)
  }

  // TERMS & CONDITIONS
  L.push(`<h1 style="${STYLE.h1}">Terms &amp; Conditions</h1>`)
  L.push(`<p style="${STYLE.p}"><strong>IMPORTANT:</strong> Please note our standard terms and conditions. All negotiations, agreed conditions and PRICES are based on and must include the following terms:</p>`)
  L.push(`<div style="${STYLE.terms}">${nl2br(getTerms())}</div>`)

  // QOS
  L.push(`<h2 style="${STYLE.h2}">Service requirements</h2>`)
  L.push(`<div style="${STYLE.terms}">${nl2br(getQOS())}</div>`)

  // PRODUCTS
  if (products.length > 0) {
    L.push(`<h1 style="${STYLE.h1}">Products of interest</h1>`)

    products.forEach((p, i) => {
      const num = i + 1
      const title = `Product ${num}: ${esc(p.product_type || '')}${p.item_model ? ` — ${esc(p.item_model)}` : ''}`

      const sampleText = {
        collected: { cls: STYLE.sampleYes, text: 'COLLECTED' },
        pending: { cls: STYLE.samplePdte, text: 'PENDING' },
        no: { cls: STYLE.sampleNo, text: 'NO' },
      }[p.sample_status]

      L.push(`<div style="${STYLE.product}">`)
      L.push(`<p style="${STYLE.productTitle}">${title}</p>`)

      const row = (label: string, value: string) =>
        `<p style="${STYLE.p}"><span style="${STYLE.label}">${label}</span> <span style="${STYLE.value}">${value}</span></p>`

      if (p.price != null) L.push(row('PRICE', fmtPrice(p.price, p.price_currency)))
      if (p.moq != null) L.push(row('MOQ', String(p.moq)))
      if (p.features) L.push(row('FEATURES', esc(p.features)))
      if (p.options) L.push(row('OPTIONS', esc(p.options)))

      L.push(`<p style="${STYLE.p}"><span style="${STYLE.label}">SAMPLE</span> <span style="${STYLE.sample} ${sampleText.cls}">${sampleText.text}${p.sample_units ? ` - ${p.sample_units} units` : ''}</span></p>`)

      if (p.target_price) {
        L.push(`<p style="${STYLE.p}"><span style="${STYLE.targetPrice}">WE NEED THIS PRICE: ${fmtPrice(p.target_price, p.price_currency)} — PLEASE CHECK IT</span></p>`)
      }

      if (p.observations) L.push(row('NOTES', esc(p.observations)))

      L.push(`</div>`)
    })
  }

  // DATASHEETS & SAMPLES
  L.push(`<h1 style="${STYLE.h1}">Datasheets &amp; Samples</h1>`)
  L.push(`<p style="${STYLE.p}"><strong>PLEASE SEND DATASHEET AND PICTURES OF THESE PRODUCTS ASAP.</strong></p>`)
  L.push(`<p style="${STYLE.p}">Regarding samples: please prepare all samples indicated above. Please coordinate delivery with Mr. Chen to have them at our Shenzhen hotel on April 15-16.</p>`)
  L.push(`<p style="${STYLE.p}">Contact Mr. Chen ASAP to coordinate: <strong>+86 136 3268 9109</strong>.</p>`)

  // ADDITIONAL NOTES
  if (meeting.other_notes?.trim()) {
    L.push(`<h2 style="${STYLE.h2}">Additional notes</h2>`)
    L.push(`<p style="${STYLE.p}; white-space: pre-wrap;">${nl2br(meeting.other_notes.trim())}</p>`)
  }

  // Signature
  L.push(`<div style="${STYLE.signature}">`)
  L.push(`<p style="${STYLE.p}">Best regards,</p>`)
  L.push(`<p style="${STYLE.signatureName}">${esc(meeting.user_name)}</p>`)
  L.push(`<p style="${STYLE.signatureCompany}">APPROX — HK Sources Fair 2026</p>`)
  L.push(`</div>`)

  L.push(`</div>`)
  return L.join('\n')
}

export function generatePotentialProductsEmailHTML(
  supplier: Supplier,
  products: SearchedProduct[],
  userName: string,
  calcTargetCost: (brand: string, pvpr: number | null, marginTarget: string) => number | null,
): string {
  const L: string[] = []

  L.push(`<div style="${STYLE.wrap}">`)
  L.push(`<p style="${STYLE.p}">Hello,</p>`)
  L.push(`<p style="${STYLE.p}">Dear <strong>${esc(supplier.name)}</strong> team,</p>`)
  L.push(`<p style="${STYLE.p}">We are looking for the following products. To make our meeting more efficient, please have ready the products that you consider may fit both in terms of specifications and price, also taking into account the examples we send regarding shape or design.</p>`)
  L.push(`<p style="${STYLE.p}">Of course, if you have any alternative, we will be happy to see it. If you want to send us the information by email in advance, that would be great too. Please send us the best possible offer along with images and specifications of the product.</p>`)
  L.push(`<p style="${STYLE.p}">Please remember that the prices provided must be based on and include our agreed terms and conditions:</p>`)
  L.push(`<div style="${STYLE.terms}">${nl2br(getTerms())}</div>`)

  L.push(`<h1 style="${STYLE.h1}">Products we are looking for</h1>`)

  products.forEach((sp, i) => {
    const num = i + 1
    const tc = calcTargetCost(sp.brand, sp.pvpr, sp.margin_target)
    const title = `${num}. ${esc(sp.product_type || '')}${sp.ref_segment ? ` — ${esc(sp.ref_segment)}` : ''}${sp.brand ? ` (${esc(sp.brand)})` : ''}`

    L.push(`<div style="${STYLE.product}">`)
    L.push(`<p style="${STYLE.productTitle}">${title}</p>`)

    if (sp.main_specs) {
      const specsInline = sp.main_specs.replace(/\n+/g, ' | ')
      L.push(`<p style="${STYLE.p}"><span style="${STYLE.label}">SPECS</span> <span style="${STYLE.value}">${esc(specsInline)}</span></p>`)
    }
    if (tc != null) {
      L.push(`<p style="${STYLE.p}"><span style="${STYLE.targetPrice}">TARGET PRICE: ${fmtPrice(tc, 'USD')}</span></p>`)
    }
    if (sp.examples) {
      L.push(`<p style="${STYLE.p}"><span style="${STYLE.label}">EXAMPLES</span> <span style="${STYLE.value}">${nl2br(sp.examples)}</span></p>`)
    }

    L.push(`</div>`)
  })

  L.push(`<div style="${STYLE.signature}">`)
  L.push(`<p style="${STYLE.p}">Best regards,</p>`)
  L.push(`<p style="${STYLE.signatureName}">${esc(userName)}</p>`)
  L.push(`<p style="${STYLE.signatureCompany}">APPROX — HK Sources Fair 2026</p>`)
  L.push(`</div>`)

  L.push(`</div>`)
  return L.join('\n')
}

export function generateProductEmailHTML(
  product: Product,
  supplierName: string,
  userMessage: string,
  userName: string,
): string {
  const L: string[] = []

  L.push(`<div style="${STYLE.wrap}">`)
  L.push(`<p style="${STYLE.p}">Hello,</p>`)
  L.push(`<p style="${STYLE.p}">Dear <strong>${esc(supplierName)}</strong> team,</p>`)
  L.push(`<p style="${STYLE.p}">I'm writing in reference to this product:</p>`)

  L.push(`<div style="${STYLE.product}">`)
  L.push(`<p style="${STYLE.productTitle}">${esc(product.product_type || '')}${product.item_model ? ` — ${esc(product.item_model)}` : ''}</p>`)

  const row = (label: string, value: string) =>
    `<p style="${STYLE.p}"><span style="${STYLE.label}">${label}</span> <span style="${STYLE.value}">${value}</span></p>`

  if (product.price != null) L.push(row('PRICE', fmtPrice(product.price, product.price_currency)))
  if (product.moq != null) L.push(row('MOQ', String(product.moq)))
  if (product.features) L.push(row('FEATURES', esc(product.features)))
  if (product.options) L.push(row('OPTIONS', esc(product.options)))
  L.push(`</div>`)

  if (userMessage?.trim()) {
    L.push(`<p style="${STYLE.p}; white-space: pre-wrap;">${nl2br(userMessage.trim())}</p>`)
  }

  L.push(`<div style="${STYLE.signature}">`)
  L.push(`<p style="${STYLE.p}">Best regards,</p>`)
  L.push(`<p style="${STYLE.signatureName}">${esc(userName)}</p>`)
  L.push(`<p style="${STYLE.signatureCompany}">APPROX — HK Sources Fair 2026</p>`)
  L.push(`</div>`)

  L.push(`</div>`)
  return L.join('\n')
}

// Copy HTML (with plain-text fallback) to clipboard so Outlook preserves formatting on paste
export async function copyHTMLToClipboard(html: string, plainText: string): Promise<boolean> {
  try {
    // Modern clipboard API with HTML support
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const blob = new Blob([html], { type: 'text/html' })
      const textBlob = new Blob([plainText], { type: 'text/plain' })
      const item = new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob,
      })
      await navigator.clipboard.write([item])
      return true
    }
    // Fallback: copy plain text
    await navigator.clipboard.writeText(plainText)
    return true
  } catch (err) {
    console.error('Clipboard error:', err)
    return false
  }
}
