import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { getCCEmails } from '@/lib/constants'
import { generateEmailSubject, generateEmailBody, buildMailtoUrl } from '@/lib/emailGenerator'
import { translateAndCorrect } from '@/lib/translate'
import { generateMeetingEmailHTML, copyHTMLToClipboard } from '@/lib/htmlEmail'
import type { UserName } from '@/types'

interface Props {
  currentUser: UserName
}

export default function MeetingEmail({ currentUser }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const meeting = useLiveQuery(() => (id ? db.meetings.get(id) : undefined), [id])
  const supplier = useLiveQuery(
    () => (meeting?.supplier_id ? db.suppliers.get(meeting.supplier_id) : undefined),
    [meeting?.supplier_id],
  )
  const products = useLiveQuery(
    () => (id ? db.products.where('meeting_id').equals(id).toArray() : []),
    [id],
  )

  const [toEmails, setToEmails] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [translateSuccess, setTranslateSuccess] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [prepareMsg, setPrepareMsg] = useState('')

  useEffect(() => {
    if (meeting && supplier && products && !initialized) {
      setToEmails(supplier.emails.join(', '))
      setSubject(generateEmailSubject(supplier))
      setBody(generateEmailBody(supplier, meeting, products))
      setInitialized(true)
    }
  }, [meeting, supplier, products, initialized])

  if (!meeting || !supplier) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  const ccEmails = getCCEmails(currentUser)

  function handleOpenEmail() {
    const toList = toEmails.split(',').map(e => e.trim()).filter(Boolean)
    const url = buildMailtoUrl(toList, ccEmails, subject, body)
    window.open(url, '_self')

    // Mark email as generated
    if (id && meeting) {
      const now = new Date().toISOString()
      db.meetings.update(id, {
        email_generated: true,
        email_sent_at: now,
        updated_at: now,
      })
      db.suppliers.update(meeting.supplier_id, {
        visited: true,
        updated_at: now,
        updated_by: currentUser,
      })
    }
  }

  async function handlePrepareEmail() {
    if (!meeting || !supplier || !products) return
    setPreparing(true)
    setPrepareMsg('')
    try {
      // Generate HTML email matching the current body content
      // (use the current editable body as plain text fallback)
      const html = generateMeetingEmailHTML(supplier, meeting, products)
      const copied = await copyHTMLToClipboard(html, body)

      if (copied) {
        setPrepareMsg('HTML copiado al portapapeles. Abriendo Outlook... Pega con Ctrl+V en el cuerpo.')
      } else {
        setPrepareMsg('No se pudo copiar al portapapeles. Abriendo Outlook igualmente...')
      }

      // Open mailto with TO, CC, Subject (empty body so Outlook doesn't wrap our paste)
      const toList = toEmails.split(',').map(e => e.trim()).filter(Boolean)
      const ccList = getCCEmails(currentUser)
      const url = buildMailtoUrl(toList, ccList, subject, '')

      setTimeout(() => {
        window.open(url, '_self')
      }, 300)

      // Mark as generated
      if (id && meeting) {
        const now = new Date().toISOString()
        db.meetings.update(id, { email_generated: true, email_sent_at: now, updated_at: now })
        db.suppliers.update(meeting.supplier_id, { visited: true, updated_at: now, updated_by: currentUser })
      }

      setTimeout(() => setPrepareMsg(''), 8000)
    } finally {
      setPreparing(false)
    }
  }

  async function handleTranslate() {
    setTranslating(true)
    setTranslateError('')
    setTranslateSuccess(false)
    try {
      const translated = await translateAndCorrect(body)
      setBody(translated)
      // Also translate subject if it has Spanish
      const translatedSubject = await translateAndCorrect(subject)
      setSubject(translatedSubject)
      setTranslateSuccess(true)
      setTimeout(() => setTranslateSuccess(false), 3000)
    } catch (err) {
      if (err instanceof Error && err.message === 'NO_CONNECTION') {
        setTranslateError('Sin conexión a Internet. No se puede traducir/corregir.')
      } else {
        setTranslateError('Error al traducir. Inténtalo de nuevo.')
      }
      setTimeout(() => setTranslateError(''), 5000)
    } finally {
      setTranslating(false)
    }
  }

  async function handleSaveDraft() {
    if (!id) return
    await db.meetings.update(id, {
      email_generated: true,
      updated_at: new Date().toISOString(),
    })
    navigate(`/meeting/${id}`)
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 px-4 py-4">
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
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-xs leading-relaxed focus:border-primary focus:outline-none"
          />
        </div>

        {/* Translate status messages */}
        {translateError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {translateError}
          </div>
        )}
        {translateSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm text-green-700">
            Texto traducido y corregido correctamente
          </div>
        )}
        {prepareMsg && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-center text-sm font-medium text-purple-700">
            {prepareMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pb-6">
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-4 text-base font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Guardar borrador
            </button>
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="flex-1 rounded-xl border-2 border-blue-400 bg-blue-50 py-4 text-base font-bold text-blue-700 transition-colors hover:bg-blue-100 active:bg-blue-200 disabled:opacity-50"
            >
              {translating ? 'Traduciendo...' : 'TRADUCIR / CORREGIR'}
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrepareEmail}
              disabled={preparing}
              className="flex-1 rounded-xl border-2 border-purple-500 bg-purple-50 py-4 text-base font-bold text-purple-700 transition-colors hover:bg-purple-100 active:bg-purple-200 disabled:opacity-50"
            >
              {preparing ? 'Preparando...' : 'PREPARAR EMAIL HTML (Outlook)'}
            </button>
            <button
              onClick={handleOpenEmail}
              className="flex-1 rounded-xl bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
            >
              ENVIAR EMAIL (texto plano)
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-500">
            <strong>PREPARAR EMAIL HTML</strong>: copia el email con formato al portapapeles y abre Outlook con TO, CC y asunto. Solo tienes que pegar con Ctrl+V en el cuerpo.
          </p>
          <button
            onClick={() => navigate(`/meeting/${id}`)}
            className="w-full rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Volver a la reunión
          </button>
        </div>
      </div>
    </div>
  )
}
