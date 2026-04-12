import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import { diagnoseSync, syncNow, type SyncDiagnosis } from '@/lib/sync'
import type { UserName, Relevance } from '@/types'
import { PRODUCT_RELEVANCE_LABELS } from '@/lib/constants'

// xlsx pesa ~600 KiB minified. Lo cargamos dinámicamente para no inflar el
// bundle inicial — Settings es una página secundaria a la que casi no se
// entra durante el uso normal en la feria.
const loadXLSX = () => import('xlsx')

interface Props {
  currentUser: UserName
}

export default function Settings({ currentUser }: Props) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<SyncDiagnosis | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function handleDiagnose() {
    setDiagLoading(true)
    try {
      const result = await diagnoseSync()
      setDiagnosis(result)
    } catch (err) {
      console.error('[diagnoseSync]', err)
      window.alert(`Error en diagnóstico: ${err instanceof Error ? err.message : 'desconocido'}`)
    } finally {
      setDiagLoading(false)
    }
  }

  async function handleForceSyncNow() {
    setSyncing(true)
    try {
      await syncNow()
      // Re-diagnosticar tras el sync para ver el resultado actualizado.
      const result = await diagnoseSync()
      setDiagnosis(result)
    } finally {
      setSyncing(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    try {
      const XLSX = await loadXLSX()
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

      const now = new Date().toISOString()

      // 1. Construir todas las filas en memoria (sin tocar Dexie todavía).
      const candidates = rows
        .map(row => {
          const name = String(row['name'] || row['Name'] || row['NOMBRE'] || row['nombre'] || row['Supplier'] || row['supplier'] || '').trim()
          if (!name) return null

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

          return {
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
          }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)

      // 2. Dedup contra los proveedores ya existentes (clave = nombre+stand).
      // Evita duplicados al reimportar el mismo Excel. Bug encontrado por
      // code review (#5).
      const existing = await db.suppliers.toArray()
      const existingKeys = new Set(existing.map(s => `${s.name.toLowerCase()}|${s.stand.toLowerCase()}`))
      const toInsert = candidates.filter(s => !existingKeys.has(`${s.name.toLowerCase()}|${s.stand.toLowerCase()}`))
      const skipped = candidates.length - toInsert.length

      // 3. Bulk insert atómico — si peta, no queda nada a medias.
      await db.transaction('rw', db.suppliers, async () => {
        await db.suppliers.bulkAdd(toInsert)
      })

      const parts = [`${toInsert.length} proveedores importados`]
      if (skipped > 0) parts.push(`${skipped} duplicados omitidos`)
      setImportResult(parts.join(', '))
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
      const XLSX = await loadXLSX()
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
        const relevance: Relevance = p.relevance ?? 2
        return {
          'Proveedor': s?.name || '',
          'Stand': s?.stand || '',
          'Item/Model': p.item_model,
          'Importancia': `${relevance}. ${PRODUCT_RELEVANCE_LABELS[relevance]}`,
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
    // Doble confirmación: prompt requiere escribir "BORRAR" para evitar
    // pulsaciones accidentales en la zona peligrosa.
    if (!window.confirm('¿Estás seguro de que quieres borrar TODOS los datos locales? Esta acción no se puede deshacer.')) return
    const typed = window.prompt('Escribe BORRAR (en mayúsculas) para confirmar:')
    if (typed?.trim() !== 'BORRAR') {
      window.alert('Cancelado: el texto no coincide.')
      return
    }
    try {
      await db.transaction('rw', db.products, db.product_photos, db.meetings, db.suppliers, async () => {
        await db.products.clear()
        await db.product_photos.clear()
        await db.meetings.clear()
        await db.suppliers.clear()
      })
      navigate('/')
    } catch (err) {
      console.error('[handleClearData]', err)
      window.alert(`Error al borrar los datos: ${err instanceof Error ? err.message : 'desconocido'}`)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded-lg p-3 text-gray-500 hover:bg-gray-100" aria-label="Volver al inicio">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800">Ajustes</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
        {/* User */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Usuario actual</h2>
          <p className="text-sm text-gray-600">{currentUser}</p>
        </div>

        {/* Sync diagnostics */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Sincronización con Supabase</h2>
          <p className="mb-3 text-xs text-gray-400">
            Si los datos no aparecen en otros dispositivos, prueba el diagnóstico aquí abajo.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleDiagnose}
              disabled={diagLoading}
              className="flex-1 rounded-lg border border-primary bg-white py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              {diagLoading ? 'Comprobando...' : 'Diagnosticar conexión'}
            </button>
            <button
              onClick={handleForceSyncNow}
              disabled={syncing}
              className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Forzar sync ahora'}
            </button>
          </div>
          {diagnosis && <SyncDiagnosisPanel diagnosis={diagnosis} />}
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

function SyncDiagnosisPanel({ diagnosis }: { diagnosis: SyncDiagnosis }) {
  const tableStatus = (s: 'ok' | { error: string }) =>
    s === 'ok' ? (
      <span className="text-green-600">✓ OK</span>
    ) : (
      <span className="text-red-600">✗ {s.error}</span>
    )

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-xs">
      <Row label="Supabase configurado">
        {diagnosis.configured ? (
          <span className="text-green-600">✓ Sí</span>
        ) : (
          <span className="text-red-600">✗ Falta VITE_SUPABASE_URL/KEY</span>
        )}
      </Row>
      <Row label="Conexión a internet">
        {diagnosis.online ? (
          <span className="text-green-600">✓ Online</span>
        ) : (
          <span className="text-red-600">✗ Offline</span>
        )}
      </Row>
      <Row label="Servidor accesible">
        {diagnosis.reachable ? (
          <span className="text-green-600">✓ Sí</span>
        ) : (
          <span className="text-red-600">✗ No responde</span>
        )}
      </Row>
      <div className="border-t border-gray-200 pt-2">
        <p className="mb-1 font-medium text-gray-600">Tablas Supabase</p>
        <Row label="suppliers">{tableStatus(diagnosis.tables.suppliers)}</Row>
        <Row label="meetings">{tableStatus(diagnosis.tables.meetings)}</Row>
        <Row label="products">{tableStatus(diagnosis.tables.products)}</Row>
      </div>
      <div className="border-t border-gray-200 pt-2">
        <p className="mb-1 font-medium text-gray-600">Datos locales (Dexie)</p>
        <Row label="Suppliers">{diagnosis.localCounts.suppliers}</Row>
        <Row label="Meetings">{diagnosis.localCounts.meetings}</Row>
        <Row label="Products">{diagnosis.localCounts.products}</Row>
      </div>
      <div className="border-t border-gray-200 pt-2">
        <p className="mb-1 font-medium text-gray-600">Pendientes de subir</p>
        <Row label="Suppliers dirty">{diagnosis.pendingPush.suppliers}</Row>
        <Row label="Meetings dirty">{diagnosis.pendingPush.meetings}</Row>
      </div>
      {!diagnosis.reachable && diagnosis.configured && diagnosis.online && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-700">
          ⚠ Las tablas de Supabase no responden. Verifica que ejecutaste el SQL en
          <code className="mx-1 rounded bg-amber-100 px-1">docs/supabase-schema.sql</code>
          en el SQL Editor del proyecto Supabase.
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-700">{children}</span>
    </div>
  )
}
