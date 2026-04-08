import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
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

      let count = 0
      const now = new Date().toISOString()

      for (const row of rows) {
        const name = String(row['name'] || row['Name'] || row['NOMBRE'] || row['nombre'] || row['Supplier'] || row['supplier'] || '').trim()
        if (!name) continue

        const stand = String(row['stand'] || row['Stand'] || row['STAND'] || row['booth'] || row['Booth'] || '').trim()
        const emailRaw = String(row['email'] || row['Email'] || row['EMAIL'] || row['emails'] || '')
        const emails = emailRaw.split(/[,;]/).map(e => e.trim()).filter(Boolean)
        const phone = String(row['phone'] || row['Phone'] || row['PHONE'] || row['tel'] || '').trim()
        const assignedPerson = String(row['assigned_person'] || row['person'] || row['Person'] || row['asignado'] || '').trim()
        const productType = String(row['product_type'] || row['product'] || row['Product'] || row['tipo'] || '').trim()
        const relevanceRaw = Number(row['relevance'] || row['Relevance'] || 2)
        const relevance: Relevance = ([1, 2, 3].includes(relevanceRaw) ? relevanceRaw : 2) as Relevance
        const visitDay = String(row['visit_day'] || row['day'] || '').trim()
        const visitSlot = String(row['visit_slot'] || row['slot'] || '').trim()
        const pendingTopics = String(row['pending_topics'] || row['temas'] || '').trim()
        const interestingProducts = String(row['interesting_products'] || row['productos'] || '').trim()
        const currentProducts = String(row['current_products'] || '').trim()

        await db.suppliers.add({
          id: uuid(),
          name,
          stand,
          assigned_person: assignedPerson,
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
          supplier_notes: '',
          is_new: false,
          updated_at: now,
          updated_by: currentUser,
          created_at: now,
          synced_at: null,
        })
        count++
      }

      setImportResult(`${count} proveedores importados correctamente`)
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
    if (!window.confirm('¿Estás seguro de que quieres borrar TODOS los datos locales? Esta acción no se puede deshacer.')) return
    await db.products.clear()
    await db.product_photos.clear()
    await db.meetings.clear()
    await db.suppliers.clear()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800">Ajustes</h1>
        </div>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        {/* User */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Usuario actual</h2>
          <p className="text-sm text-gray-600">{currentUser}</p>
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
          <button
            onClick={handleClearData}
            className="w-full rounded-lg bg-red-500 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            Borrar todos los datos locales
          </button>
        </div>
      </div>
    </div>
  )
}
