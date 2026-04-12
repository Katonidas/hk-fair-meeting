import Dexie, { type Table } from 'dexie'
import type { Supplier, Meeting, Product, ProductPhoto } from '@/types'
import type { SearchedProduct } from '@/types/searchedProduct'

export class FairDB extends Dexie {
  suppliers!: Table<Supplier>
  meetings!: Table<Meeting>
  products!: Table<Product>
  product_photos!: Table<ProductPhoto>
  searched_products!: Table<SearchedProduct>

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
    this.version(5).stores({
      searched_products: 'id, brand, product_type, ref_segment, updated_at, synced_at',
    })
    this.version(6).stores({})
    this.version(7).stores({})
    this.version(8).stores({
      products: 'id, meeting_id, product_type, item_model, status, created_at',
    }).upgrade(tx => {
      return tx.table('products').toCollection().modify(product => {
        if (!product.status) {
          product.status = 'interesting'
        }
      })
    })
    this.version(9).stores({
      products: 'id, meeting_id, supplier_id, product_type, item_model, status, created_at',
    }).upgrade(tx => {
      return tx.table('searched_products').toCollection().modify(sp => {
        if (!sp.candidate_product_ids) sp.candidate_product_ids = []
      })
    })
    this.version(10).stores({}).upgrade(tx => {
      return tx.table('searched_products').toCollection().modify(sp => {
        if (!sp.candidate_supplier_ids) sp.candidate_supplier_ids = []
        if (!sp.photos) sp.photos = []
      })
    })
    // v11: añade relevance (default 2) y normaliza margin_target a entero
    // (el bug del importador guardaba 0.6 en lugar de 60).
    this.version(11).stores({}).upgrade(tx => {
      return tx.table('searched_products').toCollection().modify(sp => {
        if (sp.relevance == null) sp.relevance = 2
        if (typeof sp.margin_target === 'string' && sp.margin_target) {
          const trimmed = sp.margin_target.replace('%', '').replace(',', '.').trim()
          const val = parseFloat(trimmed)
          if (!isNaN(val) && val > 0 && val < 1) {
            sp.margin_target = Math.round(val * 100).toString()
          }
        }
      })
    })
  }
}

export const db = new FairDB()
