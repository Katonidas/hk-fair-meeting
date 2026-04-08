-- ============================================
-- HK Fair Meeting — Database Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard → your project → SQL Editor
-- ============================================

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  stand TEXT NOT NULL DEFAULT '',
  assigned_person TEXT DEFAULT '',
  product_type TEXT DEFAULT '',
  emails TEXT[] DEFAULT '{}',
  phone TEXT DEFAULT '',
  relevance INTEGER DEFAULT 2 CHECK (relevance BETWEEN 1 AND 3),
  visit_day TEXT DEFAULT '',
  visit_slot TEXT DEFAULT '',
  visited BOOLEAN DEFAULT FALSE,
  pending_topics TEXT DEFAULT '',
  interesting_products TEXT DEFAULT '',
  has_catalogue BOOLEAN DEFAULT FALSE,
  current_products TEXT DEFAULT '',
  supplier_notes TEXT DEFAULT '',
  is_new BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  urgent_notes TEXT DEFAULT '',
  other_notes TEXT DEFAULT '',
  business_card_photo_url TEXT DEFAULT '',
  email_generated BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  product_type TEXT DEFAULT '',
  item_model TEXT DEFAULT '',
  price NUMERIC,
  price_currency TEXT DEFAULT 'USD',
  target_price NUMERIC,
  features TEXT DEFAULT '',
  moq INTEGER,
  options TEXT DEFAULT '',
  sample_status TEXT DEFAULT 'no' CHECK (sample_status IN ('collected', 'pending', 'no')),
  sample_units INTEGER,
  observations TEXT DEFAULT '',
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product photos table
CREATE TABLE IF NOT EXISTS product_photos (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_photos ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (team app, all users can read/write)
CREATE POLICY "Allow all operations on suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on meetings" ON meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on product_photos" ON product_photos FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_supplier ON meetings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_meeting ON products(meeting_id);
CREATE INDEX IF NOT EXISTS idx_product_photos_product ON product_photos(product_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_updated ON suppliers(updated_at);
CREATE INDEX IF NOT EXISTS idx_meetings_updated ON meetings(updated_at);

-- ============================================
-- STORAGE: After running this SQL, also create
-- a storage bucket called "photos" with public
-- access in: Storage → New Bucket →
--   Name: photos
--   Public: ON
-- ============================================
