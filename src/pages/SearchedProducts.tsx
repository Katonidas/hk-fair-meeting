import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { deleteSearchedProduct, deleteAllSearchedProducts } from '@/lib/sync'
import { normalize } from '@/lib/normalize'
import { getFormulaGame, getFormulaTicnova } from '@/lib/settings'
import { fmtPrice } from '@/lib/price'
import { areProductTypesRelated } from '@/lib/synonyms'
import { uploadPhoto, compressImage } from '@/lib/storage'
import type { SearchedProduct } from '@/types/searchedProduct'
import type { Product } from '@/types'

function formatMarginDisplay(margin: string): string {
  if (!margin) return '—'
  const val = parseFloat(margin.replace('%', '').replace(',', '.').trim())
  if (isNaN(val)) return margin
  // If stored as decimal (e.g. 0.6), show as 60%
  if (val > 0 && val < 1) return `${Math.round(val * 100)}%`
  // If already a percentage number (e.g. 60), show as 60%
  return `${Math.round(val)}%`
}

/**
 * Normaliza el valor de margen del Excel a un entero (string) representando
 * el porcentaje. Excel guarda celdas con formato porcentaje como decimal
 * (60% → 0.6). Esta función detecta y normaliza para que TODO el sistema
 * trabaje con el entero (60), evitando que el input numérico de la tabla
 * muestre "0,6" en lugar de "60".
 */
