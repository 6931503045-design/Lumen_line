# SPEC.md

## วัตถุประสงค์
ระบบ LINE chatbot บันทึกรายรับ-รายจ่าย และช่วยวางแผนการเงินแบบสั้น ๆ ให้ทีมนักศึกษาใช้งานได้เร็วและปลอดภัย.

## ข้อกำหนดสำคัญ
- ใช้ Node.js + TypeScript + Express
- ใช้ Supabase PostgreSQL
- AI เปิด/ปิดได้ด้วย AI_ENABLED
- เงินเป็นสตางค์ (integer) และไม่ใช้ float
- AI ไม่คิดเลขเอง ต้องใช้ service คำนวณ
- ทุกการเขียนข้อมูลต้องผ่าน pending action และ confirmation
- ทุก query ต้อง filter user_id
- transfer ไม่ใช่รายรับหรือรายจ่าย
- ระบบต้องปิดเลขบัญชี/เบอร์/บัตรก่อนส่ง AI

## เกณฑ์สำเร็จ
- โครงสร้าง scaffold ถูกสร้างครบตาม v3
- ทุกไฟล์มี comment ภาษาไทย
- มี migration SQL และ docs ตัวอย่าง
- รัน `npm install` และ `npm run typecheck` ได้โดยไม่มี error
