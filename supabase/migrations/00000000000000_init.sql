-- Create the tables
create table products (
  id bigint generated always as identity primary key,
  barcode text unique,
  product_name text,
  our_qty_sold integer,
  our_revenue numeric
);

create table wholesaler_prices (
  id bigint generated always as identity primary key,
  product_id bigint references products(id),
  wholesaler text check (wholesaler in ('booker','parfetts','dhamecha')),
  price numeric,
  in_stock boolean,
  scraped_at timestamptz default now(),
  status text default 'ok' -- 'ok' | 'stale' | 'not_found'
);

-- Enable Row Level Security (RLS)
alter table products enable row level security;
alter table wholesaler_prices enable row level security;

-- Policies to allow only authenticated users to SELECT
create policy "Allow authenticated users to read products" on products
  for select to authenticated
  using (true);

create policy "Allow authenticated users to read wholesaler_prices" on wholesaler_prices
  for select to authenticated
  using (true);

-- The scraper will use the Service Role Key, which bypasses RLS automatically,
-- so we do not need to create insert/update policies for the scraper.
