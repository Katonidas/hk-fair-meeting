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
  candidate_product_ids: string[]
  candidate_supplier_ids: string[]
  created_at: string
  updated_at: string
  synced_at: string | null
}
