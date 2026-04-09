import { db } from './db'
import { areProductTypesRelated } from './synonyms'
import type { Supplier } from '@/types'
import type { SearchedProduct } from '@/types/searchedProduct'

// Get searched products that match a supplier's product types
export async function getMatchingSearchedProducts(supplierId: string): Promise<SearchedProduct[]> {
  const supplier = await db.suppliers.get(supplierId)
  if (!supplier) return []

  const allSearched = await db.searched_products.toArray()

  return allSearched.filter(sp => {
    // Manual link
    if (sp.candidate_supplier_ids?.includes(supplierId)) return true
    // Synonym-aware type matching
    if (!supplier.product_type) return false
    return areProductTypesRelated(supplier.product_type, sp.product_type)
  })
}

// Get suppliers that match a searched product's type
export async function getMatchingSuppliers(searchedProduct: SearchedProduct): Promise<Supplier[]> {
  const allSuppliers = await db.suppliers.toArray()

  return allSuppliers.filter(s => {
    // Manual link
    if (searchedProduct.candidate_supplier_ids?.includes(s.id)) return true
    // Synonym-aware type matching
    if (!s.product_type || !searchedProduct.product_type) return false
    return areProductTypesRelated(s.product_type, searchedProduct.product_type)
  })
}

// Count how many searched products match a supplier (for table columns)
export async function countPotentialProducts(supplierId: string): Promise<number> {
  const matches = await getMatchingSearchedProducts(supplierId)
  return matches.length
}
