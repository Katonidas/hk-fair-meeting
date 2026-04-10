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

// Convert text with bullet lines (• or -) to a proper HTML list with indentation
function bulletsToHTML(text: string): string {
  if (!text) return ''
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const allBullets = lines.every(l => /^[•\-*·]\s*/.test(l))

  if (allBullets) {
    const items = lines
      .map(l => l.replace(/^[•\-*·]\s*/, ''))
      .map(l => `<li style="margin: 4px 0; padding-left: 8px;">${esc(l)}</li>`)
      .join('')
    return `<ul style="margin: 8px 0 8px 40px; padding-left: 20px; color: #495057; font-size: 12px;">${items}</ul>`
  }

  // Mixed content: convert each bullet line to a li, non-bullet to <p>
  const parts: string[] = []
  for (const line of lines) {
    if (/^[•\-*·]\s*/.test(line)) {
      parts.push(`<li style="margin: 4px 0; padding-left: 8px;">${esc(line.replace(/^[•\-*·]\s*/, ''))}</li>`)
    } else {
      parts.push(`<p style="margin: 6px 0; color: #495057; font-size: 12px;">${esc(line)}</p>`)
    }
  }
  return parts.join('')
}

export function generateMeetingEmailHTML(
  _supplier: Supplier,
  meeting: Meeting,
  products: Product[],
): string {
  const L: string[] = []

  // Styles local to this function
  const sectionGap = 'margin: 24px 0 12px 0;'
  const h1Underlined = 'color: #1a2f5f; font-size: 17px; margin: 24px 0 8px 0; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;'
  const tblWrap = 'width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px;'
  const tblTh = 'background: #1a2f5f; color: #fff; padding: 8px 10px; text-align: left; font-weight: bold; font-size: 11px; text-transform: uppercase; border: 1px solid #1a2f5f;'
  const tblTd = 'padding: 8px 10px; border: 1px solid #dee2e6; vertical-align: top;'
  const tblTdAlt = 'padding: 8px 10px; border: 1px solid #dee2e6; background: #f8f9fa; vertical-align: top;'

  L.push(`<div style="${STYLE.wrap}">`)

  // Greeting — simple "Hello,"
  L.push(`<p style="${STYLE.p}">Hello,</p>`)
  L.push(`<p style="${STYLE.p}">It was a pleasure visiting your stand at the HK Sources Fair. Please find below a summary of our meeting.</p>`)

  // VERY IMPORTANT! (line break before)
  if (meeting.urgent_notes?.trim()) {
    L.push(`<br>`)
    L.push(`<div style="${STYLE.urgent}">`)
    L.push(`<p style="${STYLE.urgentTitle}">&#9888; VERY IMPORTANT!</p>`)
    L.push(`<p style="${STYLE.urgentBody}">${nl2br(meeting.urgent_notes.trim())}</p>`)
    L.push(`</div>`)
  }

  // TERMS & CONDITIONS
  L.push(`<br>`)
  L.push(`<h1 style="${h1Underlined}">Terms &amp; Conditions</h1>`)
  L.push(`<p style="${STYLE.p}"><strong>IMPORTANT:</strong> Please note our standard terms and conditions. <u>All negotiations, agreed conditions and PRICES are based on and must include the following terms:</u></p>`)
  L.push(bulletsToHTML(getTerms()))

  // SERVICE REQUIREMENTS
  L.push(`<p style="${sectionGap} font-weight: bold; color: #5a6678; text-transform: uppercase; font-size: 13px;">Service Requirements</p>`)
  L.push(bulletsToHTML(getQOS()))

  // PRODUCTS OF INTEREST — table
  if (products.length > 0) {
    L.push(`<br>`)
    L.push(`<h1 style="${h1Underlined}">&#128230; PRODUCTS OF INTEREST</h1>`)

    // Check if any product has target price
    const hasTargetPrice = products.some(p => p.target_price != null)

    L.push(`<table style="${tblWrap}">`)
    L.push(`<thead><tr>`)
    L.push(`<th style="${tblTh}">Type</th>`)
    L.push(`<th style="${tblTh}">Model</th>`)
    L.push(`<th style="${tblTh}">Price</th>`)
    L.push(`<th style="${tblTh}">Features</th>`)
    L.push(`<th style="${tblTh}">Options</th>`)
    L.push(`<th style="${tblTh}">MOQ</th>`)
    L.push(`<th style="${tblTh}">Samples</th>`)
    if (hasTargetPrice) L.push(`<th style="${tblTh}">Target Price</th>`)
    L.push(`<th style="${tblTh}">Observations</th>`)
    L.push(`</tr></thead>`)
    L.push(`<tbody>`)

    products.forEach((p, i) => {
      const td = i % 2 === 0 ? tblTd : tblTdAlt
      const sampleLabel = {
        collected: 'Collected',
        pending: 'Pending',
        no: 'No',
      }[p.sample_status]
      const sampleText = `${sampleLabel}${p.sample_units ? ` (${p.sample_units} u.)` : ''}`

      L.push(`<tr>`)
      L.push(`<td style="${td}">${esc(p.product_type || '—')}</td>`)
      L.push(`<td style="${td}"><strong>${esc(p.item_model || '—')}</strong></td>`)
      L.push(`<td style="${td}">${p.price != null ? fmtPrice(p.price, p.price_currency) : '—'}</td>`)
      L.push(`<td style="${td}">${esc(p.features || '—')}</td>`)
      L.push(`<td style="${td}">${esc(p.options || '—')}</td>`)
      L.push(`<td style="${td}">${p.moq != null ? p.moq : '—'}</td>`)
      L.push(`<td style="${td}">${sampleText}</td>`)
      if (hasTargetPrice) {
        L.push(`<td style="${td}">${p.target_price != null ? `<strong style="color: #155724; background: #d4edda; padding: 2px 6px; border-radius: 3px;">${fmtPrice(p.target_price, p.price_currency)}</strong>` : '—'}</td>`)
      }
      L.push(`<td style="${td}">${esc(p.observations || '—')}</td>`)
      L.push(`</tr>`)
    })

    L.push(`</tbody></table>`)
  }

  // PLEASE SEND DATASHEET (no title)
  L.push(`<br>`)
  L.push(`<p style="${STYLE.p}"><strong>PLEASE SEND DATASHEET AND PICTURES OF THESE PRODUCTS ASAP.</strong></p>`)

  // SAMPLES (bold inline + info)
  L.push(`<br>`)
  L.push(`<p style="${STYLE.p}"><strong>SAMPLES:</strong> please prepare all samples indicated above. Please coordinate delivery with Mr. Chen to have them at our Shenzhen hotel on April 15-16. Contact Mr. Chen ASAP: <strong>+86 136 3268 9109</strong>.</p>`)

  // OTROS TEMAS A TENER EN CUENTA
  if (meeting.other_notes?.trim()) {
    L.push(`<br>`)
    L.push(`<p style="${STYLE.p}"><strong>&#9888; OTHER TOPICS TO CONSIDER:</strong></p>`)
    L.push(`<p style="${STYLE.p} white-space: pre-wrap;">${nl2br(meeting.other_notes.trim())}</p>`)
  }

  // Signature — simple "Name - APPROX"
  L.push(`<br><br>`)
  L.push(`<p style="${STYLE.p}">Best regards,</p>`)
  L.push(`<p style="${STYLE.p} font-weight: bold; color: #1a2f5f;">${esc(meeting.user_name)} - APPROX</p>`)

  L.push(`</div>`)
  return L.join('\n')
}

