export type UserName = 'Carlos' | 'Jesús' | 'Tote' | 'Jose Luis'

export type SampleStatus = 'collected' | 'pending' | 'no'

export type Relevance = 1 | 2 | 3

export interface Supplier {
  id: string
  name: string
  stand: string
  assigned_person: string
  product_type: string
  emails: string[]
  phone: string
  relevance: Relevance
  visit_day: string
  visit_slot: string
  visited: boolean
  pending_topics: string
  interesting_products: string
  has_catalogue: boolean
  current_products: string
  supplier_notes: string
  is_new: boolean
  updated_at: string
  updated_by: string
  created_at: string
  synced_at: string | null
}

export interface Meeting {
  id: string
  supplier_id: string
  user_name: UserName
  visited_at: string
  urgent_notes: string
  other_notes: string
  business_card_photo_url: string
  email_generated: boolean
  email_sent_at: string | null
  /** Borrador del email — se rellena al guardar el draft o al editar el form
   * de email. Si están presentes, se usan en lugar de regenerar el cuerpo.
   * Permite al usuario salir y volver sin perder los edits. */
  email_to_draft: string
  email_subject_draft: string
  email_body_draft: string
  created_at: string
  updated_at: string
  synced_at: string | null
}

export interface Product {
  id: string
  meeting_id: string
  item_model: string
  price: number | null
  price_currency: string
  target_price: number | null
  features: string
  moq: number | null
  options: string
  sample_status: SampleStatus
  sample_units: number | null
  observations: string
  photos: string[]
  /** Importancia del producto deseado: 1=Imprescindible, 2=Importante, 3=Opcional */
  relevance: Relevance
  created_at: string
}

export interface ProductPhoto {
  id: string
  product_id: string
  photo_url: string
  created_at: string
}

/** Filtros aplicables al generador de ruta. Todos opcionales — un campo
 *  vacío/null significa "no filtrar por este criterio". */
export interface RouteFilters {
  /** Búsqueda libre por nombre, stand o tipo de producto. */
  search: string
  /** Persona asignada. '' = todos. */
  assignedPerson: string
  /** Día de visita. '' = todos. */
  visitDay: string
  /** Slot de visita. '' = todos. */
  visitSlot: string
  /** Relevancia mínima (1=imprescindible, 3=opcional). null = todas. */
  minRelevance: Relevance | null
  /** Filtro por estado visitado. null = todos. */
  visitedStatus: 'visited' | 'not_visited' | null
  /** Tipo de producto (substring case-insensitive). '' = todos. */
  productType: string
  /** Orden de la lista resultante. */
  sortBy: 'name' | 'stand' | 'relevance'
}

export interface SavedRoute {
  id: string
  name: string
  filters: RouteFilters
  created_at: string
  updated_at: string
}
