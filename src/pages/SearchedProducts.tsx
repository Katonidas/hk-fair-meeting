import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { normalize } from '@/lib/normalize'
import { getFormulaGame, getFormulaTicnova } from '@/lib/settings'
import type { SearchedProduct } from '@/types/searchedProduct'

function formatMarginDisplay(margin: string): string {
  if (!margin) return '—'
  const val = parseFloat(margin.replace('%', '').replace(',', '.').trim())
  if (isNaN(val)) return margin
  // If stored as decimal (e.g. 0.6), show as 60%
  if (val > 0 && val < 1) return `${Math.round(val * 100)}%`
  // If already a percentage number (e.g. 60), show as 60%
  return `${Math.round(val)}%`
}

function calcTargetCost(brand: string, pvpr: number | null, marginTarget: string): number | null {
  if (!pvpr || !marginTarget) return null
  const margin = parseFloat(marginTarget.replace('%', '').replace(',', '.').trim())
  if (isNaN(margin)) return null
  const m = margin > 1 ? margin / 100 : margin
  const brandUpper = brand.toUpperCase().trim()
  const divisorGame = getFormulaGame()
  const divisorTicnova = getFormulaTicnova()
  if (brandUpper === 'TICNOVA') {
    return Math.round(((pvpr / 1.21) * (1 - m)) / divisorTicnova * 100) / 100
  }
  // GAME and default
  return Math.round(((pvpr / 1.21) * (1 - m)) / divisorGame * 100) / 100
}