export function generatePotentialProductsEmailHTML(
  _supplier: Supplier,
  products: SearchedProduct[],
  userName: string,
  calcTargetCost: (brand: string, pvpr: number | null, marginTarget: string) => number | null,
): string {
  const L: string[] = []

  const h1Underlined = 'color: #1a2f5f; font-size: 17px; margin: 24px 0 8px 0; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;'
  const tblWrap = 'width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px;'
  const tblTh = 'background: #1a2f5f; color: #fff; padding: 8px 10px; text-align: left; font-weight: bold; font-size: 11px; text-transform: uppercase; border: 1px solid #1a2f5f;'
  const tblTd = 'padding: 8px 10px; border: 1px solid #dee2e6; vertical-align: top;'
  const tblTdAlt = 'padding: 8px 10px; border: 1px solid #dee2e6; background: #f8f9fa; vertical-align: top;'

  L.push(`<div style="${STYLE.wrap}">`)
  L.push(`<p style="${STYLE.p}">Hello,</p>`)
  L.push(`<p style="${STYLE.p}">We are looking for the following products. To make our meeting more efficient, please have ready the products that you consider may fit both in terms of specifications and price, also taking into account the examples we send regarding shape or design.</p>`)
  L.push(`<p style="${STYLE.p}">Of course, if you have any alternative, we will be happy to see it. If you want to send us the information by email in advance, that would be great too. Please send us the best possible offer along with images and specifications of the product.</p>`)

  // TERMS & CONDITIONS
  L.push(`<br>`)
  L.push(`<h1 style="${h1Underlined}">Terms &amp; Conditions</h1>`)
  L.push(`<p style="${STYLE.p}"><u>Please remember that the prices provided must be based on and include our agreed terms and conditions:</u></p>`)
  L.push(bulletsToHTML(getTerms()))

  // PRODUCTS WE ARE LOOKING FOR — table
  L.push(`<br>`)
  L.push(`<h1 style="${h1Underlined}">&#128269; PRODUCTS WE ARE LOOKING FOR</h1>`)

  L.push(`<table style="${tblWrap}">`)
  L.push(`<thead><tr>`)
  L.push(`<th style="${tblTh}">Type</th>`)
  L.push(`<th style="${tblTh}">Ref / Segment</th>`)
  L.push(`<th style="${tblTh}">Specs</th>`)
  L.push(`<th style="${tblTh}">Target Price</th>`)
  L.push(`<th style="${tblTh}">Examples</th>`)
  L.push(`</tr></thead>`)
  L.push(`<tbody>`)

  products.forEach((sp, i) => {
    const td = i % 2 === 0 ? tblTd : tblTdAlt
    const tc = calcTargetCost(sp.brand, sp.pvpr, sp.margin_target)
    const specsInline = sp.main_specs ? sp.main_specs.replace(/\n+/g, ' | ') : '—'

    L.push(`<tr>`)
    L.push(`<td style="${td}"><strong>${esc(sp.product_type || '—')}</strong>${sp.brand ? `<br><span style="color: #6c757d; font-size: 10px;">${esc(sp.brand)}</span>` : ''}</td>`)
    L.push(`<td style="${td}">${esc(sp.ref_segment || '—')}</td>`)
    L.push(`<td style="${td}">${esc(specsInline)}</td>`)
    L.push(`<td style="${td}">${tc != null ? `<strong style="color: #155724; background: #d4edda; padding: 2px 6px; border-radius: 3px;">${fmtPrice(tc, 'USD')}</strong>` : '—'}</td>`)
    L.push(`<td style="${td}">${sp.examples ? nl2br(sp.examples) : '—'}</td>`)
    L.push(`</tr>`)
  })

  L.push(`</tbody></table>`)

  // Signature
  L.push(`<br><br>`)
  L.push(`<p style="${STYLE.p}">Best regards,</p>`)
  L.push(`<p style="${STYLE.p} font-weight: bold; color: #1a2f5f;">${esc(userName)} - APPROX</p>`)

  L.push(`</div>`)
  return L.join('\n')
}

