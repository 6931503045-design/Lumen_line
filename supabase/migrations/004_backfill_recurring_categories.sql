-- ไฟล์นี้ทำหน้าที่อะไร: เติมหมวดให้รายการประจำ และรายการเงินที่รายการประจำสร้างไว้แล้ว แต่ไม่มีหมวด
-- ใครรับผิดชอบ: ② Database
-- อ้างอิง: src/services/recurring.service.ts createRecurringRule() / category.service matchExistingCategory()
--
-- ทำไมต้องมีไฟล์นี้: createRecurringRule เคยใส่ category_id = null ทุกครั้ง
-- ผู้ใช้ตั้ง "เงินเดือน" เป็นรายการประจำแล้วเงินไม่ไปอยู่หมวดเงินเดือน (ไปกองที่ "ไม่ระบุหมวด")
-- โค้ดแก้แล้วสำหรับรายการที่สร้างใหม่ ไฟล์นี้ซ่อมข้อมูลที่สร้างไปก่อนหน้านั้น
--
-- กฎเดียวกับในโค้ด:
--   1. หมวดประเภทเดียวกันที่ชื่อตรงกับชื่อรายการ
--   2. ไม่งั้น หมวดที่ชื่อมีคำของกันและกัน (เช่น "ค่าอาหารกลางวัน" ↔ "อาหาร")
--   3. ไม่งั้น รายจ่ายลง "อื่นๆ" ส่วนรายรับปล่อยว่าง (ไม่ติดป้ายผิด)
--
-- รันซ้ำได้: แตะเฉพาะแถวที่ category_id ยังเป็น null เท่านั้น

-- ── 1) รายการประจำ ──────────────────────────────────────────────────────────
update recurring_rules r
set category_id = (
  select c.id
  from categories c
  where c.user_id = r.user_id
    and c.type = r.type
    and (
      lower(trim(c.name)) = lower(trim(r.label))
      or position(lower(trim(c.name)) in lower(trim(r.label))) > 0
      or position(lower(trim(r.label)) in lower(trim(c.name))) > 0
      or (r.type = 'expense' and c.name = 'อื่นๆ')
    )
  order by
    (lower(trim(c.name)) = lower(trim(r.label))) desc,  -- ตรงทั้งคำมาก่อน
    (c.name = 'อื่นๆ') asc,                             -- "อื่นๆ" เป็นทางสุดท้าย
    c.created_at asc
  limit 1
)
where r.category_id is null;

-- ── 2) รายการเงินที่รายการประจำสร้างไว้แล้ว → ใช้หมวดของรายการประจำ ─────────
update transactions t
set category_id = r.category_id
from recurring_rules r
where t.recurring_rule_id = r.id
  and t.user_id = r.user_id
  and t.category_id is null
  and r.category_id is not null;

-- ── 3) รายรับที่จดจากแชทไว้ก่อนหน้า ชื่อรายการตรงกับหมวดรายรับทุกตัวอักษร ──────
-- เช่น จด "เงินเดือน 5000" ไว้ตอนที่ระบบยังไม่เติมหมวดให้ — ตรงทั้งคำเท่านั้น ไม่เดาแบบบางส่วน
-- เพราะรายการเงินจริงติดป้ายผิดแย่กว่าไม่มีป้าย
update transactions t
set category_id = c.id
from categories c
where t.category_id is null
  and t.type = 'income'
  and c.user_id = t.user_id
  and c.type = 'income'
  and lower(trim(c.name)) = lower(trim(t.note));
