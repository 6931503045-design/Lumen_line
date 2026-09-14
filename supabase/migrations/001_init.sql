-- ไฟล์นี้ทำหน้าที่อะไร: สร้างตารางเริ่มต้นทั้งหมดของโปรเจกต์ JOD tang (12 ตาราง) + เปิด RLS
-- ใครรับผิดชอบ: ② Database
-- เขียนในสัปดาห์: W1
-- อ้างอิง: SPEC.md §S6 — Database (ห้ามแก้ไฟล์นี้หลัง merge แล้ว ถ้าจะเปลี่ยน schema ให้สร้าง 002_xxx.sql ไฟล์ใหม่)
--
-- กติกาเรื่องเงิน/เวลา (กฎเหล็ก G3):
--   - เงินเก็บเป็น numeric(12,2) เสมอ ห้ามใช้ real / double precision / float
--   - เวลาเก็บเป็น timestamptz เสมอ ห้ามใช้ timestamp เปล่า (ไม่มี timezone)
--   - จำนวนเงินในตาราง transactions/plans/budgets/recurring_rules เป็นบวกเสมอ ทิศทาง (รายรับ/รายจ่าย) ดูจากคอลัมน์ type
--
-- หมายเหตุสำคัญ: ไฟล์นี้ "ไม่" ใส่ข้อมูลตั้งต้น (seed) ของหมวดหมู่เริ่มต้นให้ผู้ใช้ใหม่
-- เพราะการ seed หมวดหมู่เริ่มต้นเป็นหน้าที่ของโค้ดแอป (S1 follow handler เมื่อมีผู้ใช้ใหม่ทัก LINE OA)
-- ไม่ใช่หน้าที่ของ migration ไฟล์นี้ — ดู SPEC.md §3 S1 แถว "follow" ประกอบ

-- ========================================================================
-- 1) users — บัญชีผู้ใช้ LINE แต่ละคน
-- ========================================================================
create table users (
  id                    uuid primary key default gen_random_uuid(),
  line_user_id          text unique not null,
  display_name          text,
  is_active             boolean not null default true,
  ai_enabled            boolean not null default true,
  daily_summary_enabled boolean not null default false,
  email_ingest_token    text unique,                    -- สุ่ม >= 16 bytes (hex) ห้ามสร้างจาก user_id
  created_at            timestamptz not null default now()
);

-- ========================================================================
-- 2) categories — หมวดหมู่รายรับ/รายจ่ายของแต่ละผู้ใช้
-- ========================================================================
create table categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('income','expense')),
  emoji        text,
  is_default   boolean not null default false,
  is_essential boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, name, type)
);

-- ========================================================================
-- 3) plans — แผนออมเงิน (ของที่อยากได้ / เป้าหมาย)
-- ========================================================================
create table plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  title         text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  target_date   date not null,
  monthly_save  numeric(12,2) not null check (monthly_save > 0),
  status        text not null default 'draft'
                  check (status in ('draft','active','completed','cancelled')),
  confidence    text not null check (confidence in ('low','medium','high')),
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);

-- ========================================================================
-- 4) recurring_rules — รายการประจำ (เงินเดือน, ค่าเช่า ฯลฯ)
-- ========================================================================
create table recurring_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  category_id  uuid references categories(id),
  label        text not null,
  type         text not null check (type in ('income','expense')),
  amount       numeric(12,2) not null check (amount > 0),
  frequency    text not null check (frequency in ('daily','weekly','monthly','yearly')),
  day_of_month smallint check (day_of_month between 1 and 31),
  day_of_week  smallint check (day_of_week between 0 and 6),
  next_run     date not null,
  end_date     date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ========================================================================
-- 5) transactions — ตารางบัญชีแยกประเภทหลัก (หัวใจของทั้งระบบ)
-- ========================================================================
create table transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  category_id        uuid references categories(id),
  type               text not null check (type in ('income','expense','transfer')),
  amount             numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  note               text check (char_length(note) <= 500),
  occurred_at        timestamptz not null,
  source             text not null check (source in ('chat','image','email','recurring','liff')),
  parsed_by          text check (parsed_by in ('regex','dictionary','learned','ai','manual')),
  ref_number         text,
  plan_id            uuid references plans(id),
  recurring_rule_id  uuid references recurring_rules(id),
  recurring_run_date date,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (recurring_rule_id, recurring_run_date),
  check (type = 'transfer' or plan_id is null)          -- plan_id ใช้ได้เฉพาะ transfer (กฎ G7)
);
-- กัน ref_number ซ้ำ (เช่น เลขที่สลิปเดียวกันถูกอ่านซ้ำ) เฉพาะรายการที่ยังไม่ถูกลบ
create unique index uq_tx_ref on transactions (user_id, ref_number)
  where ref_number is not null and deleted_at is null;
