import { supabase, isSupabaseConfigured } from './supabase'
import { v4 as uuid } from 'uuid'

// Convert file to data URL (base64) — works on all platforms, persists in IndexedDB
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function uploadPhoto(file: File, folder: 'products' | 'cards'): Promise<string | null> {
  // Compress first
  let fileToUpload = file
  try {
    fileToUpload = await compressImage(file, 1200, 0.7)
  } catch {
    fileToUpload = file
  }

  // Try Supabase upload
  if (isSupabaseConfigured()) {
    const ext = fileToUpload.type === 'image/png' ? 'png' : 'jpg'
    const path = `${folder}/${uuid()}.${ext}`

    const { error } = await supabase.storage
      .from('photos')
      .upload(path, fileToUpload, { cacheControl: '3600', upsert: false })

    if (!error) {
      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      return data.publicUrl
    }
    console.error('Supabase upload error:', error.message)
  }

  // Fallback: data URL (base64) — works everywhere, persists in IndexedDB
  try {
    return await fileToDataUrl(fileToUpload)
  } catch {
    return await fileToDataUrl(file)
  }
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File> {
  return new Promise((resolve, reject) => {
    // Timeout: if compression takes >10s, reject
    const timeout = setTimeout(() => reject(new Error('Compression timeout')), 10000)

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(objectUrl)

      try {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            } else {
              resolve(file)
            }
          },
          'image/jpeg',
          quality,
        )
      } catch {
        resolve(file)
      }
    }

    img.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}
