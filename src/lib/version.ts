import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Versión de la app. INCREMENTAR con cada deploy que requiera que TODOS
 * los dispositivos se actualicen. Si un dispositivo tiene APP_VERSION <
 * min_app_version (almacenado en Supabase), se le bloquea el acceso
 * y se le fuerza a actualizar.
 *
 * INSTRUCCIONES PARA EL DESARROLLADOR:
 * 1. Incrementa este número antes de deployar
 * 2. Tras el deploy, actualiza el valor en Supabase:
 *    UPDATE app_config SET value = '<nuevo-valor>' WHERE key = 'min_app_version';
 *    O desde el dashboard de Supabase, edita la fila directamente.
 */
export const APP_VERSION = 2

/**
 * Consulta Supabase para obtener la versión mínima requerida.
 * Si no hay tabla o no hay conexión, devuelve null (no bloquear).
 */
export async function getMinAppVersion(): Promise<number | null> {
  if (!isSupabaseConfigured() || !navigator.onLine) return null

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'min_app_version')
      .single()

    if (error || !data) return null
    const parsed = parseInt(data.value, 10)
    return isNaN(parsed) ? null : parsed
  } catch {
    return null
  }
}

/**
 * Fuerza la actualización: desregistra todos los service workers,
 * limpia todas las cachés del navegador, y hace hard reload.
 */
export async function forceAppUpdate(): Promise<void> {
  // 1. Desregistrar TODOS los service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const reg of registrations) {
      await reg.unregister()
    }
  }

  // 2. Limpiar TODAS las cachés del Cache API (las que usa el SW de PWA)
  if ('caches' in window) {
    const names = await caches.keys()
    for (const name of names) {
      await caches.delete(name)
    }
  }

  // 3. Hard reload — el navegador descarga todo de cero sin SW interceptando
  window.location.reload()
}
