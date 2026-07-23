-- Clean slate: Drop the old Phase 1 tables
DROP TABLE IF EXISTS wholesaler_prices CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Suppliers (wholesalers AND retailers)
create table suppliers (
  id bigint generated always as identity primary key,
  name text not null, -- 'booker', 'parfetts', 'dhamecha', 'tesco', 'asda', 'morrisons', 'lidl'
  type text check (type in ('wholesaler','retailer')),
  connector_config jsonb, -- scraper-specific config, never credentials here
  active boolean default true
);

-- Raw product records exactly as scraped, unprocessed
create table raw_products (
  id bigint generated always as identity primary key,
  supplier_id bigint references suppliers(id),
  raw_title text,
  raw_barcode text,
  raw_pack_info text,
  scraped_at timestamptz default now()
);

-- Canonical/normalised product master
create table canonical_products (
  id bigint generated always as identity primary key,
  canonical_name text,
  brand text,
  category text,
  barcode text,
  case_size integer,       -- e.g. 24
  unit_type text,          -- 'can','bottle','kg','litre'
  unit_volume numeric,     -- e.g. 330 (ml)
  created_at timestamptz default now()
);

-- Links raw supplier records to canonical products (many-to-one)
create table product_mappings (
  id bigint generated always as identity primary key,
  raw_product_id bigint references raw_products(id),
  canonical_product_id bigint references canonical_products(id),
  confidence numeric,  -- 0-100, from AI matching
  match_reason text,   -- explanation from AI
  status text check (status in ('pending_review','accepted','rejected')) default 'pending_review',
  reviewed_by text,
  reviewed_at timestamptz
);

-- Price snapshots — NEVER overwritten, append-only history
create table price_snapshots (
  id bigint generated always as identity primary key,
  canonical_product_id bigint references canonical_products(id),
  supplier_id bigint references suppliers(id),
  case_price numeric,
  unit_cost numeric,       -- computed: case_price / case_size
  in_stock boolean,
  promotion_flag boolean default false,
  snapshot_at timestamptz default now()
);

-- Subscribers (Telegram users + subscription status)
create table subscribers (
  id bigint generated always as identity primary key,
  telegram_user_id text unique,
  telegram_username text,
  subscription_status text check (subscription_status in ('active','trial','expired','cancelled')) default 'trial',
  subscribed_at timestamptz default now(),
  expires_at timestamptz
);

-- Seed initial suppliers
INSERT INTO suppliers (name, type, active) VALUES 
('booker', 'wholesaler', true),
('parfetts', 'wholesaler', true),
('dhamecha', 'wholesaler', true),
('tesco', 'retailer', true),
('asda', 'retailer', true),
('morrisons', 'retailer', true),
('lidl', 'retailer', true);

-- Enable Row Level Security (RLS) on all tables
alter table suppliers enable row level security;
alter table raw_products enable row level security;
alter table canonical_products enable row level security;
alter table product_mappings enable row level security;
alter table price_snapshots enable row level security;
alter table subscribers enable row level security;

-- Admin Read/Write Policies (Authenticated Users only)
-- Suppliers
create policy "Allow authenticated admins to select suppliers" on suppliers for select to authenticated using (true);
create policy "Allow authenticated admins to insert suppliers" on suppliers for insert to authenticated with check (true);
create policy "Allow authenticated admins to update suppliers" on suppliers for update to authenticated using (true);

-- Raw Products
create policy "Allow authenticated admins to select raw_products" on raw_products for select to authenticated using (true);
create policy "Allow authenticated admins to update raw_products" on raw_products for update to authenticated using (true);

-- Canonical Products
create policy "Allow authenticated admins to select canonical_products" on canonical_products for select to authenticated using (true);
create policy "Allow authenticated admins to insert canonical_products" on canonical_products for insert to authenticated with check (true);
create policy "Allow authenticated admins to update canonical_products" on canonical_products for update to authenticated using (true);

-- Product Mappings
create policy "Allow authenticated admins to select product_mappings" on product_mappings for select to authenticated using (true);
create policy "Allow authenticated admins to update product_mappings" on product_mappings for update to authenticated using (true);

-- Price Snapshots
create policy "Allow authenticated admins to select price_snapshots" on price_snapshots for select to authenticated using (true);

-- Subscribers
create policy "Allow authenticated admins to select subscribers" on subscribers for select to authenticated using (true);
create policy "Allow authenticated admins to insert subscribers" on subscribers for insert to authenticated with check (true);
create policy "Allow authenticated admins to update subscribers" on subscribers for update to authenticated using (true);

-- The Scraper and n8n will use the Service Role Key, which bypasses RLS automatically,
-- so we do not need to create insert/update policies for them.
