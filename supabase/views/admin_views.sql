-- ไฟล์นี้ทำหน้าที่อะไร: view สำหรับดูข้อมูลใน Supabase ให้อ่านง่าย แยกตามผู้ใช้
-- ใครรับผิดชอบ: ② Database
-- เขียนในสัปดาห์: W7
--
-- ปัญหาที่แก้: Supabase Table Editor แสดงแถวของผู้ใช้ทุกคนปนกัน และคอลัมน์
-- ที่เห็นเป็น UUID ล้วน ทำให้ดูไม่ออกว่าแถวไหนของใคร และดูเหมือนมีข้อมูลซ้ำ
-- ทั้งที่จริงเป็นข้อมูลของคนละคน
--
-- 🔒 ทุก view ในไฟล์นี้ "อ่านอย่างเดียว" ไม่มีคำสั่งลบหรือแก้ข้อมูลแม้แต่บรรทัดเดียว
-- ส่วนที่หาข้อมูลซ้ำอยู่ท้ายไฟล์ และเป็น SELECT ล้วน ๆ เช่นกัน
--
-- วิธีใช้: Supabase → SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้ ไม่เสียหาย)
-- แล้วไปที่ Table Editor จะเห็น view ใหม่โผล่ขึ้นมา กรองด้วยคอลัมน์ user_label ได้เลย

-- ════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 1 — view หลัก: ดูข้อมูลแยกตามผู้ใช้
-- ════════════════════════════════════════════════════════════════════════

-- ป้ายชื่อผู้ใช้ที่อ่านออก ใช้เป็นคอลัมน์แรกของทุก view ข้างล่าง
-- (LINE id ยาวมาก จึงตัดเหลือ 8 ตัวท้ายพอให้แยกคนได้)
create or replace view v_users as
select
  u.id                                            as user_id,
  coalesce(nullif(u.display_name, ''), 'ผู้ใช้ ' || right(u.line_user_id, 8)) as user_label,
  u.line_user_id,
  u.is_active                                     as ใช้งานอยู่,
  u.ai_enabled                                    as เปิด_ai,
  u.daily_summary_enabled                         as รับสรุปรายวัน,
  u.created_at                                    as สมัครเมื่อ,
  (select count(*) from transactions t where t.user_id = u.id and t.deleted_at is null) as จำนวนรายการ,
  (select count(*) from categories  c where c.user_id = u.id) as จำนวนหมวด,
  (select count(*) from plans       p where p.user_id = u.id and p.status = 'active') as แผนที่ออมอยู่
from users u
order by u.created_at desc;

comment on view v_users is 'ภาพรวมผู้ใช้ทุกคน พร้อมจำนวนข้อมูลของแต่ละคน — เริ่มดูที่ view นี้ก่อน';


-- รายการเงินทั้งหมด พร้อมชื่อคนและชื่อหมวด (แทนที่จะเป็น UUID)
create or replace view v_transactions as
select
  coalesce(nullif(u.display_name, ''), 'ผู้ใช้ ' || right(u.line_user_id, 8)) as user_label,
  t.occurred_at                                   as เกิดเมื่อ,
  case t.type when 'income' then 'รายรับ'
              when 'expense' then 'รายจ่าย'
              else 'โอนเข้าแผน' end               as ประเภท,
  t.amount                                        as ยอดบาท,
  coalesce(c.emoji || ' ', '') || coalesce(c.name, '(ไม่มีหมวด)') as หมวด,
  t.note                                          as ชื่อรายการ,
  t.source                                        as มาจาก,
  t.parsed_by                                     as อ่านโดย,
  t.ref_number                                    as เลขอ้างอิง,
  case when t.deleted_at is null then 'ปกติ' else 'ลบแล้ว' end as สถานะ,
  t.deleted_at                                    as ลบเมื่อ,
  t.id                                            as transaction_id,
  t.user_id
from transactions t
join users u on u.id = t.user_id
left join categories c on c.id = t.category_id
order by u.id, t.occurred_at desc;

comment on view v_transactions is 'รายการเงินทุกคน เรียงตามผู้ใช้ — กรองด้วย user_label เพื่อดูทีละคน';


