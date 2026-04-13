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
const MIN_VERSION_CACHE_KEY = 'hk-fair-min-app-version'

export async function getMinAppVersion(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    // Sin config → usar cache local si existe
    return localStorage.getItem(MIN_VERSION_CACHE_KEY)
  }

  if (!navigator.onLine) {
    // Offline → usar la última versión mínima conocida del cache local.
    // Sin esto, usuarios offline nunca se bloquean y pueden corromper datos
    // al volver online con una versión vieja.
    return localStorage.getItem(MIN_VERSION_CACHE_KEY)
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'min_app_version')
      .single()

    if (error || !data) {
      // Supabase falló → usar cache local como fallback
      return localStorage.getItem(MIN_VERSION_CACHE_KEY)
    }

    // Guardar en localStorage para consultas offline futuras
    if (data.value) {
      localStorage.setItem(MIN_VERSION_CACHE_KEY, data.value)
    }
    return data.value || null
  } catch {
    return localStorage.getItem(MIN_VERSION_CACHE_KEY)
  }
}

/**
 * Registra la versión actual en Supabase. DESACTIVADO — la auto-escritura
 * causaba un bucle: cada deploy tiene un timestamp distinto, el primer
 * dispositivo que cargaba el nuevo escribía su timestamp, y los demás
 * dispositivos (que podían tener un build unos milisegundos más viejo por
 * caching de CDN) quedaban bloqueados permanentemente.
 *
 * Ahora min_app_version se actualiza SOLO manualmente cuando el CEO
 * quiere forzar una actualización a todos. Vía Supabase dashboard o SQL:
 *   UPDATE app_config SET value = '<nuevo-timestamp>' WHERE key = 'min_app_version';
 *
 * Para obtener el timestamp del build actual, abrir la consola del
 * navegador en la versión nueva y ejecutar: console.log(__APP_BUILD_TS__)
 */
export async function registerCurrentVersion(): Promise<void> {
  // NO-OP: auto-registro desactivado por seguridad.
  // Ver comentario arriba para actualizar manualmente.
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
    await Promise.all(registrations.map(r => r.unregister()))
  }

  // 2. Limpiar TODAS las cachés del Cache API
  if ('caches' in window) {
    const names = await caches.keys()
    await Promise.all(names.map(n => caches.delete(n)))
  }

  // 3. Esperar a que el SW se desregistre completamente
  await new Promise(resolve => setTimeout(resolve, 500))

  // 4. Navegar con cache-buster para evitar que CDN/proxy/browser sirva
  // una versión cacheada del index.html. No usar location.reload() porque
  // puede servir desde cache HTTP.
  const url = new URL(window.location.href)
  url.searchParams.set('_v', Date.now().toString())
  window.location.href = url.toString()
}