-- index หลักสำหรับ query สรุป/ประวัติ เรียงตามเวลาล่าสุดก่อน
create index idx_tx_user_date on transactions (user_id, occurred_at desc)
  where deleted_at is null;

-- ========================================================================
-- 6) budgets — งบประมาณรายเดือนต่อหมวดหมู่
-- ========================================================================
create table budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  month        date not null,
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  alerted_80   boolean not null default false,
  alerted_100  boolean not null default false,
  unique (user_id, category_id, month)
);

-- ========================================================================
-- 7) user_keyword_map — พจนานุกรมส่วนตัว (L3) ที่ระบบเรียนรู้จากผู้ใช้แต่ละคน
-- ========================================================================
create table user_keyword_map (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  keyword     text not null,
  category_id uuid not null references categories(id) on delete cascade,
  hit_count   integer not null default 1,
  updated_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

-- ========================================================================
-- 8) pending_actions — คำขอบันทึก/แก้ไขที่รอผู้ใช้กดยืนยัน (กฎเหล็ก G2)
-- ========================================================================
create table pending_actions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  action     text not null check (action in (
               'create_transaction','create_transaction_batch','update_transaction',
               'delete_transaction','create_recurring')),
  payload    jsonb not null,
  source     text not null check (source in ('chat','image')),
  status     text not null default 'waiting'
               check (status in ('waiting','confirmed','cancelled','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_pending_user on pending_actions (user_id, status);

-- ========================================================================
-- 9) user_emails — อีเมลแจ้งเตือนธนาคารที่ผู้ใช้ forward เข้ามา
-- ========================================================================
create table user_emails (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  message_id             text not null,
  body_redacted          text not null,
  parsed                 boolean not null default false,
  matched_transaction_id uuid references transactions(id),
  received_at            timestamptz not null,
  unique (user_id, message_id)
);

-- ========================================================================
-- 10) webhook_events — กันเหตุการณ์ webhook จาก LINE ซ้ำ (LINE retry ได้)
-- ========================================================================
create table webhook_events (
  id          text primary key,
  received_at timestamptz not null default now()
);

-- ========================================================================
-- 11) push_log — บันทึกการส่งข้อความ push กันส่งซ้ำ/เช็คโควตา
-- ========================================================================
create table push_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references users(id) on delete set null,
  kind      text not null,
  dedup_key text unique not null,
  sent_at   timestamptz not null default now()
);
create index idx_push_time on push_log (sent_at desc);

-- ========================================================================
-- 12) ai_usage_log — log การเรียกใช้ AI ทุกครั้ง (ใช้ดูโควตา/debug)
-- ========================================================================
create table ai_usage_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete set null,
  kind       text not null check (kind in ('text','vision')),
  tool_name  text,
  success    boolean not null,
  error_code text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index idx_ai_usage_user_time on ai_usage_log (user_id, created_at desc);

-- ========================================================================
-- เปิด RLS ทุกตารางโดย "ไม่สร้าง policy ใดๆ เลย"
-- ผลลัพธ์: anon key / authenticated key เข้าตารางเหล่านี้ไม่ได้เลยแม้แต่แถวเดียว
-- มีแค่ service_role key (ที่ backend ใช้) เท่านั้นที่ข้าม RLS ได้
-- ดังนั้นการกรอง user_id ให้ถูกคนเป็นความรับผิดชอบของโค้ด backend 100% (กฎเหล็ก G6)
-- ========================================================================
alter table users            enable row level security;
alter table categories       enable row level security;
alter table plans            enable row level security;
alter table recurring_rules  enable row level security;
alter table transactions     enable row level security;
alter table budgets          enable row level security;
alter table user_keyword_map enable row level security;
alter table pending_actions  enable row level security;
alter table user_emails      enable row level security;
alter table webhook_events   enable row level security;
alter table push_log         enable row level security;
alter table ai_usage_log     enable row level security;