-- Enable RLS
alter table auth.users enable row level security;

-- Organizations table
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table organizations enable row level security;

-- Users profiles (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  role text not null default 'org_member',
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;

-- Products table
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('closed_end', 'open_end', 'sales_based')),
  name text not null,
  created_at timestamptz default now()
);

-- Offers table
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  product_id uuid references products(id),
  status text not null default 'draft' check (status in ('draft', 'issued', 'signed')),
  jurisdiction text not null default 'CA',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table offers enable row level security;

-- Offer inputs (flexible key-value)
create table if not exists offer_inputs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz default now()
);
alter table offer_inputs enable row level security;

-- Cashflows for APR calculation
create table if not exists cashflows (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  t integer not null,
  f numeric not null,
  amount numeric not null,
  created_at timestamptz default now()
);
alter table cashflows enable row level security;

-- Calculations results
create table if not exists calculations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  apr numeric not null,
  apr_bps integer not null,
  finance_charge numeric not null,
  assumptions jsonb,
  is_estimate boolean default false,
  method text,
  created_at timestamptz default now()
);
alter table calculations enable row level security;

-- Disclosures
create table if not exists disclosures (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  pdf_url text,
  html_snapshot text,
  version integer default 1,
  footer_type text check (footer_type in ('plain', 'signature_block')),
  created_at timestamptz default now()
);
alter table disclosures enable row level security;

-- E-signatures
create table if not exists esignatures (
  id uuid primary key default gen_random_uuid(),
  disclosure_id uuid references disclosures(id) on delete cascade,
  signer_name text not null,
  signer_email text,
  signed_at timestamptz default now(),
  ip text,
  user_agent text,
  evidence jsonb not null
);
alter table esignatures enable row level security;

-- Audit logs
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  at timestamptz default now(),
  diff jsonb
);
alter table audit_log enable row level security;

-- Templates
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  product_type text not null,
  rows jsonb not null,
  fonts jsonb not null,
  active boolean default true,
  version integer default 1,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_profiles_org_id on profiles(org_id);
create index if not exists idx_offers_org_id on offers(org_id);
create index if not exists idx_offers_created_at on offers(created_at);
create index if not exists idx_offer_inputs_offer_id on offer_inputs(offer_id);
create index if not exists idx_cashflows_offer_id on cashflows(offer_id);
create index if not exists idx_calculations_offer_id on calculations(offer_id);
create index if not exists idx_disclosures_offer_id on disclosures(offer_id);
create index if not exists idx_esignatures_disclosure_id on esignatures(disclosure_id);
create index if not exists idx_audit_log_offer_id on audit_log(offer_id);

-- RLS Policies
-- Organizations: users can only see their own org
create policy "Users can view own organization" on organizations
  for select using (id in (select org_id from profiles where id = auth.uid()));

-- Profiles: users can view profiles in their org
create policy "Users can view org profiles" on profiles
  for select using (org_id in (select org_id from profiles where id = auth.uid()));

-- Offers: users can only access offers from their org
create policy "Users can view org offers" on offers
  for select using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "Users can insert org offers" on offers
  for insert with check (org_id in (select org_id from profiles where id = auth.uid()));

create policy "Users can update org offers" on offers
  for update using (org_id in (select org_id from profiles where id = auth.uid()));

-- Offer inputs: same org access
create policy "Users can access org offer inputs" on offer_inputs
  for all using (offer_id in (select id from offers where org_id in (select org_id from profiles where id = auth.uid())));

-- Cashflows: same org access
create policy "Users can access org cashflows" on cashflows
  for all using (offer_id in (select id from offers where org_id in (select org_id from profiles where id = auth.uid())));

-- Calculations: same org access
create policy "Users can access org calculations" on calculations
  for all using (offer_id in (select id from offers where org_id in (select org_id from profiles where id = auth.uid())));

-- Disclosures: same org access
create policy "Users can access org disclosures" on disclosures
  for all using (offer_id in (select id from offers where org_id in (select org_id from profiles where id = auth.uid())));

-- E-signatures: same org access
create policy "Users can access org esignatures" on esignatures
  for all using (disclosure_id in (select id from disclosures where offer_id in (select id from offers where org_id in (select org_id from profiles where id = auth.uid()))));

-- Audit logs: same org access
create policy "Users can access org audit logs" on audit_log
  for all using (offer_id in (select id from offers where org_id in (select org_id from profiles where id = auth.uid())));

-- Templates: public read access
create policy "Anyone can view templates" on templates
  for select using (true);
