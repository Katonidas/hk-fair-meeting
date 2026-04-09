import { supabase, isSupabaseConfigured } from './supabase'
import { v4 as uuid } from 'uuid'

export async function uploadPhoto(file: File, folder: 'products' | 'cards'): Promise<string | null> {
  // Always try to compress first
  let fileToUpload = file
  try {
    fileToUpload = await compressImage(file, 1200, 0.8)
  } catch {
    // If compression fails (e.g. HEIC), use original
    fileToUpload = file
  }

  if (!isSupabaseConfigured()) {
    // Fallback: return a local blob URL (won't persist across sessions but shows the photo)
    console.warn('Supabase not configured, using local blob URL')
    return URL.createObjectURL(fileToUpload)
  }

  const ext = fileToUpload.type === 'image/jpeg' ? 'jpg' : fileToUpload.type === 'image/png' ? 'png' : 'jpg'
  const path = `${folder}/${uuid()}.${ext}`

  const { error } = await supabase.storage
    .from('photos')
    .upload(path, fileToUpload, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('Upload error:', error.message)
    // Fallback to blob URL on upload failure
    return URL.createObjectURL(fileToUpload)
  }

  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    img.src = URL.createObjectURL(file)
  })
}
