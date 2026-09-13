-- ไฟล์นี้ทำหน้าที่อะไร: สร้าง schema ฐานข้อมูลสำหรับ users, transactions, plans, budgets, recurring, pending actions และ logs
-- ใครรับผิดชอบ: ② Database
-- เขียนในสัปดาห์: W1
-- TODO: เพิ่ม trigger, RLS policy, และ index สำหรับ query การวิเคราะห์รายจ่ายและแผนออม
-- ⚖️ กฎเหล็ก G3, G6

create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text,
  is_active boolean not null default true,
  ai_enabled boolean not null default true,
  daily_summary_enabled boolean not null default false,
  email_ingest_token text unique,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  emoji text,
  is_default boolean not null default false,
  is_essential boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  target_date date not null,
  monthly_save numeric(12,2) not null check (monthly_save > 0),
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  confidence text not null check (confidence in ('low','medium','high')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category_id uuid references categories(id),
  label text not null,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  day_of_month smallint check (day_of_month between 1 and 31),
  day_of_week smallint check (day_of_week between 0 and 6),
  next_run date not null,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category_id uuid references categories(id),
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  note text check (char_length(note) <= 500),
  occurred_at timestamptz not null,
  source text not null check (source in ('chat','image','email','recurring','liff')),
  parsed_by text check (parsed_by in ('regex','dictionary','learned','ai','manual')),
  ref_number text,
  plan_id uuid references plans(id),
  recurring_rule_id uuid references recurring_rules(id),
  recurring_run_date date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_rule_id, recurring_run_date),
  check (type = 'transfer' or plan_id is null)
);

create unique index uq_tx_ref on transactions (user_id, ref_number)
  where ref_number is not null and deleted_at is null;

create index idx_tx_user_date on transactions (user_id, occurred_at desc)
  where deleted_at is null;

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category_id uuid references categories(id),
  month text not null,
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  used_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create table pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  action_type text not null check (action_type in ('create','update','delete','recurring','batch')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

create table keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  pattern text not null,
  category_name text not null,
  type text not null check (type in ('income','expense')),
  source text not null check (source in ('global','personal')),
  confidence numeric(3,2) not null default 0.80,
  created_at timestamptz not null default now(),
  unique (user_id, pattern, source)
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_id text unique,
  source text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table push_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  message text,
  status text not null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  model text not null,
  prompt_hash text,
  used_tokens integer,
  status text not null,
  created_at timestamptz not null default now()
);

create table logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  level text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);
