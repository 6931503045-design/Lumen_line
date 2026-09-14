-- ไฟล์นี้ทำหน้าที่อะไร: ทำให้คอลัมน์ updated_at อัปเดตเองทุกครั้งที่มีการ UPDATE
-- ใครรับผิดชอบ: ② Database
-- อ้างอิง: 001_init.sql บรรทัด "updated_at timestamptz not null default now()"
--
-- ทำไมต้องมีไฟล์นี้: 001_init.sql ประกาศ updated_at พร้อม default now() ไว้ แต่ default
-- ทำงานแค่ตอน INSERT เท่านั้น ไม่มี trigger และไม่มีโค้ดไหนเซ็ตค่าตอน UPDATE
-- ผลคือ updated_at เท่ากับ created_at ตลอดไป ใช้ตอบคำถาม "แถวนี้ถูกแก้ล่าสุดเมื่อไหร่" ไม่ได้เลย
--
-- 001_init.sql ระบุว่าห้ามแก้หลัง merge แล้ว จึงแยกมาเป็นไฟล์ใหม่ตามกติกา

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated_at on transactions;

create trigger trg_transactions_updated_at
  before update on transactions
  for each row
  execute function set_updated_at();
