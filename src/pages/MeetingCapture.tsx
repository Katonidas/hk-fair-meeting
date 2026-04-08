import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import { uploadPhoto, compressImage } from '@/lib/storage'
import type { UserName, Product, SampleStatus } from '@/types'

interface Props {
  currentUser: UserName
}

export default function MeetingCapture({ currentUser: _currentUser }: Props) {
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

  const [urgentNotes, setUrgentNotes] = useState('')
  const [otherNotes, setOtherNotes] = useState('')
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (meeting) {
      setUrgentNotes(meeting.urgent_notes)
      setOtherNotes(meeting.other_notes)
    }
  }, [meeting])

  const autoSave = useCallback(async () => {
    if (!id) return
    const now = new Date().toISOString()
    await db.meetings.update(id, {
      urgent_notes: urgentNotes,
      other_notes: otherNotes,
      updated_at: now,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [id, urgentNotes, otherNotes])

  useEffect(() => {
    const timer = setTimeout(autoSave, 2000)
    return () => clearTimeout(timer)
  }, [urgentNotes, otherNotes, autoSave])

  if (!meeting || !supplier) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-light pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-800">{supplier.name}</h1>
              <p className="text-xs text-gray-400">
                Stand {supplier.stand} · {meeting.user_name} · {new Date(meeting.visited_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </p>
            </div>
          </div>
          {saved && (
            <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-600">
              Guardado ✓
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 px-4 pt-4">
        {/* Urgent Notes */}
        <div className="rounded-xl border border-urgent-border bg-urgent p-4">
          <label className="mb-2 block text-sm font-semibold text-amber-800">
            ⚡ Notas urgentes / puntos críticos
          </label>
          <textarea
            value={urgentNotes}
            onChange={e => setUrgentNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            placeholder="Precio especial si cerramos antes del viernes, muestra limitada..."
          />
        </div>

        {/* Other Notes */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Observaciones generales
          </label>
          <textarea
            value={otherNotes}
            onChange={e => setOtherNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            placeholder="Buena calidad general, fábrica propia, catálogo amplio..."
          />
        </div>

        {/* Business Card Photo */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Foto de tarjeta de visita
          </label>
          {meeting.business_card_photo_url ? (
            <div className="relative">
              <img
                src={meeting.business_card_photo_url}
                alt="Tarjeta de visita"
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: 200 }}
              />
              <button
                onClick={async () => {
                  await db.meetings.update(id!, { business_card_photo_url: '', updated_at: new Date().toISOString() })
                }}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <BusinessCardUpload meetingId={id!} />
          )}
        </div>

        {/* Products */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Productos ({products?.length || 0})
            </h2>
            <button
              onClick={() => { setEditingProduct(null); setShowProductForm(true) }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
            >
              + Añadir
            </button>
          </div>

          {products && products.length > 0 ? (
            <div className="flex flex-col gap-2">
              {products.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={() => { setEditingProduct(p); setShowProductForm(true) }}
                  onDelete={async () => {
                    await db.products.delete(p.id)
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">
              Sin productos aún
            </p>
          )}
        </div>
      </div>

      {/* Product Form Modal */}
      {showProductForm && (
        <ProductFormModal
          meetingId={id!}
          product={editingProduct}
          onClose={() => setShowProductForm(false)}
        />
      )}

      {/* Footer - Generate Email */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
        <button
          onClick={async () => {
            await autoSave()
            navigate(`/meeting/${id}/email`)
          }}
          className="w-full rounded-xl bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
        >
          GENERAR EMAIL RESUMEN
        </button>
      </div>
    </div>
  )
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const sampleLabel = {
    collected: '✅ Recogido',
    pending: '⏳ Pdte envío',
    no: '—',
  }[product.sample_status]

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-800">{product.product_type ? `${product.product_type} — ` : ''}{product.item_model || 'Sin modelo'}</p>
          <p className="text-xs text-gray-400">
            {product.price ? `$${product.price}` : 'Sin precio'} · MOQ: {product.moq || '—'} · {sampleLabel}
          </p>
        </div>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-3 space-y-1 border-t border-gray-200 pt-3 text-xs text-gray-500">
          {product.target_price && <p><span className="font-medium">Target:</span> ${product.target_price}</p>}
          {product.features && <p><span className="font-medium">Features:</span> {product.features}</p>}
          {product.options && <p><span className="font-medium">Options:</span> {product.options}</p>}
          {product.observations && <p><span className="font-medium">Notas:</span> {product.observations}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onEdit} className="rounded bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              Editar
            </button>
            <button onClick={onDelete} className="rounded bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500">
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductFormModal({
  meetingId,
  product,
  onClose,
}: {
  meetingId: string
  product: Product | null
  onClose: () => void
}) {
  const [productType, setProductType] = useState(product?.product_type || '')
  const [itemModel, setItemModel] = useState(product?.item_model || '')
  const [price, setPrice] = useState(product?.price?.toString() || '')
  const [targetPrice, setTargetPrice] = useState(product?.target_price?.toString() || '')
  const [features, setFeatures] = useState(product?.features || '')
  const [moq, setMoq] = useState(product?.moq?.toString() || '')
  const [options, setOptions] = useState(product?.options || '')
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>(product?.sample_status || 'no')
  const [sampleUnits, setSampleUnits] = useState(product?.sample_units?.toString() || '1')
  const [observations, setObservations] = useState(product?.observations || '')
  const [photos, setPhotos] = useState<string[]>(product?.photos || [])

  async function handleSave() {
    const data = {
      product_type: productType.trim(),
      item_model: itemModel.trim(),
      price: price ? parseFloat(price) : null,
      price_currency: 'USD',
      target_price: targetPrice ? parseFloat(targetPrice) : null,
      features: features.trim(),
      moq: moq ? parseInt(moq) : null,
      options: options.trim(),
      sample_status: sampleStatus,
      sample_units: sampleUnits ? parseInt(sampleUnits) : null,
      observations: observations.trim(),
      photos,
    }

    if (product) {
      await db.products.update(product.id, data)
    } else {
      await db.products.add({
        id: uuid(),
        meeting_id: meetingId,
        ...data,
        created_at: new Date().toISOString(),
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">
            {product ? 'Editar producto' : 'Nuevo producto'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de producto" value={productType} onChange={setProductType} placeholder="LED panel, cable..." />
            <Field label="Item / Model Number" value={itemModel} onChange={setItemModel} placeholder="ABC-123" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Precio (USD)" value={price} onChange={setPrice} type="number" placeholder="0.00" />
            <Field label="Target Price" value={targetPrice} onChange={setTargetPrice} type="number" placeholder="0.00" />
            <Field label="MOQ" value={moq} onChange={setMoq} type="number" placeholder="500" />
          </div>
          <Field label="Features / Specs" value={features} onChange={setFeatures} multiline placeholder="Material, dimensiones, certificaciones..." />
          <Field label="Options (extras)" value={options} onChange={setOptions} multiline placeholder="Colores disponibles, logo, packaging custom..." />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Sample</label>
            <div className="flex gap-2">
              <div className="w-16 shrink-0">
                <input
                  type="number"
                  value={sampleUnits}
                  onChange={e => setSampleUnits(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-2.5 text-center text-sm focus:border-primary focus:outline-none"
                  min="1"
                />
              </div>
              {([
                ['collected', 'Recogido'],
                ['pending', 'Pdte envío'],
                ['no', 'No'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSampleStatus(val)}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-medium transition-colors ${
                    sampleStatus === val
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Photos */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Fotos del producto</label>
            <ProductPhotoUpload photos={photos} onPhotosChange={setPhotos} />
          </div>

          <Field label="Observaciones" value={observations} onChange={setObservations} multiline placeholder="Notas adicionales sobre el producto..." />

          <button
            onClick={handleSave}
            className="mt-2 w-full rounded-lg bg-primary py-4 text-base font-bold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
          >
            {product ? 'Guardar cambios' : 'Añadir producto'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  multiline?: boolean
}) {
  const cls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none'
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={cls} placeholder={placeholder} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} placeholder={placeholder} />
      )}
    </div>
  )
}

function BusinessCardUpload({ meetingId }: { meetingId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file, 1200, 0.8)
      const url = await uploadPhoto(compressed, 'cards')
      if (url) {
        await db.meetings.update(meetingId, {
          business_card_photo_url: url,
          updated_at: new Date().toISOString(),
        })
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        {uploading ? 'Subiendo...' : 'Hacer foto de tarjeta'}
      </button>
    </>
  )
}

function ProductPhotoUpload({
  photos,
  onPhotosChange,
}: {
  photos: string[]
  onPhotosChange: (photos: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
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
      onPhotosChange([...photos, ...newUrls])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      {photos.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => onPhotosChange(photos.filter((_, idx) => idx !== i))}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-3 text-xs text-gray-400 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        {uploading ? 'Subiendo...' : 'Añadir fotos'}
      </button>
    </div>
  )
}
