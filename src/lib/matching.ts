import { db } from './db'
import { normalize } from './normalize'
import type { Supplier } from '@/types'
import type { SearchedProduct } from '@/types/searchedProduct'

// Get searched products that match a supplier's product types
export async function getMatchingSearchedProducts(supplierId: string): Promise<SearchedProduct[]> {
  const supplier = await db.suppliers.get(supplierId)
  if (!supplier?.product_type) return []

  const supplierTypes = normalize(supplier.product_type)
    .split(/[,;/]+/)
    .map(t => t.trim())
    .filter(t => t.length > 2)

  if (supplierTypes.length === 0) return []

  const allSearched = await db.searched_products.toArray()

  return allSearched.filter(sp => {
    // Manual link
    if (sp.candidate_supplier_ids?.includes(supplierId)) return true
    // Auto-match by type
    const spType = normalize(sp.product_type)
    return supplierTypes.some(st => spType.includes(st) || st.includes(spType))
  })
}

// Get suppliers that match a searched product's type
export async function getMatchingSuppliers(searchedProduct: SearchedProduct): Promise<Supplier[]> {
  const spType = normalize(searchedProduct.product_type)
  const spWords = spType.split(/[\s,;/]+/).filter(w => w.length > 2)

  if (spWords.length === 0 && (!searchedProduct.candidate_supplier_ids || searchedProduct.candidate_supplier_ids.length === 0)) {
    return []
  }

  const allSuppliers = await db.suppliers.toArray()

  return allSuppliers.filter(s => {
    // Manual link
    if (searchedProduct.candidate_supplier_ids?.includes(s.id)) return true
    // Auto-match by type
    if (!s.product_type) return false
    const sType = normalize(s.product_type)
    return spWords.some(w => sType.includes(w) || w.includes(sType))
  })
}

// Count how many searched products match a supplier (for table columns)
export async function countPotentialProducts(supplierId: string): Promise<number> {
  const matches = await getMatchingSearchedProducts(supplierId)
  return matches.length
}