export default function SearchedProducts() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<SearchedProduct | null>(null)
  const [viewingProduct, setViewingProduct] = useState<SearchedProduct | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<string | null>(null)

  const products = useLiveQuery(async () => {
    const all = await db.searched_products.toArray()
    if (!search) return all.sort((a, b) => a.product_type.localeCompare(b.product_type))
    const q = normalize(search)
    return all
      .filter(p =>
        normalize(p.brand).includes(q) ||
        normalize(p.product_type).includes(q) ||
        normalize(p.ref_segment).includes(q) ||
        normalize(p.model_interno).includes(q) ||
        normalize(p.main_specs).includes(q)
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

      if (rows.length === 0) {
        setImportResult('Error: El archivo está vacío o no se pudieron leer filas')
        return
      }

      // Show detected columns for debugging
      const cols = Object.keys(rows[0])
      console.log('Columnas detectadas:', cols)

      let count = 0
      let skipped = 0
      const now = new Date().toISOString()

      for (const row of rows) {
        // Flexible column matching: try to find a value by checking multiple possible column names
        // Normalize: lowercase, remove accents, remove all non-alphanumeric
        const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

        const get = (...keys: string[]) => {
          const normKeys = keys.map(norm)
          // Try each column in the row
          for (const col of Object.keys(row)) {
            const normCol = norm(col)
            if (normKeys.some(nk => normCol === nk || normCol.includes(nk) || nk.includes(normCol))) {
              if (row[col] !== undefined && row[col] !== null && row[col] !== '') return String(row[col]).trim()
            }
          }
          return ''
        }

        const brand = get('marca', 'brand')
        const productType = get('tipodeproducto', 'tipoproducto', 'tipo', 'producttype', 'type')
        const refSegment = get('refsegmento', 'ref', 'segmento', 'segment')
        const mainSpecs = get('mainspecs', 'specs', 'especificaciones', 'specifications')
        const targetCost = get('targetcost', 'coste', 'cost', 'targetcompra')
        const examples = get('examples', 'ejemplo', 'links', 'fotos')
        const marginTarget = get('margintarget', 'margin', 'margen')
        const pvpr = get('pvpr', 'pvp', 'pvprtarget', 'precioventa', 'precio')
        const modelInterno = get('modelinterno', 'modelo', 'model', 'nombre')

        // Skip completely empty rows, but allow rows with at least one field
        if (!brand && !productType && !refSegment && !mainSpecs && !modelInterno) {
          skipped++
          continue
        }

        await db.searched_products.add({
          id: uuid(),
          brand,
          product_type: productType || 'Sin tipo',
          ref_segment: refSegment,
          main_specs: mainSpecs,
          target_cost: targetCost ? parseFloat(targetCost.replace(/[^0-9.,]/g, '').replace(',', '.')) || null : null,
          examples,
          margin_target: marginTarget,
          pvpr: pvpr ? parseFloat(pvpr.replace(/[^0-9.,]/g, '').replace(',', '.')) || null : null,
          model_interno: modelInterno,
          created_at: now,
          updated_at: now,
          synced_at: null,
        })
        count++
      }
      setImportResult(`${count} productos importados${skipped ? ` (${skipped} filas vacías ignoradas)` : ''}. Columnas detectadas: ${cols.join(', ')}`)
    } catch (err) {
      setImportResult(`Error: ${err instanceof Error ? err.message : 'desconocido'}`)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleExport() {
    if (!products || products.length === 0) return
    const rows = products.map(p => ({
      'MARCA': p.brand,
      'TIPO DE PRODUCTO': p.product_type,
      'REF / SEGMENTO': p.ref_segment,
      'MAIN SPECS': p.main_specs,
      'MARGIN TARGET %': p.margin_target,
      'PVPR €': p.pvpr,
      'TARGET COST $': calcTargetCost(p.brand, p.pvpr, p.margin_target)?.toFixed(2) || '',
      'EXAMPLES': p.examples,
      'MODEL INTERNO': p.model_interno,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Productos Deseados')
    XLSX.writeFile(wb, `productos-buscados-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este producto buscado?')) return
    await db.searched_products.delete(id)
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 px-4 py-3">
        <button
          onClick={() => navigate('/')}
          className="mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          ← Volver a inicio
        </button>
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
            className="cursor-pointer rounded-lg border border-primary bg-white px-4 py-2.5 text-xs font-medium text-primary"
          >
            Importar Excel
          </button>
          <button
            onClick={handleExport}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-xs font-medium text-gray-600"
          >
            Exportar Excel
          </button>
          <button
            onClick={async () => {
              const pwd = window.prompt('Contraseña para borrar todos los productos buscados:')
              if (pwd !== 'APPROX') { if (pwd !== null) window.alert('Contraseña incorrecta'); return }
              if (!window.confirm('¿Borrar TODOS los productos buscados?')) return
              await db.searched_products.clear()
            }}
            className="cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2.5 text-xs font-medium text-red-500"
          >
            Borrar todos
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
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Marca</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Tipo Producto</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 w-36">Ref.</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Specs</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-700">Target Compra USD</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-500 w-20">Margen %</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-500 w-20">PVPR €</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Modelo</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-500 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const computed = calcTargetCost(p.brand, p.pvpr, p.margin_target)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setViewingProduct(p)}
                      className="cursor-pointer border-b border-gray-100 bg-white hover:bg-blue-50"
                    >
                      <td className="px-2 py-2.5 font-medium text-gray-800">{p.brand || '—'}</td>
                      <td className="px-2 py-2.5 text-gray-600">{p.product_type}</td>
                      <td className="px-2 py-2.5 text-gray-500 max-w-[140px] truncate">{p.ref_segment || '—'}</td>
                      <td className="group relative px-2 py-2.5 text-gray-500 max-w-[200px] truncate">
                        {p.main_specs || '—'}
                        {p.main_specs && (
                          <div className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg group-hover:visible whitespace-pre-wrap">
                            {p.main_specs}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold text-green-700">{computed ? `$${computed.toFixed(2)}` : '—'}</td>
                      <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={p.margin_target}
                          onBlur={async (e) => {
                            const val = e.target.value.trim()
                            if (val !== p.margin_target) {
                              await db.searched_products.update(p.id, { margin_target: val, updated_at: new Date().toISOString() })
                            }
                          }}
                          className="w-full rounded border border-gray-200 px-1 py-1 text-right text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={p.pvpr ?? ''}
                          onBlur={async (e) => {
                            const val = e.target.value.trim()
                            const num = val ? parseFloat(val) : null
                            if (num !== p.pvpr) {
                              await db.searched_products.update(p.id, { pvpr: num, updated_at: new Date().toISOString() })
                            }
                          }}
                          className="w-full rounded border border-gray-200 px-1 py-1 text-right text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-gray-500">{p.model_interno || '—'}</td>
                      <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewingProduct && (
        <ProductViewModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onEdit={() => { setEditingProduct(viewingProduct); setShowForm(true); setViewingProduct(null) }}
        />
      )}

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
      target_cost: null,
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
              <label className="mb-1 block text-xs font-medium text-gray-500">Margin Target (%)</label>
              <input type="number" step="0.01" value={marginTarget} onChange={e => setMarginTarget(e.target.value)} className={fieldCls} placeholder="30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">PVPR (€)</label>
              <input type="number" step="0.01" value={pvpr} onChange={e => setPvpr(e.target.value)} className={fieldCls} placeholder="29.90" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Target Cost ($) <span className="font-normal text-gray-400">calc.</span></label>
              <div className="flex h-[42px] items-center rounded-lg border border-gray-100 bg-gray-50 px-3 text-sm font-semibold text-green-700">
                {(() => {
                  const tc = calcTargetCost(brand, pvpr ? parseFloat(pvpr) : null, marginTarget)
                  return tc ? `$${tc.toFixed(2)}` : '—'
                })()}
              </div>
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

function ProductViewModal({
  product,
  onClose,
  onEdit,
}: {
  product: SearchedProduct
  onClose: () => void
  onEdit: () => void
}) {
  const computed = calcTargetCost(product.brand, product.pvpr, product.margin_target)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Ficha de producto buscado</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-3">
            <ViewField label="Marca" value={product.brand} />
            <ViewField label="Tipo Producto" value={product.product_type} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ViewField label="Ref. / Segmento" value={product.ref_segment} />
            <ViewField label="Modelo Interno" value={product.model_interno} />
          </div>

          {/* Specs - biggest field */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Main Specs</label>
            <div className="min-h-[80px] whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800">
              {product.main_specs || '—'}
            </div>
          </div>

          {/* Target Cost - highlighted, right after specs */}
          <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 text-center">
            <label className="block text-xs font-medium text-green-700">TARGET COMPRA USD</label>
            <p className="mt-1 text-2xl font-bold text-green-800">
              {computed ? `$${computed.toFixed(2)}` : '—'}
            </p>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <ViewField label="Margen Target" value={formatMarginDisplay(product.margin_target)} />
            <ViewField label="PVPR" value={product.pvpr ? `${product.pvpr.toFixed(2)} €` : '—'} />
          </div>

          {/* Examples */}
          {product.examples && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Examples / Referencias</label>
              <div className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {product.examples}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100">
              ← Volver
            </button>
            <button onClick={onEdit}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-light">
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ViewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
        {value || '—'}
      </div>
    </div>
  )
}