-- หมวดหมู่ พร้อมจำนวนรายการที่ใช้หมวดนั้น
-- คอลัมน์ "ลบหมวดได้ไหม" ตอบคำถามที่เจอบ่อยว่าทำไมลบหมวดไม่ได้
create or replace view v_categories as
select
  coalesce(nullif(u.display_name, ''), 'ผู้ใช้ ' || right(u.line_user_id, 8)) as user_label,
  coalesce(c.emoji || ' ', '') || c.name          as หมวด,
  case c.type when 'income' then 'รายรับ' else 'รายจ่าย' end as ประเภท,
  c.is_default                                    as หมวดเริ่มต้น,
  c.is_essential                                  as จำเป็น,
  (select count(*) from transactions t
    where t.category_id = c.id and t.deleted_at is null)     as รายการที่ใช้อยู่,
  (select count(*) from transactions t
    where t.category_id = c.id and t.deleted_at is not null) as รายการที่ลบแล้ว,
  (select count(*) from recurring_rules r where r.category_id = c.id) as รายการประจำ,
  case
    when exists (select 1 from transactions t where t.category_id = c.id)
      then 'ลบไม่ได้ — ยังมีรายการผูกอยู่'
    when exists (select 1 from recurring_rules r where r.category_id = c.id)
      then 'ลบไม่ได้ — ยังมีรายการประจำผูกอยู่'
    else 'ลบได้'
  end                                             as ลบหมวดได้ไหม,
  c.id                                            as category_id,
  c.user_id
from categories c
join users u on u.id = c.user_id
order by u.id, c.type, c.name;

comment on view v_categories is 'หมวดหมู่ของทุกคน พร้อมบอกว่าหมวดไหนลบได้หรือไม่ได้เพราะอะไร';


-- แผนออม พร้อมความคืบหน้า
-- ⚠️ ตาราง plans ไม่มีคอลัมน์ "ออมไปแล้วเท่าไหร่" โดยตั้งใจ
-- ยอดที่ออมได้คำนวณจากผลรวมของ transactions ที่ type='transfer' และผูก plan_id
-- (⚖️ G7: รายการโอนเข้าแผนไม่ใช่รายรับหรือรายจ่าย) view นี้จึงต้องรวมเองเหมือนที่โค้ดทำ
create or replace view v_plans as
select
  coalesce(nullif(u.display_name, ''), 'ผู้ใช้ ' || right(u.line_user_id, 8)) as user_label,
  p.title                                         as ชื่อแผน,
  p.status                                        as สถานะ,
  p.target_amount                                 as เป้าหมายบาท,
  coalesce(s.saved, 0)                            as ออมแล้วบาท,
  case when p.target_amount > 0
       then round(coalesce(s.saved, 0) / p.target_amount * 100) || '%'
       else '-' end                               as คืบหน้า,
  p.monthly_save                                  as ออมเดือนละ,
  p.target_date                                   as กำหนดถึงเป้า,
  p.confidence                                    as ความมั่นใจ,
  p.created_at                                    as สร้างเมื่อ,
  p.id                                            as plan_id,
  p.user_id
from plans p
join users u on u.id = p.user_id
left join (
  select plan_id, sum(amount) as saved
  from transactions
  where type = 'transfer' and plan_id is not null and deleted_at is null
  group by plan_id
) s on s.plan_id = p.id
order by u.id, p.created_at desc;

comment on view v_plans is 'แผนออมของทุกคน พร้อมยอดที่ออมแล้ว (รวมจาก transfer) และเปอร์เซ็นต์ความคืบหน้า';


-- ════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 2 — หาข้อมูลซ้ำ (SELECT ล้วน ไม่ลบอะไรทั้งสิ้น)
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️ อ่านก่อนใช้: ฐานข้อมูลนี้มี unique constraint กันซ้ำไว้อยู่แล้วหลายจุด
--      users       → line_user_id เป็น unique      → บัญชีซ้ำเกิดไม่ได้
--      categories  → unique (user_id, name, type)  → หมวดชื่อซ้ำของคนเดียวกันเกิดไม่ได้
--      transactions→ unique (user_id, ref_number)  → สลิป/อีเมลใบเดิมซ้ำเกิดไม่ได้
--
-- ดังนั้นสิ่งที่ "ดูเหมือนซ้ำ" ใน Table Editor มักเป็นอย่างใดอย่างหนึ่งนี้
--   1. ข้อมูลของคนละผู้ใช้ปนกันอยู่ในตารางเดียว  → ใช้ view ส่วนที่ 1 แก้
--   2. หมวดชื่อเดียวกันแต่คนละประเภท (รายรับ/รายจ่าย) → ถูกต้องแล้ว ไม่ใช่ซ้ำ
--   3. รายการที่พิมพ์ทดสอบหลายรอบจริง ๆ           → ซ้ำจริง แต่เป็นข้อมูลทดสอบ
--
-- รัน 3 query ข้างล่างเพื่อดูว่าเป็นกรณีไหน

