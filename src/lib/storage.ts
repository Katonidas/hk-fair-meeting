import { supabase, isSupabaseConfigured } from './supabase'
import { v4 as uuid } from 'uuid'

export async function uploadPhoto(file: File, folder: 'products' | 'cards'): Promise<string | null> {
  if (!isSupabaseConfigured()) return null

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${folder}/${uuid()}.${ext}`

  const { error } = await supabase.storage
    .from('photos')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
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
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        quality,
      )
    }

    img.src = URL.createObjectURL(file)
  })
}
