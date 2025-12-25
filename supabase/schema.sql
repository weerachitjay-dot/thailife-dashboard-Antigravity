-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PRODUCTS TABLE
-- Stores master data for products (Targets, Categories)
create table products (
  code text primary key, -- e.g., 'SENIOR-MORRADOK'
  name text not null,
  category text, -- e.g., 'Health', 'Saving'
  monthly_target numeric(10, 2) default 0,
  target_cpl numeric(10, 2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. ACCOUNTS TABLE
-- Stores Facebook Ad Account Token (One row per account)
create table accounts (
  account_id text primary key,
  name text,
  access_token text not null, -- Long-lived token
  is_active boolean default true,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. CAMPAIGNS TABLE
-- Stores Campaign Metadata parsed from Campaign Name
create table campaigns (
  id uuid default uuid_generate_v4() primary key,
  fb_campaign_id text unique not null,
  account_id text references accounts(account_id),
  name text not null,
  
  -- Parsed Fields
  product_code text references products(code), -- Nullable if unknown product
  objective text, -- e.g., 'LEADGENERATION'
  audience text, -- e.g., 'INTEREST_SHOPPING'
  platform text, -- e.g., 'FB', 'IG' (if parsable)
  
  status text, -- 'ACTIVE', 'PAUSED'
  start_date date,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. DAILY METRICS TABLE
-- Stores daily snapshots of performance
create table daily_metrics (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  date date not null,
  
  spend numeric(12, 2) default 0,
  impressions bigint default 0,
  clicks bigint default 0,
  leads bigint default 0,
  
  -- Calculated / Optional
  cpc numeric(10, 2),
  cpl numeric(10, 2),
  ctr numeric(5, 2),
  
  unique(campaign_id, date) -- Prevent duplicate stats for same day/campaign
);

-- RLS Policies (Basic Secure Setup)
alter table products enable row level security;
alter table accounts enable row level security;
alter table campaigns enable row level security;
alter table daily_metrics enable row level security;

-- Allow read access to authenticated users (e.g. Dashboard viewers)
create policy "Allow read access for authenticated users" on products for select using (auth.role() = 'authenticated');
create policy "Allow read access for authenticated users" on campaigns for select using (auth.role() = 'authenticated');
create policy "Allow read access for authenticated users" on daily_metrics for select using (auth.role() = 'authenticated');

-- Accounts might be sensitive, restrict write to service role or admin
-- For now allow read for authenticated to see status
create policy "Allow read access for authenticated users" on accounts for select using (auth.role() = 'authenticated');