export function generateProductEmailHTML(
  product: Product,
  _supplierName: string,
  userMessage: string,
  userName: string,
): string {
  const L: string[] = []

  const h1Underlined = 'color: #1a2f5f; font-size: 17px; margin: 24px 0 8px 0; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;'
  const tblWrap = 'width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px;'
  const tblTh = 'background: #1a2f5f; color: #fff; padding: 8px 10px; text-align: left; font-weight: bold; font-size: 11px; text-transform: uppercase; border: 1px solid #1a2f5f;'
  const tblTd = 'padding: 8px 10px; border: 1px solid #dee2e6; vertical-align: top;'

  L.push(`<div style="${STYLE.wrap}">`)
  L.push(`<p style="${STYLE.p}">Hello,</p>`)
  L.push(`<p style="${STYLE.p}">I'm writing in reference to this product:</p>`)

  // PRODUCT — table
  L.push(`<br>`)
  L.push(`<h1 style="${h1Underlined}">&#128230; PRODUCT DETAILS</h1>`)

  const hasTargetPrice = product.target_price != null

  L.push(`<table style="${tblWrap}">`)
  L.push(`<thead><tr>`)
  L.push(`<th style="${tblTh}">Type</th>`)
  L.push(`<th style="${tblTh}">Model</th>`)
  L.push(`<th style="${tblTh}">Price</th>`)
  L.push(`<th style="${tblTh}">Features</th>`)
  L.push(`<th style="${tblTh}">Options</th>`)
  L.push(`<th style="${tblTh}">MOQ</th>`)
  if (hasTargetPrice) L.push(`<th style="${tblTh}">Target Price</th>`)
  L.push(`</tr></thead>`)
  L.push(`<tbody><tr>`)
  L.push(`<td style="${tblTd}">${esc(product.product_type || '—')}</td>`)
  L.push(`<td style="${tblTd}"><strong>${esc(product.item_model || '—')}</strong></td>`)
  L.push(`<td style="${tblTd}">${product.price != null ? fmtPrice(product.price, product.price_currency) : '—'}</td>`)
  L.push(`<td style="${tblTd}">${esc(product.features || '—')}</td>`)
  L.push(`<td style="${tblTd}">${esc(product.options || '—')}</td>`)
  L.push(`<td style="${tblTd}">${product.moq != null ? product.moq : '—'}</td>`)
  if (hasTargetPrice) {
    L.push(`<td style="${tblTd}"><strong style="color: #155724; background: #d4edda; padding: 2px 6px; border-radius: 3px;">${fmtPrice(product.target_price, product.price_currency)}</strong></td>`)
  }
  L.push(`</tr></tbody></table>`)

  if (userMessage?.trim()) {
    L.push(`<br>`)
    L.push(`<p style="${STYLE.p} white-space: pre-wrap;">${nl2br(userMessage.trim())}</p>`)
  }

  // Signature
  L.push(`<br><br>`)
  L.push(`<p style="${STYLE.p}">Best regards,</p>`)
  L.push(`<p style="${STYLE.p} font-weight: bold; color: #1a2f5f;">${esc(userName)} - APPROX</p>`)

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
