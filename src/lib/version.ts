import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Versión de la app = timestamp del build, inyectado por Vite en build time.
 * Cada deploy genera un valor nuevo automáticamente. No hay nada manual.
 *
 * FLUJO:
 * 1. Alguien despliega (vercel --prod) → se genera un nuevo __APP_BUILD_TS__
 * 2. El PRIMER dispositivo que abre el deploy nuevo llama a
 *    registerCurrentVersion() → escribe el nuevo timestamp en Supabase
 * 3. Todos los DEMÁS dispositivos que aún tienen el build viejo consultan
 *    Supabase → ven que min_app_version es más nuevo que su propio
 *    __APP_BUILD_TS__ → se bloquean con la pantalla de actualización
 * 4. Al pulsar "ACTUALIZAR" → desregistra SW, limpia cachés, hard reload
 *    → descargan el build nuevo → su timestamp coincide → pasan
 *
 * ZERO intervención manual. Solo hay que deployar.
 */

declare const __APP_BUILD_TS__: string
export const APP_BUILD_TS = __APP_BUILD_TS__

/**
 * Obtiene la versión mínima requerida de Supabase.
 * Devuelve null si no hay conexión, no hay tabla, o no hay fila.
 */
export async function getMinAppVersion(): Promise<string | null> {
  if (!isSupabaseConfigured() || !navigator.onLine) return null

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'min_app_version')
      .single()

    if (error || !data) return null
    return data.value || null
  } catch {
    return null
  }
}

/**
 * Registra la versión actual como la mínima requerida en Supabase.
 * Solo escribe si nuestra versión es MÁS NUEVA que la que ya hay.
 * Así, el primer dispositivo que carga un deploy nuevo "avisa" a
 * todos los demás de que tienen que actualizar.
 */
export async function registerCurrentVersion(): Promise<void> {
  if (!isSupabaseConfigured() || !navigator.onLine) return

  try {
    const current = await getMinAppVersion()

    // Si no hay valor en Supabase, o nuestro build es más nuevo → escribir
    if (!current || APP_BUILD_TS > current) {
      await supabase
        .from('app_config')
        .upsert(
          { key: 'min_app_version', value: APP_BUILD_TS },
          { onConflict: 'key' },
        )
    }
  } catch (err) {
    // No bloquear si falla — es un best-effort
    console.warn('[version] Could not register version:', err)
  }
}

/**
 * Comprueba si este dispositivo está desactualizado.
 * Devuelve true si hay una versión más nueva en Supabase.
 * Devuelve false si no hay conexión, no hay tabla, o estamos al día.
 */
export async function isOutdated(): Promise<boolean> {
  const min = await getMinAppVersion()
  if (!min) return false
  return APP_BUILD_TS < min
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

  // 2. Limpiar TODAS las cachés del Cache API
  if ('caches' in window) {
    const names = await caches.keys()
    for (const name of names) {
      await caches.delete(name)
    }
  }

  // 3. Hard reload
  window.location.reload()
}