function normalizeMarginToWholePercent(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.replace('%', '').replace(',', '.').trim()
  const val = parseFloat(trimmed)
  if (isNaN(val)) return raw
  if (val > 0 && val < 1) return Math.round(val * 100).toString()
  return Math.round(val).toString()
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
  // Estado de orden de la tabla. Por defecto ordenamos por tipo A→Z.
  type SortCol = 'brand' | 'product_type' | 'ref_segment' | 'main_specs' | 'target_cost' | 'margin_target' | 'pvpr' | 'model_interno' | 'relevance'
  const [sortCol, setSortCol] = useState<SortCol>('product_type')
  const [sortAsc, setSortAsc] = useState(true)

  // Filtro multi-palabra: si el usuario escribe "approx audio", buscamos
  // productos donde TODAS las palabras (parciales) aparezcan en algún
  // campo. Por ejemplo: marca="APPROX" + tipo="Audio" → match. Cada palabra
  // se compara contra el "haystack" concatenado de los campos relevantes.
  const products = useLiveQuery(async () => {
    const all = await db.searched_products.toArray()

    // Filtrado
    const filtered = (() => {
      const q = search.trim()
      if (!q) return all
      const tokens = normalize(q).split(/\s+/).filter(Boolean)
      if (tokens.length === 0) return all
      return all.filter(p => {
        const haystack = normalize([
          p.brand,
          p.product_type,
          p.ref_segment,
          p.model_interno,
          p.main_specs,
        ].filter(Boolean).join(' '))
        // Todas las palabras tienen que aparecer (parcial = substring)
        return tokens.every(t => haystack.includes(t))
      })
    })()

    // Orden
    const dir = sortAsc ? 1 : -1
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'brand': cmp = (a.brand || '').localeCompare(b.brand || ''); break
        case 'product_type': cmp = (a.product_type || '').localeCompare(b.product_type || ''); break
        case 'ref_segment': cmp = (a.ref_segment || '').localeCompare(b.ref_segment || ''); break
        case 'main_specs': cmp = (a.main_specs || '').localeCompare(b.main_specs || ''); break
        case 'target_cost': cmp = (a.target_cost ?? 0) - (b.target_cost ?? 0); break
        case 'margin_target': {
          const av = parseFloat((a.margin_target || '0').replace('%', '').replace(',', '.'))
          const bv = parseFloat((b.margin_target || '0').replace('%', '').replace(',', '.'))
          cmp = (isNaN(av) ? 0 : av) - (isNaN(bv) ? 0 : bv)
          break
        }
        case 'pvpr': cmp = (a.pvpr ?? 0) - (b.pvpr ?? 0); break
        case 'model_interno': cmp = (a.model_interno || '').localeCompare(b.model_interno || ''); break
        case 'relevance': cmp = (a.relevance ?? 2) - (b.relevance ?? 2); break
      }
      return cmp * dir
    })

    return sorted
  }, [search, sortCol, sortAsc])

  function toggleSort(col: SortCol) {
    if (col === sortCol) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }
  const arrow = (col: SortCol) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''

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
        const marginTargetRaw = get('margintarget', 'margin', 'margen')
        const pvpr = get('pvpr', 'pvp', 'pvprtarget', 'precioventa', 'precio')
        const modelInterno = get('modelinterno', 'modelo', 'model', 'nombre')
        // Última columna del Excel = prioridad (también buscamos por nombre)
        const priorityRaw = get('prioridad', 'priority', 'relevance', 'relevancia')

        // FIX bug porcentaje: Excel guarda celdas formateadas como porcentaje
        // (ej. "60%") como número decimal (0.6). Si lo importamos sin
        // normalizar queda como "0.6" en el campo y al mostrar el input
        // numérico se ve "0.6" en lugar de "60". Normalizamos a entero
        // multiplicando por 100 cuando el valor está en formato decimal.
        const marginTarget = normalizeMarginToWholePercent(marginTargetRaw)

        // Skip completely empty rows, but allow rows with at least one field
        if (!brand && !productType && !refSegment && !mainSpecs && !modelInterno) {
          skipped++
          continue
        }

        // Resolver prioridad: si no la encontramos por nombre, usar la
        // ÚLTIMA columna del Excel como fallback (petición del usuario).
        let priorityNum: number = 2
        let priorityStr = priorityRaw
        if (!priorityStr) {
          const lastCol = cols[cols.length - 1]
          const v = row[lastCol]
          if (v !== undefined && v !== null && v !== '') priorityStr = String(v).trim()
        }
        if (priorityStr) {
          const parsed = parseInt(priorityStr.replace(/[^0-9]/g, ''), 10)
          if ([1, 2, 3].includes(parsed)) priorityNum = parsed
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
          relevance: (priorityNum as 1 | 2 | 3),
          candidate_product_ids: [],
          candidate_supplier_ids: [],
          photos: [],
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
    if (!window.confirm('¿Eliminar este producto buscado? Se guardará en la papelera.')) return
    await deleteSearchedProduct(id)
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 px-4 py-3">
        <button
          onClick={() => navigate(-1)}
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
              if (!window.confirm('¿Borrar TODOS los productos buscados? Se guardarán en la papelera.')) return
              await deleteAllSearchedProducts()
            }}
            className="cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2.5 text-xs font-medium text-red-500"
          >
            Borrar todos
          </button>
        </div>
        {importResult && (
          <p className={`mb-3 text-xs ${importResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{importResult}</p>
        )}

        {/* Search — multi-palabra: separar con espacios para que TODAS deban
            aparecer (parcialmente) en algún campo. Ej: "approx audio" filtra
            productos que contengan ambas palabras en marca/tipo/ref/specs/modelo. */}
        <input
          type="search"
          placeholder="Buscar (varias palabras: ej. 'approx audio')"
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
                  <th onClick={() => toggleSort('brand')} className="cursor-pointer select-none px-2 py-2 text-left font-semibold text-gray-500 hover:text-primary">Marca{arrow('brand')}</th>
                  <th onClick={() => toggleSort('product_type')} className="cursor-pointer select-none px-2 py-2 text-left font-semibold text-gray-500 hover:text-primary">Tipo Producto{arrow('product_type')}</th>
                  <th onClick={() => toggleSort('ref_segment')} className="cursor-pointer select-none px-2 py-2 text-left font-semibold text-gray-500 w-36 hover:text-primary">Ref.{arrow('ref_segment')}</th>
                  <th onClick={() => toggleSort('main_specs')} className="cursor-pointer select-none px-2 py-2 text-left font-semibold text-gray-500 hover:text-primary">Specs{arrow('main_specs')}</th>
                  <th onClick={() => toggleSort('target_cost')} className="cursor-pointer select-none px-2 py-2 text-right font-bold text-gray-700 hover:text-primary">Target Compra USD{arrow('target_cost')}</th>
                  <th onClick={() => toggleSort('margin_target')} className="cursor-pointer select-none px-2 py-2 text-right font-semibold text-gray-500 w-20 hover:text-primary">Margen %{arrow('margin_target')}</th>
                  <th onClick={() => toggleSort('pvpr')} className="cursor-pointer select-none px-2 py-2 text-right font-semibold text-gray-500 w-20 hover:text-primary">PVPR €{arrow('pvpr')}</th>
                  <th onClick={() => toggleSort('model_interno')} className="cursor-pointer select-none px-2 py-2 text-left font-semibold text-gray-500 hover:text-primary">Modelo{arrow('model_interno')}</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-500 w-20">Candidatos</th>
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
                      <td className="px-2 py-2.5 text-right font-bold text-green-700">{fmtPrice(computed)}</td>
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
                      <td className="px-2 py-2.5 text-center">
                        {(p.candidate_product_ids?.length || 0) > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            {p.candidate_product_ids.length}
                          </span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
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
        relevance: 2,
        candidate_product_ids: [],
        candidate_supplier_ids: [],
        photos: [],
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
                  return fmtPrice(tc)
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
  const [showCandidateSearch, setShowCandidateSearch] = useState(false)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)

  // Load candidate products (enriched with supplier info)
  const candidates = useLiveQuery(async () => {
    const ids = product.candidate_product_ids || []
    if (ids.length === 0) return []

    const prods = await Promise.all(ids.map(id => db.products.get(id)))
    const valid = prods.filter((p): p is Product => p != null)

    const allMeetings = await db.meetings.toArray()
    const allSuppliers = await db.suppliers.toArray()
    const meetingMap = new Map(allMeetings.map(m => [m.id, m]))
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]))

    return enrichProducts(valid, meetingMap, supplierMap)
  }, [product.candidate_product_ids])

  // Helper: enrich products with supplier info
  function enrichProducts(
    products: Product[],
    meetingMap: Map<string, { supplier_id: string }>,
    supplierMap: Map<string, { name: string; stand: string }>
  ) {
    return products.map(p => {
      let supplier = p.supplier_id ? supplierMap.get(p.supplier_id) : undefined
      if (!supplier) {
        const meeting = meetingMap.get(p.meeting_id)
        supplier = meeting ? supplierMap.get(meeting.supplier_id) : undefined
      }
      return { ...p, supplierName: supplier?.name || '—', supplierStand: supplier?.stand || '—' }
    })
  }

  // Auto-suggestions: same product type + price in range (-30% to +10% of target)
  const suggestions = useLiveQuery(async () => {
    if (!showCandidateSearch) return []
    const linkedIds = new Set(product.candidate_product_ids || [])
    const targetPrice = computed

    const allProducts = await db.products.toArray()
    const allMeetings = await db.meetings.toArray()
    const allSuppliers = await db.suppliers.toArray()
    const meetingMap = new Map(allMeetings.map(m => [m.id, m]))
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]))

    const matched = allProducts
      .filter(p => !linkedIds.has(p.id))
      .filter(p => {
        // Type match using synonym-aware matching
        const typeMatch = areProductTypesRelated(product.product_type, p.product_type)
        if (!typeMatch) return false

        // Price match: if we have a target, check range (-30% to +10%)
        if (targetPrice && p.price != null) {
          const minPrice = targetPrice * 0.7  // 30% cheaper
          const maxPrice = targetPrice * 1.1  // 10% more expensive
          return p.price >= minPrice && p.price <= maxPrice
        }

        // If no target price, just match by type
        return true
      })

    return enrichProducts(matched, meetingMap, supplierMap).slice(0, 8)
  }, [showCandidateSearch, product.candidate_product_ids, computed])

  // Manual search results
  const searchResults = useLiveQuery(async () => {
    if (!showCandidateSearch || !candidateSearch.trim()) return []
    const q = normalize(candidateSearch)
    const linkedIds = new Set(product.candidate_product_ids || [])

    const allProducts = await db.products.toArray()
    const allMeetings = await db.meetings.toArray()
    const allSuppliers = await db.suppliers.toArray()
    const meetingMap = new Map(allMeetings.map(m => [m.id, m]))
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]))

    return enrichProducts(
      allProducts.filter(p => !linkedIds.has(p.id)),
      meetingMap, supplierMap
    )
      .filter(p =>
        normalize(p.supplierName).includes(q) ||
        normalize(p.product_type).includes(q) ||
        normalize(p.item_model).includes(q) ||
        normalize(p.features).includes(q)
      )
      .slice(0, 10)
  }, [showCandidateSearch, candidateSearch, product.candidate_product_ids])

  async function addCandidate(productId: string) {
    const current = product.candidate_product_ids || []
    if (current.includes(productId)) return
    const updated = [...current, productId]
    await db.searched_products.update(product.id, {
      candidate_product_ids: updated,
      updated_at: new Date().toISOString(),
    })
    // Mark the captured product as "selected"
    await db.products.update(productId, { status: 'selected' })
    // Update local product object for reactivity
    product.candidate_product_ids = updated
    setCandidateSearch('')
  }

  async function removeCandidate(productId: string) {
    const current = product.candidate_product_ids || []
    const updated = current.filter(id => id !== productId)
    await db.searched_products.update(product.id, {
      candidate_product_ids: updated,
      updated_at: new Date().toISOString(),
    })
    product.candidate_product_ids = updated
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 mx-2" onClick={e => e.stopPropagation()}>
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

          {/* Specs */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Main Specs</label>
            <div className="min-h-[60px] whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800">
              {product.main_specs || '—'}
            </div>
          </div>

          {/* Target Cost */}
          <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 text-center">
            <label className="block text-xs font-medium text-green-700">TARGET COMPRA USD</label>
            <p className="mt-1 text-2xl font-bold text-green-800">
              {fmtPrice(computed)}
            </p>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <ViewField label="Margen Target" value={formatMarginDisplay(product.margin_target)} />
            <ViewField label="PVPR" value={fmtPrice(product.pvpr, 'EUR')} />
          </div>

          {/* Examples */}
          {product.examples && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Examples / Referencias</label>
              <div className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <RenderTextWithLinks text={product.examples} />
              </div>
            </div>
          )}

          {/* Photos */}
          <SearchedProductPhotos product={product} onEnlarge={setEnlargedPhoto} />

          {/* ══════ CANDIDATES SECTION ══════ */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-blue-800">
                Candidatos encontrados ({candidates?.length || 0})
              </h4>
              <button
                onClick={() => setShowCandidateSearch(!showCandidateSearch)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                {showCandidateSearch ? 'Cerrar búsqueda' : '+ Buscar candidato'}
              </button>
            </div>

            {/* Search bar + suggestions for adding candidates */}
            {showCandidateSearch && (
              <div className="mb-3">
                {/* Auto-suggestions */}
                {suggestions && suggestions.length > 0 && !candidateSearch.trim() && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-green-700">
                      Sugerencias automaticas — tipo similar{computed ? ` + precio ${fmtPrice(computed * 0.7)}–${fmtPrice(computed * 1.1)}` : ''}
                    </p>
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-green-200 bg-green-50/50">
                      {suggestions.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addCandidate(p.id)}
                          className="flex w-full items-center gap-3 border-b border-green-100 px-3 py-2 text-left text-xs hover:bg-green-100"
                        >
                          {p.photos?.[0] && (
                            <img src={p.photos[0]} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-800 truncate">
                              {p.product_type} — {p.item_model || '?'}
                            </p>
                            <p className="text-gray-500 truncate">
                              {p.supplierName} · {fmtPrice(p.price)} · {p.features || ''}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold text-green-800">
                            + Añadir
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {suggestions && suggestions.length === 0 && !candidateSearch.trim() && (
                  <p className="mb-3 text-center text-xs text-gray-400">
                    Sin coincidencias automaticas. Busca manualmente por tipo de producto o specs.
                  </p>
                )}

                {/* Manual search */}
                <input
                  type="text"
                  placeholder="Buscar por proveedor, tipo, modelo, features..."
                  value={candidateSearch}
                  onChange={e => setCandidateSearch(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
                {candidateSearch.trim() && searchResults && searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => addCandidate(p.id)}
                        className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-blue-50"
                      >
                        {p.photos?.[0] && (
                          <img src={p.photos[0]} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 truncate">
                            {p.product_type} — {p.item_model || '?'}
                          </p>
                          <p className="text-gray-500 truncate">
                            {p.supplierName} · {fmtPrice(p.price)} · {p.features || ''}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          + Añadir
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {candidateSearch.trim() && searchResults && searchResults.length === 0 && (
                  <p className="mt-2 text-center text-xs text-gray-400">Sin resultados para "{candidateSearch}"</p>
                )}
              </div>
            )}

            {/* Linked candidates list */}
            {candidates && candidates.length > 0 ? (
              <div className="flex flex-col gap-2">
                {candidates.map((c, idx) => {
                  const priceDiff = computed && c.price ? c.price - computed : null
                  const priceOk = priceDiff !== null && priceDiff <= 0
                  return (
                    <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-start gap-3">
                        {/* Photo thumbnail */}
                        {c.photos?.[0] ? (
                          <img
                            src={c.photos[0]}
                            alt=""
                            className="h-16 w-16 shrink-0 cursor-pointer rounded-lg object-cover border border-gray-200"
                            onClick={() => setEnlargedPhoto(c.photos[0])}
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300 text-xs">
                            Sin foto
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              #{idx + 1}
                            </span>
                            <p className="text-sm font-bold text-gray-800 truncate">
                              {c.product_type} — {c.item_model || '?'}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {c.supplierName} · Stand {c.supplierStand}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                            <span className={`font-bold ${priceOk ? 'text-green-700' : priceDiff !== null ? 'text-red-600' : 'text-gray-600'}`}>
                              Precio: {fmtPrice(c.price)}
                              {priceDiff !== null && (
                                <span className="ml-1 font-normal">
                                  ({priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(2)} vs target)
                                </span>
                              )}
                            </span>
                            <span className="text-gray-500">MOQ: {c.moq || '—'}</span>
                            <span className={`font-medium ${
                              c.status === 'selected' ? 'text-green-600' :
                              c.status === 'discarded' ? 'text-red-500' : 'text-orange-600'
                            }`}>
                              {c.status === 'selected' ? 'SELECCIONADO' :
                               c.status === 'discarded' ? 'DESCARTADO' : 'INTERESANTE'}
                            </span>
                          </div>
                          {c.features && (
                            <p className="mt-0.5 text-[11px] text-gray-400 truncate">{c.features}</p>
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeCandidate(c.id)}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="Desvincular candidato"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Additional photos */}
                      {c.photos && c.photos.length > 1 && (
                        <div className="mt-2 flex gap-1.5 overflow-x-auto">
                          {c.photos.slice(1).map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`Foto ${i + 2}`}
                              className="h-12 w-12 shrink-0 cursor-pointer rounded object-cover border border-gray-200"
                              onClick={() => setEnlargedPhoto(url)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-xs text-blue-400">
                Sin candidatos vinculados. Pulsa "Buscar candidato" para añadir productos encontrados en la feria.
              </p>
            )}
          </div>

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

      {/* Enlarged Photo */}
      {enlargedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={(e) => { e.stopPropagation(); setEnlargedPhoto(null) }}>
          <img src={enlargedPhoto} alt="Foto ampliada" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
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

function RenderTextWithLinks({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-800">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function SearchedProductPhotos({ product, onEnlarge }: { product: SearchedProduct; onEnlarge: (url: string) => void }) {
  const [photos, setPhotos] = useState<string[]>(product.photos || [])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const newUrls: string[] = []
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, 1200, 0.8)
        const url = await uploadPhoto(compressed, 'products')
        if (url) newUrls.push(url)
      }
      const updated = [...photos, ...newUrls]
      setPhotos(updated)
      await db.searched_products.update(product.id, { photos: updated, updated_at: new Date().toISOString() })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  async function handleRemovePhoto(idx: number) {
    const updated = photos.filter((_, i) => i !== idx)
    setPhotos(updated)
    await db.searched_products.update(product.id, { photos: updated, updated_at: new Date().toISOString() })
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-500">Fotos ({photos.length})</p>
      {photos.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative">
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="h-20 w-20 cursor-pointer rounded-lg border border-gray-200 object-cover hover:opacity-80"
                onClick={() => onEnlarge(url)}
              />
              <button
                onClick={() => handleRemovePhoto(i)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {uploading ? (
          <p className="text-xs text-gray-400">Subiendo foto...</p>
        ) : (
          <>
            {isMobile ? (
              <>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleAddPhoto} className="hidden" />
                <button onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500 hover:border-primary hover:text-primary">
                  Foto
                </button>
              </>
            ) : null}
            <input ref={fileRef} type="file" accept="image/*,.heic,.heif,.webp" multiple onChange={handleAddPhoto} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500 hover:border-primary hover:text-primary">
              Subir fotos
            </button>
          </>
        )}
      </div>
    </div>
  )
}
