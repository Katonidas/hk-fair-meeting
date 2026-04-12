import { useEffect, useState, type ReactNode } from 'react'
import { APP_VERSION, getMinAppVersion, forceAppUpdate } from '@/lib/version'

/**
 * Componente que envuelve toda la app. Al montar, comprueba la versión
 * contra Supabase. Si el dispositivo está desactualizado, muestra una
 * pantalla de bloqueo COMPLETA que impide usar la app hasta que el
 * usuario pulse "ACTUALIZAR". Al pulsar, se desregistran los SW, se
 * limpian cachés y se fuerza un hard reload.
 *
 * Si no hay conexión o no hay tabla app_config, deja pasar (fail-open)
 * para no bloquear a nadie en modo offline.
 */
export function VersionGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [outdated, setOutdated] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [minVersion, setMinVersion] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const min = await getMinAppVersion()
      if (cancelled) return
      if (min !== null && APP_VERSION < min) {
        setMinVersion(min)
        setOutdated(true)
      }
      setChecking(false)
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Check cada 60s por si el admin sube la versión mínima mientras el
  // usuario está usando la app (sin necesidad de recargar).
  useEffect(() => {
    if (outdated) return // ya bloqueado
    const interval = setInterval(async () => {
      const min = await getMinAppVersion()
      if (min !== null && APP_VERSION < min) {
        setMinVersion(min)
        setOutdated(true)
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [outdated])

  async function handleUpdate() {
    setUpdating(true)
    try {
      await forceAppUpdate()
    } catch (err) {
      console.error('[VersionGate] forceAppUpdate failed:', err)
      // Fallback: reload simple
      window.location.reload()
    }
  }

  // Mientras comprueba (muy rápido, < 1s), no mostrar nada para no
  // flashear. Si no hay conexión, el check devuelve null en < 100ms.
  if (checking) return null

  if (outdated) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1e3a5f] p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mb-4 text-5xl">🔄</div>
          <h1 className="mb-2 text-xl font-bold text-gray-800">
            Actualización necesaria
          </h1>
          <p className="mb-2 text-sm text-gray-600">
            Estás usando una versión antigua de la app
            (v{APP_VERSION}, se requiere v{minVersion}).
          </p>
          <p className="mb-6 text-sm text-gray-600">
            Para evitar problemas con los datos compartidos del equipo,
            es necesario actualizar antes de continuar.
          </p>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="w-full rounded-xl bg-[#1e3a5f] py-4 text-lg font-bold text-white transition-colors hover:bg-[#2a4f7f] active:bg-[#15294a] disabled:opacity-60"
          >
            {updating ? 'Actualizando...' : 'ACTUALIZAR AHORA'}
          </button>
          <p className="mt-4 text-xs text-gray-400">
            Esto limpiará la caché antigua y recargará la app.
            No se pierden datos — todo está guardado en Supabase.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
