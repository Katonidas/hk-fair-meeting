import { useEffect, useState, type ReactNode } from 'react'
import { APP_BUILD_TS, isOutdated, registerCurrentVersion, forceAppUpdate } from '@/lib/version'

/**
 * Envuelve toda la app. Al montar:
 *
 * 1. Registra nuestra versión en Supabase (si somos el build más nuevo,
 *    actualiza min_app_version para que los demás se enteren)
 * 2. Comprueba si NOSOTROS estamos desactualizados
 * 3. Si sí → pantalla de bloqueo completa con botón ACTUALIZAR
 * 4. Re-comprueba cada 60s por si se despliega una versión nueva mientras
 *    el usuario está usando la app
 *
 * Si no hay conexión o no existe la tabla app_config → fail-open (no
 * bloquear). El modo offline sigue funcionando como siempre.
 */
export function VersionGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [outdated, setOutdated] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      // Primero registramos NUESTRA versión (si somos nuevos, avisamos a los demás)
      await registerCurrentVersion()
      // Luego comprobamos si NOSOTROS estamos viejos
      const old = await isOutdated()
      if (cancelled) return
      setOutdated(old)
      setChecking(false)
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Re-check periódico (60s) para detectar deploys mientras el usuario
  // tiene la app abierta. Si se detecta versión nueva → bloquear.
  useEffect(() => {
    if (outdated) return
    const interval = setInterval(async () => {
      const old = await isOutdated()
      if (old) setOutdated(true)
    }, 60_000)
    return () => clearInterval(interval)
  }, [outdated])

  async function handleUpdate() {
    setUpdating(true)
    try {
      await forceAppUpdate()
    } catch {
      window.location.reload()
    }
  }

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
            Hay una versión nueva de la app.
          </p>
          <p className="mb-6 text-sm text-gray-600">
            Para evitar problemas con los datos del equipo,
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
            Esto limpiará la caché y recargará la app.
            Tus datos están guardados en Supabase, no se pierde nada.
          </p>
          <p className="mt-2 text-[10px] text-gray-300">
            Build: {APP_BUILD_TS}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
