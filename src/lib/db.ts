import Dexie, { type Table } from 'dexie'
import type { Supplier, Meeting, Product, ProductPhoto } from '@/types'

export class FairDB extends Dexie {
  suppliers!: Table<Supplier>
  meetings!: Table<Meeting>
  products!: Table<Product>
  product_photos!: Table<ProductPhoto>

  constructor() {
    super('hk-fair-meeting')
    this.version(1).stores({
      suppliers: 'id, name, stand, assigned_person, visited, is_new, updated_at, synced_at',
      meetings: 'id, supplier_id, user_name, visited_at, email_generated, synced_at',
      products: 'id, meeting_id, item_model, created_at',
      product_photos: 'id, product_id, created_at',
    })
    this.version(2).stores({
      products: 'id, meeting_id, product_type, item_model, created_at',
    })
    this.version(3).stores({
      meetings: 'id, supplier_id, user_name, location, visited_at, email_generated, synced_at',
    })
    this.version(4).stores({
      meetings: 'id, supplier_id, user_name, location, status, visited_at, email_generated, synced_at',
    })
  }
}

export const db = new FairDB()
