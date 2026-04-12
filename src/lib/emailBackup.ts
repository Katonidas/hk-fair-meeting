import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Guarda una copia del email como archivo .txt en Supabase Storage.
 *
 * Nombre del archivo:
 *   YYYY-MM-DD_HH-MM_nombreproveedor_tipo.txt
 *
 * donde tipo = "borrador" | "enviado-textoplano" | "enviado-html"
 *
 * Se guarda en el bucket "photos" dentro de la carpeta "email-backups/".
 * Si no hay conexión o falla el upload, no bloquea el flujo — es un
 * best-effort backup silencioso.
 */

type EmailBackupType = 'borrador' | 'enviado-textoplano' | 'enviado-html'

function sanitizeFilename(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .replace(/[^a-zA-Z0-9_-]/g, '_') // solo alfanuméricos
    .replace(/_+/g, '_')             // sin dobles underscore
    .substring(0, 60)                // limitar longitud
    .toLowerCase()
}

function buildFilename(supplierName: string, type: EmailBackupType): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`
  const supplier = sanitizeFilename(supplierName)
  return `email-backups/${date}_${time}_${supplier}_${type}.txt`
}

function buildContent(
  to: string,
  cc: string,
  subject: string,
  body: string,
  type: EmailBackupType,
  user: string,
): string {
  const lines = [
    `=== EMAIL BACKUP ===`,
    `Tipo: ${type}`,
    `Fecha: ${new Date().toLocaleString('es-ES')}`,
    `Usuario: ${user}`,
    ``,
    `TO: ${to}`,
    `CC: ${cc}`,
    `SUBJECT: ${subject}`,
    ``,
    `=== BODY ===`,
    ``,
    body,
    ``,
    `=== FIN ===`,
  ]
  return lines.join('\n')
}

export async function saveEmailBackup(opts: {
  supplierName: string
  to: string
  cc: string
  subject: string
  body: string
  type: EmailBackupType
  user: string
}): Promise<void> {
  if (!isSupabaseConfigured() || !navigator.onLine) return

  try {
    const filename = buildFilename(opts.supplierName, opts.type)
    const content = buildContent(opts.to, opts.cc, opts.subject, opts.body, opts.type, opts.user)
    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' })

    const { error } = await supabase.storage
      .from('photos')
      .upload(filename, blob, {
        cacheControl: '3600',
        upsert: false, // si ya existe, añade sufijo automático
      })

    if (error) {
      // Si el archivo ya existe (mismo minuto + mismo proveedor + mismo tipo),
      // reintentar con un sufijo aleatorio
      if (error.message?.includes('already exists') || error.statusCode === '409') {
        const retryName = filename.replace('.txt', `_${Date.now() % 10000}.txt`)
        await supabase.storage.from('photos').upload(retryName, blob, {
          cacheControl: '3600',
          upsert: false,
        })
      } else {
        console.warn('[emailBackup] Upload failed:', error.message)
      }
    }
  } catch (err) {
    // No bloquear nunca — es un backup best-effort
    console.warn('[emailBackup] Error:', err)
  }
}
