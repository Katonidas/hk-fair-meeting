export type UserName = 'Carlos' | 'Jesús' | 'Jose Luis'

export type SampleStatus = 'collected' | 'pending' | 'no'

export type ProductStatus = 'discarded' | 'interesting' | 'selected'

export type MeetingLocation = 'feria' | 'hotel'

export type MeetingStatus = 'draft' | 'saved'

export type Relevance = 1 | 2 | 3

export interface Supplier {
  id: string
  name: string
  stand: string
  assigned_person: string
  contact_person: string
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
  location: MeetingLocation
  status: MeetingStatus
  visited_at: string
  urgent_notes: string
  other_notes: string
  business_card_photo_url: string
  stand_photo_url: string
  email_generated: boolean
  email_sent_at: string | null
  created_at: string
  updated_at: string
  synced_at: string | null
}

export interface Product {
  id: string
  meeting_id: string
  supplier_id?: string
  product_type: string
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
  status: ProductStatus
  created_at: string
}

export interface ProductPhoto {
  id: string
  product_id: string
  photo_url: string
  created_at: string
}
