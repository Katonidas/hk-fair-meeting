export interface SearchedProduct {
  id: string
  brand: string
  product_type: string
  ref_segment: string
  main_specs: string
  target_cost: number | null
  examples: string
  margin_target: string
  pvpr: number | null
  model_interno: string
  /** Importancia: 1=Imprescindible, 2=Importante, 3=Opcional */
  relevance: 1 | 2 | 3
  candidate_product_ids: string[]
  candidate_supplier_ids: string[]
  photos: string[]
  created_at: string
  updated_at: string
  synced_at: string | null
}
