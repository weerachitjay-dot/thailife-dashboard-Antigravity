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

-- 2. FACEBOOK TOKENS TABLE (New Identity Source)
-- Stores User OAuth Tokens (One per User)
create table facebook_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null, -- references auth.users(id) but we might keep it loose if using custom auth, strictly it should link to Supabase Auth
  encrypted_access_token text not null,
  expires_at timestamp with time zone,
  is_valid boolean default true,
  last_refreshed_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. ACCOUNTS TABLE
-- Stores Facebook Ad Account Metadata linked to a Token
create table accounts (
  account_id text primary key,
  name text,
  token_id uuid references facebook_tokens(id), -- Link to the token used to fetch this account
  is_active boolean default true, -- FB status
  is_selected boolean default false, -- User selection for sync
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

-- 5. HOURLY ADS INSIGHTS TABLE (Granular Data)
-- Stores hourly performance data at the Ad Level
create table facebook_ads_insights (
  id uuid default uuid_generate_v4() primary key,
  
  -- Dimensions
  ad_account_id text not null,
  ad_account_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text not null,
  ad_name text,
  date_start date not null,
  hour int not null, -- 0-23 (Advertiser Timezone)
  
  -- Metrics
  reach bigint default 0,
  impressions bigint default 0,
  clicks bigint default 0,
  spend numeric(12, 2) default 0,
  
  -- Actions
  leads bigint default 0, -- Combined (Website + On-Facebook)
  
  -- Calculated (Server-side populated)
  cpl numeric(10, 2) default 0,
  cpm numeric(10, 2) default 0,
  frequency numeric(5, 2) default 0,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(ad_id, date_start, hour) -- Prevent duplicates
);

-- RLS
alter table facebook_ads_insights enable row level security;
create policy "Allow read access for authenticated users" on facebook_ads_insights for select using (auth.role() = 'authenticated');

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
