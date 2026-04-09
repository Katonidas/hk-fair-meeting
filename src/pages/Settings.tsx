import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { getTerms, setTerms as saveTerms, getQOS, setQOS as saveQOS, getCCEmailsSetting, setCCEmailsSetting as saveCCEmails, getFormulaGameStr, setFormulaGame as saveFormulaGame, getFormulaTicnovaStr, setFormulaTicnova as saveFormulaTicnova } from '@/lib/settings'
import type { UserName, Relevance } from '@/types'

interface Props {
  currentUser: UserName
}

export default function Settings({ currentUser }: Props) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [terms, setTermsState] = useState(getTerms())
  const [qos, setQosState] = useState(getQOS())
  const [ccEmails, setCcEmailsState] = useState(getCCEmailsSetting())
  const [formulaGame, setFormulaGameState] = useState(getFormulaGameStr())
  const [formulaTicnova, setFormulaTicnovaState] = useState(getFormulaTicnovaStr())
  const [settingsSaved, setSettingsSaved] = useState(false)

  function handleSaveEmailSettings() {
    saveTerms(terms)
    saveQOS(qos)
    saveCCEmails(ccEmails)
    saveFormulaGame(formulaGame)
    saveFormulaTicnova(formulaTicnova)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

      if (rows.length === 0) {
        setImportResult('Error: El archivo está vacío')
        return
      }

      const cols = Object.keys(rows[0])

      // Flexible column matcher
      const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const get = (row: Record<string, unknown>, ...keys: string[]) => {
        const normKeys = keys.map(norm)
        for (const col of Object.keys(row)) {
          const normCol = norm(col)
          // Match if normalized column contains any key or key contains column (min 3 chars to avoid false matches)
          if (normKeys.some(nk => normCol === nk || (nk.length >= 3 && normCol.includes(nk)) || (normCol.length >= 3 && nk.includes(normCol)))) {
            if (row[col] !== undefined && row[col] !== null && row[col] !== '') return String(row[col]).trim()
          }
        }
        return ''
      }

      let count = 0
      let skipped = 0
      const now = new Date().toISOString()

      for (const row of rows) {
        // Try to find name from multiple possible column names
        let name = get(row, 'nombre', 'name', 'supplier', 'proveedor', 'empresa', 'company')
        // Fallback: if no name found, try the first column value
        if (!name) {
          const firstCol = Object.keys(row)[0]
          if (firstCol && row[firstCol] !== undefined && row[firstCol] !== null && row[firstCol] !== '') {
            name = String(row[firstCol]).trim()
          }
        }
        if (!name) { skipped++; continue }

        const stand = get(row, 'stand', 'booth', 'ubicacion')
        const emailRaw = get(row, 'email', 'emails', 'correo', 'mail')
        const emails = emailRaw.split(/[,;]/).map(e => e.trim()).filter(Boolean)
        const phone = get(row, 'phone', 'telefono', 'tel', 'movil', 'mobile')
        const assignedPerson = get(row, 'personaasignada', 'asignado', 'assigned')
        const contactPerson = get(row, 'contacto', 'contact', 'persona', 'person')
        const productType = get(row, 'tipodeproducto', 'tipoproducto', 'tipo', 'product', 'producto', 'category')
        const relevanceRaw = Number(get(row, 'relevancia', 'relevance', 'prioridad') || '2')
        const relevance: Relevance = ([1, 2, 3].includes(relevanceRaw) ? relevanceRaw : 2) as Relevance
        const visitDay = get(row, 'visitday', 'dia', 'day')
        const visitSlot = get(row, 'visitslot', 'slot', 'horario')
        const pendingTopics = get(row, 'temaspendientes', 'pending', 'temas', 'incidencias')
        const interestingProducts = get(row, 'productosinteresantes', 'interesting', 'interes')
        const currentProducts = get(row, 'productosactuales', 'current', 'actuales')
        const supplierNotes = get(row, 'notas', 'notes', 'observaciones')

        await db.suppliers.add({
          id: uuid(),
          name,
          stand,
          assigned_person: assignedPerson,
          contact_person: contactPerson,
          product_type: productType,
          emails,
          phone,
          relevance,
          visit_day: visitDay,
          visit_slot: visitSlot,
          visited: false,
          pending_topics: pendingTopics,
          interesting_products: interestingProducts,
          has_catalogue: false,
          current_products: currentProducts,
          supplier_notes: supplierNotes,
          is_new: false,
          updated_at: now,
          updated_by: currentUser,
          created_at: now,
          synced_at: null,
        })
        count++
      }

      setImportResult(`${count} proveedores importados${skipped ? ` (${skipped} filas vacías)` : ''}. Columnas: ${cols.join(', ')}`)
    } catch (err) {
      setImportResult(`Error al importar: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const allMeetings = await db.meetings.toArray()
      const allProducts = await db.products.toArray()
      const allSuppliers = await db.suppliers.toArray()

      const suppliersMap = new Map(allSuppliers.map(s => [s.id, s]))

      // Sheet 1: Meetings
      const meetingRows = allMeetings.map(m => {
        const s = suppliersMap.get(m.supplier_id)
        return {
          'Proveedor': s?.name || '',
          'Stand': s?.stand || '',
          'Quién fue': m.user_name,
          'Fecha/Hora': m.visited_at,
          'Notas urgentes': m.urgent_notes,
          'Otras notas': m.other_notes,
          'Email enviado': m.email_generated ? 'Sí' : 'No',
        }
      })

      // Sheet 2: Products
      const productRows = allProducts.map(p => {
        const meeting = allMeetings.find(m => m.id === p.meeting_id)
        const s = meeting ? suppliersMap.get(meeting.supplier_id) : undefined
        return {
          'Proveedor': s?.name || '',
          'Stand': s?.stand || '',
          'Tipo Producto': p.product_type,
          'Item/Model': p.item_model,
          'Precio': p.price,
          'Moneda': p.price_currency,
          'Target Price': p.target_price,
          'Features': p.features,
          'MOQ': p.moq,
          'Options': p.options,
          'Sample': p.sample_status,
          'Sample Units': p.sample_units,
          'Observaciones': p.observations,
        }
      })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meetingRows), 'Reuniones')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Productos')

      XLSX.writeFile(wb, `hk-fair-export-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  async function handleClearData() {
    const pwd = window.prompt('Introduce la contraseña para borrar todos los datos:')
    if (pwd !== 'APPROX') {
      if (pwd !== null) window.alert('Contraseña incorrecta')
      return
    }
    if (!window.confirm('¿Estás seguro? Se borrarán TODOS los datos locales. Esta acción no se puede deshacer.')) return
    await db.products.clear()
    await db.product_photos.clear()
    await db.meetings.clear()
    await db.suppliers.clear()
    await db.searched_products.clear()
    navigate('/')
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 px-4 py-4">
        {/* User */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Usuario actual</h2>
          <p className="text-sm text-gray-600">{currentUser}</p>
        </div>

        {/* Email Templates */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Plantilla de email</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Terms & Conditions <span className="font-normal text-gray-400">— aparece en todos los emails</span></label>
              <textarea
                value={terms}
                onChange={e => setTermsState(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-xs focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Quality of Service <span className="font-normal text-gray-400">— aparece en todos los emails</span></label>
              <textarea
                value={qos}
                onChange={e => setQosState(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-xs focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Destinatarios CC <span className="font-normal text-gray-400">— un email por línea, se excluye automáticamente el usuario actual</span></label>
              <textarea
                value={ccEmails}
                onChange={e => setCcEmailsState(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-xs focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700">Fórmulas Target Cost</label>
              <p className="mb-2 text-[10px] text-gray-400">Fórmula: ((PVPR / 1.21) * (1 - margen)) / divisor. Edita el divisor de cada marca:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">GAME (divisor)</label>
                  <input type="number" step="0.01" value={formulaGame} onChange={e => setFormulaGameState(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">TICNOVA (divisor)</label>
                  <input type="number" step="0.01" value={formulaTicnova} onChange={e => setFormulaTicnovaState(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveEmailSettings}
              className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-primary-light"
            >
              {settingsSaved ? 'Guardado ✓' : 'Guardar ajustes'}
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Importar proveedores</h2>
          <p className="mb-3 text-xs text-gray-400">
            Acepta archivos .xlsx y .csv. Columnas esperadas: name, stand, email, phone, assigned_person, product_type, relevance
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {importing ? 'Importando...' : 'Seleccionar archivo Excel/CSV'}
          </button>
          {importResult && (
            <p className={`mt-2 text-xs ${importResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
              {importResult}
            </p>
          )}
        </div>

        {/* Export */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Exportar datos</h2>
          <p className="mb-3 text-xs text-gray-400">
            Genera un archivo Excel con dos hojas: Reuniones y Productos
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full rounded-lg border border-primary bg-white py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
          >
            {exporting ? 'Exportando...' : 'Exportar todo a Excel'}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-700">Zona peligrosa</h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={async () => {
                const pwd = window.prompt('Contraseña para borrar reuniones:')
                if (pwd !== 'APPROX') { if (pwd !== null) window.alert('Contraseña incorrecta'); return }
                if (!window.confirm('¿Borrar TODAS las reuniones y sus productos?')) return
                await db.products.clear()
                await db.product_photos.clear()
                await db.meetings.clear()
              }}
              className="w-full rounded-lg border border-red-300 bg-white py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              Borrar todas las reuniones
            </button>
            <button
              onClick={async () => {
                const pwd = window.prompt('Contraseña para borrar proveedores:')
                if (pwd !== 'APPROX') { if (pwd !== null) window.alert('Contraseña incorrecta'); return }
                if (!window.confirm('¿Borrar TODOS los proveedores? Las reuniones asociadas NO se borran.')) return
                await db.suppliers.clear()
              }}
              className="w-full rounded-lg border border-red-300 bg-white py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              Borrar todos los proveedores
            </button>
            <button
              onClick={handleClearData}
              className="w-full rounded-lg bg-red-500 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              Borrar TODOS los datos locales
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
