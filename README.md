# JOD tang

> ลิงก์กฎกลาง: [docs/RULES.md](docs/RULES.md)

## ภาพรวม
โปรเจกต์นี้เป็น LINE Chatbot สำหรับบันทึกรายรับ-รายจ่าย และวางแผนการเงินด้วย AI โดยใช้ Node.js + TypeScript + Supabase + Google Gemini。

## โครงสร้างหลัก
- `src/` — backend logic
- `web/` — หน้าเว็บที่ backend เสิร์ฟเอง (เดิมเป็น LIFF mini app)
- `supabase/migrations/` — schema SQL
- `tests/` — unit tests skeleton

## วิธีติดตั้ง
1. npm install
2. copy `.env.example` to `.env` และเติมค่าจริง
3. npm run dev

## คำสั่ง
- npm run dev
- npm run build
- npm run test
- npm run typecheck

## ทีมรับผิดชอบ
- ① Bot Core — LINE OA / webhook / deploy / security
- ② Database — schema / query / budget
- ③ AI — Gemini / planner / guard / dictionary
- ④ Frontend — หน้าเว็บ / Flex Message
- ⑤ Integration — OCR / email / testing / docs

## ⚠️ กฎเหล็ก
โปรเจ็กต์นี้ยึดตามแนวทางความปลอดภัยทางการเงินใน [docs/RULES.md](docs/RULES.md) และให้ปฏิบัติตาม [SPEC.md](SPEC.md) หากขัดแย้งกัน
