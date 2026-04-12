import Dexie, { type Table } from 'dexie'
import type { Supplier, Meeting, Product, ProductPhoto, SavedRoute } from '@/types'

export class FairDB extends Dexie {
  suppliers!: Table<Supplier>
  meetings!: Table<Meeting>
  products!: Table<Product>
  product_photos!: Table<ProductPhoto>
  saved_routes!: Table<SavedRoute>

  constructor() {
    super('hk-fair-meeting')
    this.version(1).stores({
      suppliers: 'id, name, stand, assigned_person, visited, is_new, updated_at, synced_at',
      meetings: 'id, supplier_id, user_name, visited_at, email_generated, synced_at',
      products: 'id, meeting_id, item_model, created_at',
      product_photos: 'id, product_id, created_at',
    })

    // v2: añade el campo `relevance` (importancia del producto deseado) a Product.
    // Existing rows se inicializan a 2 = "Importante" (default neutro).
    this.version(2)
      .stores({
        suppliers: 'id, name, stand, assigned_person, visited, is_new, updated_at, synced_at',
        meetings: 'id, supplier_id, user_name, visited_at, email_generated, synced_at',
        products: 'id, meeting_id, item_model, relevance, created_at',
        product_photos: 'id, product_id, created_at',
      })
      .upgrade(async tx => {
        await tx.table('products').toCollection().modify(p => {
          if (p.relevance == null) p.relevance = 2
        })
      })

    // v3: añade campos de borrador del email (to/subject/body) a Meeting.
    // Permite al usuario salir y volver a la pantalla de email sin perder
    // los cambios manuales que hizo en el cuerpo o destinatarios.
    this.version(3)
      .stores({
        suppliers: 'id, name, stand, assigned_person, visited, is_new, updated_at, synced_at',
        meetings: 'id, supplier_id, user_name, visited_at, email_generated, synced_at',
        products: 'id, meeting_id, item_model, relevance, created_at',
        product_photos: 'id, product_id, created_at',
      })
      .upgrade(async tx => {
        await tx.table('meetings').toCollection().modify(m => {
          if (m.email_to_draft == null) m.email_to_draft = ''
          if (m.email_subject_draft == null) m.email_subject_draft = ''
          if (m.email_body_draft == null) m.email_body_draft = ''
        })
      })

    // v4: tabla `saved_routes` para el generador de ruta. Cada ruta guarda
    // una combinación de filtros con un nombre, para poder consultarla
    // rápidamente. Local-only por ahora (no se sincroniza a Supabase).
    this.version(4).stores({
      suppliers: 'id, name, stand, assigned_person, visited, is_new, updated_at, synced_at',
      meetings: 'id, supplier_id, user_name, visited_at, email_generated, synced_at',
      products: 'id, meeting_id, item_model, relevance, created_at',
      product_photos: 'id, product_id, created_at',
      saved_routes: 'id, name, created_at, updated_at',
    })
  }
}

export const db = new FairDB()
