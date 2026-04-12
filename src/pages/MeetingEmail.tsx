import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { getCCEmails } from '@/lib/constants'
import { generateEmailSubject, generateEmailBody, buildMailtoUrl } from '@/lib/emailGenerator'
import type { UserName, Meeting, Supplier, Product } from '@/types'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface Props {
  currentUser: UserName
}

export default function MeetingEmail({ currentUser }: Props) {
  const { id } = useParams<{ id: string }>()

  const meeting = useLiveQuery(() => (id ? db.meetings.get(id) : undefined), [id])
  const supplier = useLiveQuery(
    () => (meeting?.supplier_id ? db.suppliers.get(meeting.supplier_id) : undefined),
    [meeting?.supplier_id],
  )
  const products = useLiveQuery(
    () => (id ? db.products.where('meeting_id').equals(id).toArray() : []),
    [id],
  )

  if (!id || !meeting || !supplier || !products) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <MeetingEmailForm
      key={id}
      meetingId={id}
      meeting={meeting}
      supplier={supplier}
      products={products}
      currentUser={currentUser}
    />
  )
}

function MeetingEmailForm({
  meetingId,
  meeting,
  supplier,
  products,
  currentUser,
}: {
  meetingId: string
  meeting: Meeting
  supplier: Supplier
  products: Product[]
  currentUser: UserName
}) {
  const navigate = useNavigate()

  // Lazy init: si hay un draft persistido lo usamos, si no lo generamos.
  // De esta forma el usuario puede salir y volver sin perder los edits.
  const [toEmails, setToEmails] = useState(
    () => meeting.email_to_draft || supplier.emails.join(', '),
  )
  const [subject, setSubject] = useState(
    () => meeting.email_subject_draft || generateEmailSubject(supplier),
  )
  const [body, setBody] = useState(
    () => meeting.email_body_draft || generateEmailBody(supplier, meeting, products),
  )
  const [feedback, setFeedback] = useState<string | null>(null)

  const ccEmails = getCCEmails(currentUser)

  // Persiste los edits del email en Meeting (subject/body/to). NO marca
  // email_generated. Lo llaman tanto los botones de envío como "Guardar
  // borrador" — así nunca se pierden los cambios manuales.
  async function persistDraft(): Promise<void> {
    await db.meetings.update(meetingId, {
      email_to_draft: toEmails,
      email_subject_draft: subject,
      email_body_draft: body,
      updated_at: new Date().toISOString(),
    })
  }

  // Marca la reunión como ENVIADA (email_generated:true + email_sent_at) y
  // el supplier como visitado. Compartido por los 2 botones de envío.
  async function markAsSent(): Promise<void> {
    const now = new Date().toISOString()
    await db.meetings.update(meetingId, {
      email_to_draft: toEmails,
      email_subject_draft: subject,
      email_body_draft: body,
      email_generated: true,
      email_sent_at: now,
      updated_at: now,
    })
    await db.suppliers.update(meeting.supplier_id, {
      visited: true,
      updated_at: now,
      updated_by: currentUser,
    })
  }

  // ENVÍO 1 — TEXTO PLANO via mailto:. Abre Thunderbird/Outlook/Gmail/etc.
  async function handleSendPlainText(): Promise<void> {
    const toList = toEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (toList.length === 0) {
      window.alert('Añade al menos un destinatario en el campo TO.')
      return
    }
    const url = buildMailtoUrl(toList, ccEmails, subject, body)

    // Safari/iOS pueden truncar mailto: URLs muy largas (~2000 chars).
    if (url.length > 1800) {
      const ok = window.confirm(
        `El email es muy largo (${url.length} caracteres) y podría no abrirse en algunos clientes. Pulsa OK para intentarlo igualmente, o Cancelar y usar el botón HTML que copia al portapapeles.`,
      )
      if (!ok) return
    }

    // Persistir ANTES de abrir el cliente externo — si window.open redirige
    // la página, las promesas pendientes pueden quedar abortadas.
    try {
      await markAsSent()
    } catch (err) {
      console.error('[handleSendPlainText] persist failed:', err)
      window.alert('No se pudo guardar el estado de la reunión. Inténtalo de nuevo.')
      return
    }

    window.open(url, '_self')
  }

  // ENVÍO 2 — HTML via clipboard. Copia subject + body al portapapeles para
  // pegarlo en Gmail/Outlook web (que sí soportan HTML pegado). mailto: NO
  // soporta HTML, así que esta es la única vía limpia.
  async function handleSendHtml(): Promise<void> {
    const toList = toEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (toList.length === 0) {
      window.alert('Añade al menos un destinatario en el campo TO.')
      return
    }

    try {
      await markAsSent()
    } catch (err) {
      console.error('[handleSendHtml] persist failed:', err)
      window.alert('No se pudo guardar el estado de la reunión. Inténtalo de nuevo.')
      return
    }

    // Construir un bloque HTML simple — el body usa <pre> para preservar
    // saltos de línea y formato monoespaciado del template.
    const htmlBody = [
      `<p><strong>Para:</strong> ${toList.join(', ')}</p>`,
      `<p><strong>CC:</strong> ${ccEmails.join(', ')}</p>`,
      `<p><strong>Asunto:</strong> ${escapeHtml(subject)}</p>`,
      '<hr>',
      `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(body)}</pre>`,
    ].join('\n')

    // Clipboard API moderna — soporta HTML real con ClipboardItem.
    // Si no está disponible (navegadores viejos), fallback a texto plano.
    const clipboard = navigator.clipboard as Clipboard | undefined
    const hasClipboardItem = typeof window !== 'undefined' && 'ClipboardItem' in window

    try {
      if (clipboard && hasClipboardItem && 'write' in clipboard) {
        await clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlBody], { type: 'text/html' }),
            'text/plain': new Blob([body], { type: 'text/plain' }),
          }),
        ])
        setFeedback('✓ Email copiado en formato HTML. Pégalo en Gmail/Outlook.')
      } else if (clipboard) {
        await clipboard.writeText(body)
        setFeedback('✓ Email copiado como texto plano (HTML no soportado en este navegador).')
      } else {
        throw new Error('Clipboard API no disponible')
      }
    } catch (err) {
      console.error('[handleSendHtml] clipboard failed:', err)
      window.alert('No se pudo copiar al portapapeles. Selecciona el texto manualmente.')
      return
    }

    setTimeout(() => setFeedback(null), 4000)
  }

  // BORRADOR — guarda los edits SIN marcar como enviado. Vuelve a la reunión.
  async function handleSaveDraft(): Promise<void> {
    try {
      await persistDraft()
    } catch (err) {
      console.error('[handleSaveDraft]', err)
      window.alert('No se pudo guardar el borrador.')
      return
    }
    navigate(`/meeting/${meetingId}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => navigate(`/meeting/${meetingId}`)} className="rounded-lg p-3 text-gray-500 hover:bg-gray-100" aria-label="Volver a la reunión">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800">Email Resumen</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
        {/* TO */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-gray-500">TO</label>
          <input
            type="text"
            value={toEmails}
            onChange={e => setToEmails(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            placeholder="email@proveedor.com"
          />
        </div>

        {/* CC (read-only) */}
        <div className="rounded-xl bg-gray-50 p-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">CC (automático)</label>
          <p className="text-sm text-gray-600">{ccEmails.join(', ')}</p>
        </div>

        {/* Subject */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-gray-500">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* Body */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-gray-500">Cuerpo del email</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-relaxed focus:border-primary focus:outline-none"
          />
        </div>

        {/* Feedback toast */}
        {feedback && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {feedback}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={handleSendPlainText}
              className="rounded-xl bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
            >
              ENVIAR (TEXTO PLANO)
            </button>
            <button
              onClick={handleSendHtml}
              className="rounded-xl bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
            >
              ENVIAR (HTML — COPIAR)
            </button>
          </div>
          <button
            onClick={handleSaveDraft}
            className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Guardar borrador y volver
          </button>
        </div>
      </div>
    </div>
  )
}
