import { v4 as uuid } from 'uuid'
import { db } from './db'
import type { BackupRecord } from './db'

/**
 * Guarda una copia de seguridad de un registro ANTES de borrarlo.
 * Se almacena en la tabla local `backups` de Dexie.
 *
 * Esto es una RED DE SEGURIDAD — si un producto, reunión o proveedor se
 * pierde por cualquier motivo (bug de sync, borrado accidental, etc),
 * SIEMPRE hay una copia aquí que se puede restaurar desde Settings →
 * Papelera.
 *
 * Los backups son locales (no se sincronizan a Supabase) y no se borran
 * nunca automáticamente. Si crecen demasiado, el usuario puede limpiar
 * la papelera manualmente desde Settings.
 */
export async function backupBeforeDelete(
  tableName: string,
  record: Record<string, unknown>,
  deletedBy: string = 'sistema',
): Promise<void> {
  try {
    const backup: BackupRecord = {
      id: uuid(),
      table_name: tableName,
      record_id: (record.id as string) || uuid(),
      data: JSON.stringify(record),
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
    }
    await db.backups.add(backup)
  } catch (err) {
    // Nunca bloquear por un fallo de backup
    console.warn('[backup] Failed to save backup:', err)
  }
}

/**
 * Restaura un registro desde la papelera. Devuelve el registro parseado
 * o null si no se pudo.
 */
export async function restoreFromBackup(backupId: string): Promise<Record<string, unknown> | null> {
  try {
    const backup = await db.backups.get(backupId)
    if (!backup) return null

    const record = JSON.parse(backup.data)
    const table = backup.table_name

    // Restaurar en la tabla original
    if (table === 'products') await db.products.put(record)
    else if (table === 'meetings') await db.meetings.put(record)
    else if (table === 'suppliers') await db.suppliers.put(record)
    else if (table === 'searched_products') await db.searched_products.put(record)
    else return null

    // Eliminar de la papelera
    await db.backups.delete(backupId)

    return record
  } catch (err) {
    console.error('[backup] Failed to restore:', err)
    return null
  }
}

/**
 * Obtiene todos los backups, ordenados por fecha descendente.
 */
export async function getBackups(): Promise<BackupRecord[]> {
  return db.backups.orderBy('deleted_at').reverse().toArray()
}

/**
 * Borra permanentemente un backup de la papelera.
 */
export async function permanentlyDeleteBackup(backupId: string): Promise<void> {
  await db.backups.delete(backupId)
}

/**
 * Vacía toda la papelera.
 */
export async function clearAllBackups(): Promise<void> {
  await db.backups.clear()
}
