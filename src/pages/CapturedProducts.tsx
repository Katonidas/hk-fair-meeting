import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { normalize } from '@/lib/normalize'

export default function CapturedProducts() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const products = useLiveQuery(async () => {
    const savedMeetings = await db.meetings.where('status').equals('saved').toArray()
    const meetingIds = new Set(savedMeetings.map(m => m.id))
    const meetingMap = new Map(savedMeetings.map(m => [m.id, m]))

    const allProducts = await db.products.toArray()
    const filtered = allProducts.filter(p => meetingIds.has(p.meeting_id))

    const allSuppliers = await db.suppliers.toArray()
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]))

    const enriched = filtered.map(p => {
      const meeting = meetingMap.get(p.meeting_id)
      const supplier = meeting ? supplierMap.get(meeting.supplier_id) : undefined
      return {
        ...p,
        supplierName: supplier?.name || '—',
        supplierStand: supplier?.stand || '—',
      }
    })

    if (!search) return enriched
    const q = normalize(search)
    return enriched.filter(p =>
      normalize(p.supplierName).includes(q) ||
      normalize(p.product_type).includes(q) ||
      normalize(p.item_model).includes(q) ||
      normalize(p.features).includes(q)
    )
  }, [search])

  async function handleExport() {
    if (!products || products.length === 0) return
    const rows = products.map(p => ({
      'Proveedor': p.supplierName,
      'Stand': p.supplierStand,
      'Tipo producto': p.product_type,
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
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Productos Capturados')
    XLSX.writeFile(wb, `productos-capturados-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="cursor-pointer text-lg font-bold text-primary">HK Fair</button>
          <span className="mx-2 text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-800">Productos Capturados</h1>
        </div>
      </header>

      <div className="flex-1 px-4 py-3">
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            placeholder="Buscar por proveedor, tipo, modelo, features..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleExport}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-3 text-xs font-medium text-gray-600"
          >
            Exportar Excel
          </button>
        </div>

        {!products || products.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-4xl">📦</p>
            <p className="mt-2">No hay productos capturados</p>
            <p className="text-xs">Los productos aparecen aquí cuando guardas una reunión</p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Proveedor</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Stand</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Tipo</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Item/Model</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-500">Precio</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-500">Target</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Features</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-500">MOQ</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Options</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-500">Sample</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 bg-white hover:bg-blue-50">
                    <td className="px-2 py-2.5 font-medium text-gray-800">{p.supplierName}</td>
                    <td className="px-2 py-2.5 text-gray-500">{p.supplierStand}</td>
                    <td className="px-2 py-2.5 text-gray-600">{p.product_type || '—'}</td>
                    <td className="px-2 py-2.5 text-gray-600">{p.item_model || '—'}</td>
                    <td className="px-2 py-2.5 text-right text-gray-600">{p.price ? `$${p.price}` : '—'}</td>
                    <td className="px-2 py-2.5 text-right text-gray-600">{p.target_price ? `$${p.target_price}` : '—'}</td>
                    <td className="px-2 py-2.5 text-gray-500 max-w-[150px] truncate">{p.features || '—'}</td>
                    <td className="px-2 py-2.5 text-right text-gray-600">{p.moq || '—'}</td>
                    <td className="px-2 py-2.5 text-gray-500 max-w-[100px] truncate">{p.options || '—'}</td>
                    <td className="px-2 py-2.5 text-center">
                      {p.sample_status === 'collected' ? (
                        <span className="text-green-600 font-bold">Recogido</span>
                      ) : p.sample_status === 'pending' ? (
                        <span className="text-yellow-600">Pdte</span>
                      ) : (
                        <span className="text-gray-300">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-center text-xs text-gray-400">
          Solo se muestran productos de reuniones guardadas (no borradores)
        </p>
      </div>
    </div>
  )
}
