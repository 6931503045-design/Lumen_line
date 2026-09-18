// ไฟล์นี้ทำหน้าที่อะไร: ตั้ง env ปลอมให้ทุกไฟล์เทสต์ก่อนโหลดโค้ดจริง
// ใครรับผิดชอบ: ⑤ Integration
//
// ทำไมต้องมี: src/config/env.ts validate ด้วย zod ตอน import แล้ว throw ถ้าไม่ครบ
// ไฟล์เทสต์ที่ mock เฉพาะ db/queries จึงพังทันทีที่ service ที่กำลังเทสต์เพิ่ม import
// ตัวใหม่ที่ลากไปถึง db/supabase — ไฟล์ทั้งไฟล์โหลดไม่ขึ้นแล้ว "หาย" จากผลรวม
//
// เคยเกิดมาแล้วสองครั้ง: จำนวน test ลดจาก 363 เหลือ 337 และจาก 415 เหลือ 403
// ซึ่งยังขึ้นสีเขียวว่า passed ทั้งหมด ถ้าไม่สังเกตตัวเลขก็ไม่รู้ว่าขาดไป
//
// ⚠️ ค่าพวกนี้เป็นค่าปลอมล้วน ไม่ต่อกับระบบจริง — การเทสต์ที่แตะ DB จริงต้อง mock เสมอ

process.env.LINE_CHANNEL_ACCESS_TOKEN ??= 'test-token';
process.env.LINE_CHANNEL_SECRET ??= 'test-secret';
process.env.SUPABASE_URL ??= 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.SESSION_SECRET ??= 'test-session-secret-0123456789abcdef';
process.env.AI_ENABLED ??= 'false';