-- 2.1 บัญชีผู้ใช้ซ้ำ — ควรได้ 0 แถวเสมอ ถ้าได้แถวแปลว่า constraint หาย
select line_user_id, count(*) as จำนวนแถว, array_agg(id) as user_ids
from users
group by line_user_id
having count(*) > 1;

-- 2.2 หมวดซ้ำ — ชื่อเดียวกันของผู้ใช้คนเดียวกัน
--     ถ้าได้แถว ให้ดูคอลัมน์ ประเภท ด้วย: ชื่อซ้ำแต่คนละประเภทถือว่าถูกต้อง
select
  u.line_user_id,
  c.name                        as ชื่อหมวด,
  count(*)                      as จำนวนแถว,
  array_agg(distinct c.type)    as ประเภทที่มี,
  array_agg(c.id)               as category_ids
from categories c
join users u on u.id = c.user_id
group by u.line_user_id, c.name
having count(*) > 1
order by count(*) desc;

-- 2.3 รายการเงินที่น่าจะซ้ำ — ผู้ใช้เดียวกัน ยอดเท่ากัน ประเภทเดียวกัน
--     และเกิดห่างกันไม่เกิน 30 นาที (เกณฑ์เดียวกับ S10 Dedup ในโค้ด)
--     ⚠️ "น่าจะซ้ำ" ไม่ใช่ "ซ้ำแน่" — คนโอนยอดเดิมสองครั้งติดกันมีจริง
--        ต้องเปิดดูทีละคู่ก่อนตัดสินใจเสมอ
select
  u.line_user_id,
  a.type                          as ประเภท,
  a.amount                        as ยอด,
  a.note                          as ชื่อรายการ,
  a.occurred_at                   as เวลาแรก,
  b.occurred_at                   as เวลาที่สอง,
  round(extract(epoch from (b.occurred_at - a.occurred_at)) / 60) as ห่างกันกี่นาที,
  a.source || ' / ' || b.source   as มาจาก,
  a.id                            as id_ที่เก่ากว่า,
  b.id                            as id_ที่ใหม่กว่า
from transactions a
join transactions b
  on  a.user_id = b.user_id
  and a.type    = b.type
  and a.amount  = b.amount
  and a.id <> b.id
  and a.occurred_at <= b.occurred_at
  and b.occurred_at - a.occurred_at <= interval '30 minutes'
join users u on u.id = a.user_id
where a.deleted_at is null
  and b.deleted_at is null
order by u.line_user_id, a.occurred_at desc;

-- ════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 3 — ถ้าตัดสินใจจะลบจริง (ยังไม่ต้องรันตอนนี้)
-- ════════════════════════════════════════════════════════════════════════
--
-- 🔴 อ่านให้จบก่อนรัน
--
-- ระบบใช้ soft delete: การ "ลบ" ที่ถูกต้องคือตั้ง deleted_at ไม่ใช่ DELETE แถวทิ้ง
-- เพราะผู้ใช้กดเอากลับคืนได้ และรายงานย้อนหลังยังอ้างอิงแถวนั้นอยู่
--
-- ขั้นตอนที่ปลอดภัย
--   1. รัน query 2.3 ข้างบน แล้วเปิดดูทีละคู่ว่าซ้ำจริงไหม
--   2. จดเฉพาะ id_ที่ใหม่กว่า ของคู่ที่แน่ใจว่าซ้ำ
--   3. รันคำสั่งข้างล่างโดยใส่ id ที่จดไว้เท่านั้น ห้ามรันแบบเหมาทั้งผลลัพธ์
--
-- update transactions
--    set deleted_at = now()
--  where id in ('<ใส่ id ที่ตรวจแล้ว>', '<id ถัดไป>')
--    and deleted_at is null;
--
-- ถ้าเป็นข้อมูลทดสอบที่อยากล้างทิ้งทั้งหมดของผู้ใช้ทดสอบคนหนึ่ง
-- ให้ลบที่ตัวผู้ใช้แทน — FK เป็น on delete cascade จะลบข้อมูลของคนนั้นตามไปเอง
-- และปลอดภัยกว่าการไล่ลบทีละตาราง:
--
-- delete from users where line_user_id = '<LINE id ของบัญชีทดสอบ>';
--
-- ⚠️ ห้ามรันคำสั่งนี้กับบัญชีจริงเด็ดขาด ข้อมูลหายถาวรทั้งหมดทันที
