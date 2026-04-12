-- =============================================================================
-- HK Fair Meeting — Supabase schema
-- =============================================================================
--
-- Ejecutar este SQL en el SQL Editor del proyecto Supabase ANTES de activar
-- el sync. La app espera estas tablas con estos nombres y columnas exactas.
--
-- Región recomendada: Singapore (la más cercana a HK).
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- suppliers
-- -----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id              text primary key,
  name            text not null,
  stand           text not null default '',
  assigned_person text not null default '',
  product_type    text not null default '',
  emails          jsonb not null default '[]'::jsonb,
  phone           text not null default '',
  relevance       smallint not null default 2 check (relevance in (1, 2, 3)),
  visit_day       text not null default '',
  visit_slot      text not null default '',
  visited         boolean not null default false,
  pending_topics  text not null default '',
  interesting_products text not null default '',
  has_catalogue   boolean not null default false,
  current_products text not null default '',
  supplier_notes  text not null default '',
  is_new          boolean not null default false,
  updated_at      timestamptz not null default now(),
  updated_by      text not null default '',
  created_at      timestamptz not null default now(),
  synced_at       timestamptz
);

create index if not exists suppliers_updated_at_idx on public.suppliers (updated_at);

-- -----------------------------------------------------------------------------
-- meetings
-- -----------------------------------------------------------------------------
create table if not exists public.meetings (
  id              text primary key,
  supplier_id     text not null references public.suppliers(id) on delete cascade,
  user_name       text not null,
  visited_at      timestamptz not null,
  urgent_notes    text not null default '',
  other_notes     text not null default '',
  business_card_photo_url text not null default '',
  email_generated boolean not null default false,
  email_sent_at   timestamptz,
  email_to_draft       text not null default '',
  email_subject_draft  text not null default '',
  email_body_draft     text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  synced_at       timestamptz
);

create index if not exists meetings_updated_at_idx on public.meetings (updated_at);
create index if not exists meetings_supplier_id_idx on public.meetings (supplier_id);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id              text primary key,
  meeting_id      text not null references public.meetings(id) on delete cascade,
  item_model      text not null default '',
  price           numeric,
  price_currency  text not null default 'USD',
  target_price    numeric,
  features        text not null default '',
  moq             integer,
  options         text not null default '',
  sample_status   text not null default 'no' check (sample_status in ('collected', 'pending', 'no')),
  sample_units    integer,
  observations    text not null default '',
  photos          jsonb not null default '[]'::jsonb,
  relevance       smallint not null default 2 check (relevance in (1, 2, 3)),
  created_at      timestamptz not null default now()
);

create index if not exists products_meeting_id_idx on public.products (meeting_id);
create index if not exists products_created_at_idx on public.products (created_at);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
--
-- Estrategia v1: el equipo APPROX comparte una sola anon key. RLS permisivo
-- para los 4 usuarios. Cuando se introduzca auth real (Magic Link / OAuth),
-- restringir por user_id.
--
-- =============================================================================

alter table public.suppliers enable row level security;
alter table public.meetings  enable row level security;
alter table public.products  enable row level security;

-- Política temporal: anon puede hacer todo. SUSTITUIR por auth.uid() cuando
-- se introduzca login real.
create policy "anon read suppliers"  on public.suppliers for select using (true);
create policy "anon write suppliers" on public.suppliers for all    using (true) with check (true);

create policy "anon read meetings"   on public.meetings  for select using (true);
create policy "anon write meetings"  on public.meetings  for all    using (true) with check (true);

create policy "anon read products"   on public.products  for select using (true);
create policy "anon write products"  on public.products  for all    using (true) with check (true);
