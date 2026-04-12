// Helpers de fecha unificados.
//
// La app se usa en Hong Kong (UTC+8). Todo el formateo va en zona LOCAL del
// dispositivo, nunca UTC. Si en algún sitio se necesita una clave canónica
// (ej. agrupar por día), usar `localDateKey` que devuelve YYYY-MM-DD local.

const LOCALE = 'es-ES'

/** "2026-04-10" en zona horaria local. Útil para comparar/agrupar por día. */
export function localDateKey(iso: string | Date = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  // en-CA produce ISO YYYY-MM-DD nativamente, no necesitamos padStart manual.
  return d.toLocaleDateString('en-CA')
}

/** "14:30" en zona local. */
export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "10/04 14:30" en zona local — formato compacto para listas. */
export function formatLocalDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** True si la fecha cae en el día de hoy (en zona local del dispositivo). */
export function isToday(iso: string): boolean {
  return localDateKey(iso) === localDateKey()
}
