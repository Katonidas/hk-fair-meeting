import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { normalize } from '@/lib/normalize'
import type { ProductStatus } from '@/types'

type SortCol = 'supplierName' | 'supplierStand' | 'product_type' | 'item_model' | 'price' | 'target_price' | 'features' | 'moq' | 'options' | 'sample_status' | 'status'

interface EnrichedProduct {
  id: string
  meeting_id: string
  product_type: string
  item_model: string
  price: number | null
  price_currency: string
  target_price: number | null
  features: string
  moq: number | null
  options: string
  sample_status: string
  sample_units: number | null
  observations: string
  photos: string[]
  status: ProductStatus
  created_at: string
  supplierName: string
  supplierStand: string
}

export default function CapturedProducts() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all')
  const [sortCol, setSortCol] = useState<SortCol>('supplierName')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<EnrichedProduct | null>(null)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)

  const products = useLiveQuery(async () => {
    const savedMeetings = await db.meetings.where('status').equals('saved').toArray()
    const meetingIds = new Set(savedMeetings.map(m => m.id))
    const meetingMap = new Map(savedMeetings.map(m => [m.id, m]))

    const allProducts = await db.products.toArray()
    const filtered = allProducts.filter(p => meetingIds.has(p.meeting_id))

    const allSuppliers = await db.suppliers.toArray()
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]))

    const enriched: EnrichedProduct[] = filtered.map(p => {
      const meeting = meetingMap.get(p.meeting_id)
      const supplier = meeting ? supplierMap.get(meeting.supplier_id) : undefined
      return {
        ...p,
        status: p.status || 'interesting',
        supplierName: supplier?.name || '—',
        supplierStand: supplier?.stand || '—',
      }
    })

    return enriched
  }, [])

  const filteredProducts = products?.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (!search) return true
    const q = normalize(search)
    return (
      normalize(p.supplierName).includes(q) ||
      normalize(p.product_type).includes(q) ||
      normalize(p.item_model).includes(q) ||
      normalize(p.features).includes(q)
    )
  })

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const sorted = filteredProducts ? [...filteredProducts].sort((a, b) => {
    let cmp = 0
    switch (sortCol) {
      case 'supplierName': cmp = a.supplierName.localeCompare(b.supplierName); break
      case 'supplierStand': cmp = a.supplierStand.localeCompare(b.supplierStand); break
      case 'product_type': cmp = (a.product_type || '').localeCompare(b.product_type || ''); break
      case 'item_model': cmp = (a.item_model || '').localeCompare(b.item_model || ''); break
      case 'price': cmp = (a.price || 0) - (b.price || 0); break
      case 'target_price': cmp = (a.target_price || 0) - (b.target_price || 0); break
      case 'features': cmp = (a.features || '').localeCompare(b.features || ''); break
      case 'moq': cmp = (a.moq || 0) - (b.moq || 0); break
      case 'options': cmp = (a.options || '').localeCompare(b.options || ''); break
      case 'sample_status': cmp = a.sample_status.localeCompare(b.sample_status); break
      case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break
    }
    return sortAsc ? cmp : -cmp
  }) : []

  async function handleExport() {
    if (!sorted || sorted.length === 0) return
    const rows = sorted.map(p => ({
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
      'Estado': p.status,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Productos Capturados')
    XLSX.writeFile(wb, `productos-capturados-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const arrow = (col: SortCol) => sortCol === col ? (sortAsc ? ' \u2191' : ' \u2193') : ''
  const thBase = 'px-2 py-2 font-semibold text-gray-500 cursor-pointer whitespace-nowrap hover:text-primary'

  return (
    <div className="flex flex-col">
      <div className="flex-1 px-4 py-3">
        <button
          onClick={() => navigate('/')}
          className="mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          ← Volver a inicio
        </button>
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

        {/* Status filter */}
        <div className="mb-3 flex gap-2">
          {([
            ['all', 'Todos', 'bg-white text-gray-600 border-gray-200'],
            ['discarded', 'Descartado', 'bg-red-50 text-red-700 border-red-200'],
            ['interesting', 'Interesante', 'bg-orange-50 text-orange-700 border-orange-200'],
            ['selected', 'Seleccionado', 'bg-green-50 text-green-700 border-green-200'],
          ] as const).map(([value, label, colors]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                statusFilter === value
                  ? value === 'all' ? 'bg-primary text-white border-primary' :
                    value === 'discarded' ? 'bg-red-500 text-white border-red-500' :
                    value === 'interesting' ? 'bg-orange-500 text-white border-orange-500' :
                    'bg-green-500 text-white border-green-500'
                  : colors
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!sorted || sorted.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-4xl">&#128230;</p>
            <p className="mt-2">No hay productos capturados</p>
            <p className="text-xs">Los productos aparecen aqui cuando guardas una reunion</p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className={`${thBase} text-left`} onClick={() => handleSort('supplierName')}>Proveedor{arrow('supplierName')}</th>
                  <th className={`${thBase} text-left`} onClick={() => handleSort('supplierStand')}>Stand{arrow('supplierStand')}</th>
                  <th className={`${thBase} text-left`} onClick={() => handleSort('product_type')}>Tipo{arrow('product_type')}</th>
                  <th className={`${thBase} text-left`} onClick={() => handleSort('item_model')}>Item/Model{arrow('item_model')}</th>
                  <th className={`${thBase} text-right`} onClick={() => handleSort('price')}>Precio{arrow('price')}</th>
                  <th className={`${thBase} text-right`} onClick={() => handleSort('target_price')}>Target{arrow('target_price')}</th>
                  <th className={`${thBase} text-left`} onClick={() => handleSort('features')}>Features{arrow('features')}</th>
                  <th className={`${thBase} text-right`} onClick={() => handleSort('moq')}>MOQ{arrow('moq')}</th>
                  <th className={`${thBase} text-left`} onClick={() => handleSort('options')}>Options{arrow('options')}</th>
                  <th className={`${thBase} text-center`} onClick={() => handleSort('sample_status')}>Estado Sample{arrow('sample_status')}</th>
                  <th className={`${thBase} text-center`} onClick={() => handleSort('status')}>Estado{arrow('status')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="cursor-pointer border-b border-gray-100 bg-white hover:bg-blue-50"
                  >
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
                    <td className="px-2 py-2.5 text-center">
                      <StatusBadge status={p.status} />
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

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onPhotoClick={setEnlargedPhoto}
        />
      )}

      {/* Enlarged Photo */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setEnlargedPhoto(null)}
        >
          <img src={enlargedPhoto} alt="Enlarged" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: ProductStatus | undefined }) {
  const s = status || 'interesting'
  const config = {
    discarded: { bg: 'bg-red-100', text: 'text-red-700', label: 'Descartado' },
    interesting: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Interesante' },
    selected: { bg: 'bg-green-100', text: 'text-green-700', label: 'Seleccionado' },
  }[s]

  return (
    <span className={`inline-flex items-center rounded-full ${config.bg} ${config.text} px-2 py-0.5 text-[10px] font-bold`}>
      {config.label}
    </span>
  )
}

function ProductDetailModal({
  product,
  onClose,
  onPhotoClick,
}: {
  product: EnrichedProduct
  onClose: () => void
  onPhotoClick: (url: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [productType, setProductType] = useState(product.product_type)
  const [itemModel, setItemModel] = useState(product.item_model)
  const [price, setPrice] = useState(product.price?.toString() || '')
  const [targetPrice, setTargetPrice] = useState(product.target_price?.toString() || '')
  const [moq, setMoq] = useState(product.moq?.toString() || '')
  const [features, setFeatures] = useState(product.features)
  const [options, setOptions] = useState(product.options)
  const [observations, setObservations] = useState(product.observations)
  const [currentStatus, setCurrentStatus] = useState<ProductStatus>(product.status)

  async function handleStatusChange(newStatus: ProductStatus) {
    setCurrentStatus(newStatus)
    await db.products.update(product.id, { status: newStatus })
  }

  async function handleSaveEdits() {
    await db.products.update(product.id, {
      product_type: productType.trim(),
      item_model: itemModel.trim(),
      price: price ? parseFloat(price) : null,
      target_price: targetPrice ? parseFloat(targetPrice) : null,
      moq: moq ? parseInt(moq) : null,
      features: features.trim(),
      options: options.trim(),
      observations: observations.trim(),
    })
    setEditing(false)
  }

  const fieldCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 mx-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Detalle del producto</h3>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                Editar
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">&#10005;</button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Status buttons — always interactive */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Estado</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('discarded')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                  currentStatus === 'discarded'
                    ? 'bg-red-500 text-white'
                    : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                DESCARTADO
              </button>
              <button
                onClick={() => handleStatusChange('interesting')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                  currentStatus === 'interesting'
                    ? 'bg-orange-500 text-white'
                    : 'border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
                }`}
              >
                INTERESANTE
              </button>
              <button
                onClick={() => handleStatusChange('selected')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                  currentStatus === 'selected'
                    ? 'bg-green-500 text-white'
                    : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                SELECCIONADO
              </button>
            </div>
          </div>

          {/* Supplier info */}
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500">Proveedor</p>
            <p className="text-base font-medium text-gray-800">{product.supplierName}</p>
            <p className="text-sm text-gray-400">Stand {product.supplierStand}</p>
          </div>

          {/* Product fields */}
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Tipo de producto</label>
                  <input type="text" value={productType} onChange={e => setProductType(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Item / Model</label>
                  <input type="text" value={itemModel} onChange={e => setItemModel(e.target.value)} className={fieldCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Precio</label>
                  <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Target Price</label>
                  <input type="number" step="0.01" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">MOQ</label>
                  <input type="number" value={moq} onChange={e => setMoq(e.target.value)} className={fieldCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Features / Specs</label>
                <textarea value={features} onChange={e => setFeatures(e.target.value)} rows={3} className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Options</label>
                <textarea value={options} onChange={e => setOptions(e.target.value)} rows={2} className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Observaciones</label>
                <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} className={fieldCls} />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdits}
                  className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-bold text-white hover:bg-green-600"
                >
                  Guardar cambios
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Tipo de producto" value={product.product_type} />
                <DetailField label="Item / Model" value={product.item_model} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <DetailField label="Precio" value={product.price ? `$${product.price} ${product.price_currency}` : '—'} />
                <DetailField label="Target Price" value={product.target_price ? `$${product.target_price}` : '—'} />
                <DetailField label="MOQ" value={product.moq?.toString() || '—'} />
              </div>
              <DetailField label="Features / Specs" value={product.features || '—'} />
              <DetailField label="Options" value={product.options || '—'} />
              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="Sample"
                  value={
                    product.sample_status === 'collected' ? `Recogido (${product.sample_units || 0} uds)` :
                    product.sample_status === 'pending' ? `Pdte envio (${product.sample_units || 0} uds)` : 'No'
                  }
                />
              </div>
              {product.observations && (
                <DetailField label="Observaciones" value={product.observations} />
              )}
            </>
          )}

          {/* Photos */}
          {product.photos && product.photos.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Fotos ({product.photos.length})</p>
              <div className="flex flex-wrap gap-3">
                {product.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="h-32 w-32 cursor-pointer rounded-lg border border-gray-200 object-cover hover:opacity-80"
                    onClick={() => onPhotoClick(url)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Back button */}
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            ← Volver al listado
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || '—'}</p>
    </div>
  )
}
