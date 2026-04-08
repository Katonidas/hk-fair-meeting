import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import type { SearchedProduct } from '@/types/searchedProduct'

export default function SearchedProducts() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<SearchedProduct | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<string | null>(null)

  const products = useLiveQuery(async () => {
    const all = await db.searched_products.toArray()
    if (!search) return all.sort((a, b) => a.product_type.localeCompare(b.product_type))
    const q = search.toLowerCase()
    return all
      .filter(p =>
        p.brand.toLowerCase().includes(q) ||
        p.product_type.toLowerCase().includes(q) ||
        p.ref_segment.toLowerCase().includes(q) ||
        p.model_interno.toLowerCase().includes(q) ||
        p.main_specs.toLowerCase().includes(q)
      )
      .sort((a, b) => a.product_type.localeCompare(b.product_type))
  }, [search])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
      let count = 0
      const now = new Date().toISOString()

      for (const row of rows) {
        const productType = String(row['TIPO DE PRODUCTO'] || row['product_type'] || row['tipo'] || row['Tipo de producto'] || '').trim()
        if (!productType) continue

        await db.searched_products.add({
          id: uuid(),
          brand: String(row['MARCA'] || row['brand'] || row['Marca'] || '').trim(),
          product_type: productType,
          ref_segment: String(row['REF. / SEGMENTO'] || row['ref_segment'] || row['Ref'] || row['Segmento'] || '').trim(),
          main_specs: String(row['MAIN SPECS'] || row['main_specs'] || row['Specs'] || row['specs'] || '').trim(),
          target_cost: parseNum(row['TARGET COST'] || row['target_cost'] || row['Target Cost']),
          examples: String(row['EXAMPLES'] || row['examples'] || row['Examples'] || '').trim(),
          margin_target: String(row['MARGIN TARGET'] || row['margin_target'] || row['Margin'] || '').trim(),
          pvpr: parseNum(row['PVPR'] || row['pvpr'] || row['PVP']),
          model_interno: String(row['MODEL INTERNO'] || row['model_interno'] || row['Modelo'] || '').trim(),
          created_at: now,
          updated_at: now,
          synced_at: null,
        })
        count++
      }
      setImportResult(`${count} productos importados`)
    } catch (err) {
      setImportResult(`Error: ${err instanceof Error ? err.message : 'desconocido'}`)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este producto buscado?')) return
    await db.searched_products.delete(id)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-lg font-bold text-primary">HK Fair</button>
          <span className="mx-2 text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-800">Productos Buscados</h1>
        </div>
      </header>

      <div className="flex-1 px-4 py-3">
        {/* Actions */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => { setEditingProduct(null); setShowForm(true) }}
            className="rounded-lg bg-primary px-4 py-2.5 text-xs font-medium text-white"
          >
            + Nuevo
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-primary bg-white px-4 py-2.5 text-xs font-medium text-primary"
          >
            Importar Excel
          </button>
        </div>
        {importResult && (
          <p className={`mb-3 text-xs ${importResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{importResult}</p>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar por marca, tipo, specs, modelo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none"
        />

        {/* Table */}
        {!products || products.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-4xl">🔍</p>
            <p className="mt-2">No hay productos buscados</p>
            <p className="text-xs">Importa desde Excel o crea uno nuevo</p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Marca</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Ref/Segmento</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Specs</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Target $</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">PVPR</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Modelo</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 bg-white hover:bg-blue-50">
                    <td className="px-3 py-2.5 font-medium text-gray-800">{p.brand || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{p.product_type}</td>
                    <td className="px-3 py-2.5 text-gray-500">{p.ref_segment || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[150px] truncate">{p.main_specs || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{p.target_cost ? `$${p.target_cost}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{p.pvpr ? `${p.pvpr}€` : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{p.model_interno || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => { setEditingProduct(p); setShowForm(true) }}
                          className="rounded px-2 py-1 text-[10px] text-primary hover:bg-primary/10"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="rounded px-2 py-1 text-[10px] text-red-500 hover:bg-red-50"
                        >
                          X
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <SearchedProductForm
          product={editingProduct}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

function SearchedProductForm({
  product,
  onClose,
}: {
  product: SearchedProduct | null
  onClose: () => void
}) {
  const [brand, setBrand] = useState(product?.brand || '')
  const [productType, setProductType] = useState(product?.product_type || '')
  const [refSegment, setRefSegment] = useState(product?.ref_segment || '')
  const [mainSpecs, setMainSpecs] = useState(product?.main_specs || '')
  const [targetCost, setTargetCost] = useState(product?.target_cost?.toString() || '')
  const [examples, setExamples] = useState(product?.examples || '')
  const [marginTarget, setMarginTarget] = useState(product?.margin_target || '')
  const [pvpr, setPvpr] = useState(product?.pvpr?.toString() || '')
  const [modelInterno, setModelInterno] = useState(product?.model_interno || '')

  async function handleSave() {
    if (!productType.trim()) return
    const now = new Date().toISOString()
    const data = {
      brand: brand.trim(),
      product_type: productType.trim(),
      ref_segment: refSegment.trim(),
      main_specs: mainSpecs.trim(),
      target_cost: targetCost ? parseFloat(targetCost) : null,
      examples: examples.trim(),
      margin_target: marginTarget.trim(),
      pvpr: pvpr ? parseFloat(pvpr) : null,
      model_interno: modelInterno.trim(),
      updated_at: now,
    }

    if (product) {
      await db.searched_products.update(product.id, data)
    } else {
      await db.searched_products.add({
        id: uuid(),
        ...data,
        created_at: now,
        synced_at: null,
      })
    }
    onClose()
  }

  const fieldCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">
            {product ? 'Editar producto buscado' : 'Nuevo producto buscado'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Marca</label>
              <input type="text" value={brand} onChange={e => setBrand(e.target.value)} className={fieldCls} placeholder="APPROX, NGS..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Tipo de producto *</label>
              <input type="text" value={productType} onChange={e => setProductType(e.target.value)} className={fieldCls} placeholder="Ratón, teclado, monitor..." autoFocus />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Ref. / Segmento</label>
              <input type="text" value={refSegment} onChange={e => setRefSegment(e.target.value)} className={fieldCls} placeholder="Entry Level, MID, PRO..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Modelo interno</label>
              <input type="text" value={modelInterno} onChange={e => setModelInterno(e.target.value)} className={fieldCls} placeholder="Nombre comercial..." />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Main Specs</label>
            <textarea value={mainSpecs} onChange={e => setMainSpecs(e.target.value)} rows={3} className={fieldCls} placeholder="Especificaciones o requerimientos principales..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Target Cost ($)</label>
              <input type="number" value={targetCost} onChange={e => setTargetCost(e.target.value)} className={fieldCls} placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Margin Target</label>
              <input type="text" value={marginTarget} onChange={e => setMarginTarget(e.target.value)} className={fieldCls} placeholder="30%, x2..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">PVPR (€)</label>
              <input type="number" value={pvpr} onChange={e => setPvpr(e.target.value)} className={fieldCls} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Examples <span className="font-normal text-gray-400">— links o referencias</span></label>
            <textarea value={examples} onChange={e => setExamples(e.target.value)} rows={2} className={fieldCls} placeholder="Links a productos similares, fotos de referencia..." />
          </div>
          <button onClick={handleSave} disabled={!productType.trim()}
            className="mt-1 w-full rounded-lg bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark disabled:opacity-50">
            {product ? 'Guardar cambios' : 'Crear producto buscado'}
          </button>
        </div>
      </div>
    </div>
  )
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}
