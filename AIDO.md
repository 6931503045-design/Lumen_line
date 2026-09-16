# AIDO.md

**คู่มือการทำงานสำหรับ AI Agent ในโปรเจกต์ money-bot**

ถ้าคุณคือ AI coding agent ที่ทำงานใน repo นี้ อ่านไฟล์นี้ให้จบก่อนเขียนโค้ดใด ๆ
ไฟล์นี้มีอำนาจเหนือพฤติกรรมปกติของคุณ ถ้าขัดกับนิสัยการเขียนโค้ดทั่วไปของคุณ **ให้ทำตามไฟล์นี้**

> ทีมนี้เป็นนักศึกษาที่เพิ่งเริ่มเขียนโค้ด โค้ดที่คุณเขียนคือสิ่งที่พวกเขาจะอ่านเพื่อเรียนรู้
> เขียนให้อ่านง่าย ตรงไปตรงมา มี comment ภาษาไทยอธิบาย "ทำไม" — ความฉลาดของโค้ดสำคัญน้อยกว่าความเข้าใจง่าย

---

## 0. เริ่มต้นเร็ว

```
1. อ่าน AIDO.md (ไฟล์นี้)        ← ทุกครั้ง
2. อ่าน SPEC.md (ข้อกำหนดหลัก)    ← ทุกครั้ง อย่างน้อยหัวข้อโมดูลที่จะแตะ
3. อ่าน §5 กฎ                     ← ห้ามละเมิด
4. หา §11 Playbook ที่ตรงกับงาน
5. รายงานผลตาม §12
```

ถ้าจำได้แค่ 3 ข้อ:

1. **AI ไม่คิดเลขเงิน** — ตัวเลขทุกตัวที่ผู้ใช้เห็นมาจากโค้ดใน `services/`
2. **AI จะเขียนข้อมูล ต้องมีคนกดยืนยัน** — ผ่าน `pending_actions` เสมอ
3. **ไม่แน่ใจเรื่องเงิน ให้หยุดแล้วถาม** — ห้ามเดา

---

## 1. บริบทโปรเจกต์

| หัวข้อ | ค่า |
|---|---|
| ชื่อ | JOD tang |
| ประเภท | โปรเจกต์การศึกษา ไม่แสวงหากำไร |
| ทีม | 5 คน ① Bot Core ② Database ③ AI ④ Frontend ⑤ Integration |
| งบ | 0 บาท/เดือน (free tier ทั้งหมด) |
| ระยะเวลา | 4 สัปดาห์ (W1-W4) |
| SPEC | v3.0 |

### แอปนี้ทำอะไร

LINE Chatbot ที่ช่วยจดรายรับ-รายจ่าย (พิมพ์ `กาแฟ 80`, ส่งสลิป, หรือ forward อีเมลธนาคาร)
แล้วตอบ 2 คำถาม: **"วันนี้ใช้ได้อีกเท่าไหร่?"** และ **"อยากได้ของชิ้นนี้ ต้องออมยังไง?"**
ใช้ Gemini ช่วยเข้าใจภาษาคนและอ่านสลิป ส่วนการคำนวณเงินเป็นหน้าที่ของโค้ด

### แผนที่โมดูล

| ID | โมดูล | ไฟล์หลัก | AI ได้ไหม |
|---|---|---|---|
| S1 | LINE Gateway | `routes/webhook.ts`, `handlers/*`, `line/*` | ❌ (ส่งต่อให้ S4/S9 เท่านั้น) |
| S2 | LIFF Frontend | `liff/*` | ❌ |
| S3 | Core API | `routes/api.ts`, `middleware/liffAuth.ts` | ❌ |
| S4 | Text Parser | `utils/regexParser.ts`, `config/keywords.ts`, `services/keyword.service.ts`, `services/ai/router.ts` | ⚠️ L4 เท่านั้น (ผ่าน S11) |
| S5 | Money Engine | `services/summary.service.ts`, `plan.service.ts`, `budget.service.ts`, `recurring.service.ts`, `utils/money.ts` | 🔴 ห้ามเด็ดขาด |
| S6 | Database | `supabase/migrations/*`, `db/*` | ❌ |
| S7 | Scheduler | `jobs/*`, `routes/jobs.ts` | ❌ |
| S8 | Email Ingestion | `services/email.service.ts` | ❌ (regex เท่านั้น) |
| S9 | Slip Reader | `handlers/imageHandler.ts`, `services/ai/vision.ts` | ✅ ผ่าน S11 |
| S10 | Dedup | `services/dedup.service.ts` | 🔴 ห้ามเด็ดขาด |
| S11 | AI Service | `services/ai/*` | ✅ ที่เดียวที่เรียก provider ได้ |
| S12 | Pending Actions | `services/pending.service.ts` | ❌ |
| S13 | Push & Quota | `line/push.ts`, `services/quota.service.ts` | ❌ |

---

## 2. ลำดับความน่าเชื่อถือของข้อมูล

เมื่อข้อมูลขัดกัน ให้ยึดตามลำดับนี้:

```
1. SPEC.md                    ← สูงสุด
2. AIDO.md (ไฟล์นี้)           ← กฎการทำงาน
3. docs/RULES.md              ← กฎเหล็กฉบับย่อ (ต้องตรงกับ SPEC)
4. โค้ดที่มีอยู่ใน repo          ← ทำตามแบบที่ทีมเขียนไว้
5. Prompt_AI_Agent_v3.md      ← ใช้สร้าง scaffold ครั้งแรกเท่านั้น
6. ความเห็นของคุณเอง            ← ต่ำสุด ถ้าไม่แน่ใจให้ถาม
```

คุณต้อง **ไม่**:

- เขียนโค้ดขัดกับ `SPEC.md` โดยไม่แจ้งทีมอย่างชัดเจน
- เปลี่ยนพฤติกรรมที่ SPEC กำหนดไว้แบบเงียบ ๆ
- คิด requirement ใหม่ที่ SPEC ไม่ได้เขียน

SPEC กำกวมเรื่องเงิน → **ถาม** ห้ามตัดสินเอง

---

## 3. Tech Stack (ห้ามเปลี่ยน)

| ชั้น | เทคโนโลยี | ล็อก? |
|---|---|---|
| Runtime | Node.js + TypeScript | 🔒 |
| Web server | Express | 🔒 |
| Database | Supabase ผ่าน `@supabase/supabase-js` | 🔒 |
| Chat | `@line/bot-sdk` | 🔒 |
| AI | `@google/genai` (Gemini) | 🔒 |
| Validation | Zod | 🔒 |
| วันที่ | dayjs + utc + timezone | 🔒 |
| Cron | node-cron + GitHub Actions | 🔒 |
| Test | vitest | 🔒 |
| Frontend | LIFF + Vanilla HTML/CSS/JS + Chart.js (CDN) | 🔒 |

**กฎ:**

- ❌ ห้ามเพิ่ม dependency โดยไม่เขียนเหตุผลในรายงาน — ข้อยกเว้นที่อนุมัติแล้ว: ไลบรารี IMAP + mail parser ใน W4 (⑤)
- ❌ ห้ามใช้ ORM (Prisma, TypeORM, Drizzle ฯลฯ) — ใช้ supabase-js ตรง ๆ
- ❌ ห้ามใช้ framework ฝั่ง LIFF (React, Vue, Tailwind build) — ทีมยังไม่พร้อม
- ❌ ห้ามใช้ `number` แบบทศนิยมกับเงิน และห้ามเพิ่มไลบรารีเงินอื่น — ใช้สตางค์ผ่าน `utils/money.ts`
- ❌ ห้ามเพิ่ม Python หรือภาษาอื่น

---

## 4. โครงสร้าง Repository

```
money-bot/
├── SPEC.md  AIDO.md  README.md  .env.example
├── supabase/migrations/          ← SQL เท่านั้น ไฟล์ใหม่ = 002_xxx.sql, 003_xxx.sql
├── src/
│   ├── index.ts                  ← ประกอบแอป ห้ามมี business logic
│   ├── config/                   ← env, ค่าคงที่, พจนานุกรมกลาง
│   ├── middleware/               ← liffAuth
│   ├── routes/                   ← รับ request → Zod → เรียก service → ตอบ (บาง ๆ)
│   ├── handlers/                 ← รับ LINE event → เรียก service → ตอบ Flex (บาง ๆ)
│   ├── services/                 ← business logic ทั้งหมดอยู่ที่นี่
│   │   └── ai/                   ← ที่เดียวที่ import @google/genai ได้
│   ├── db/                       ← client + query แยกตามโดเมน
│   ├── line/                     ← client, reply, push, flex, richmenu
│   ├── utils/                    ← ฟังก์ชันบริสุทธิ์ (ไม่แตะ DB, ไม่แตะ network)
│   ├── jobs/                     ← cron
│   └── types/
├── tests/                        ← vitest + fixtures (ข้อมูลปลอมเท่านั้น)
├── liff/                         ← Vanilla JS ห้ามมี secret
├── docs/
└── .github/workflows/
```

**กฎการวางไฟล์:**

- business logic อยู่ใน `services/` เท่านั้น — `routes/` และ `handlers/` ทำแค่รับ ตรวจ เรียก ตอบ
- ไฟล์ที่ import `@google/genai` ต้องอยู่ใน `src/services/ai/` เท่านั้น
- `utils/` ต้องเป็นฟังก์ชันบริสุทธิ์ รับค่า → คืนค่า ไม่มี side effect จึง test ง่าย
- SQL query อยู่ใน `db/queries/` — service เรียกผ่านฟังก์ชัน ไม่เขียน query กระจายไปทั่ว

---

## 5. กฎ 🔴

แอปนี้จัดการเงินของคน การละเมิดกฎเหล่านี้ทำให้ **ข้อมูลเพี้ยนแบบเงียบ ๆ** ซึ่งแย่กว่าแอปพัง
แอปพังทุกคนเห็น แต่ยอดเงินที่ผิดไป 50 บาทไม่มีใครเห็นจนผู้ใช้เลิกเชื่อแอป

### 5.0 กฎเหล็ก 7 ข้อ (สรุปจาก SPEC §2.4)

| ข้อ | กฎ |
|---|---|
| G1 | AI ไม่คิดเลขเงิน |
| G2 | AI จะเขียน/แก้/ลบ ต้องผ่าน pending และผู้ใช้กดยืนยัน |
| G3 | เงินเป็นบวก, DB `numeric(12,2)`, โค้ดเป็นสตางค์ |
| G4 | `AI_ENABLED=false` แล้ว P0 ยังใช้ได้ |
| G5 | ส่งให้ AI เท่าที่จำเป็น + redact |
| G6 | ทุก query กรอง `user_id` ที่มาจาก server |
| G7 | transfer ไม่นับเป็นรายรับ/รายจ่าย |

### 5.1 กฎเรื่องเงิน

| # | กฎ |
|---|---|
| M1 | ห้ามคำนวณเงินด้วยทศนิยม ใช้สตางค์ (integer) ผ่าน `toSatang()` / `fromSatang()` / `formatBaht()` / `splitEvenly()` |
| M2 | ตัวแปรเงินในโค้ดชื่อลงท้าย `Satang` เสมอ (`amountSatang`, `limitSatang`) ถ้าเห็นตัวแปรเงินที่ไม่มีคำนี้ ถือว่าเป็นบั๊ก |
| M3 | จำนวนเงินเป็นบวกเสมอ ทิศทางดูจาก `type` ห้ามเก็บค่าติดลบ |
| M4 | ไม่มียอดคงเหลือเก็บไว้ ทุกยอดคำนวณสดจาก transactions ห้ามบวก/ลบทีละรายการไปเก็บในคอลัมน์ |
| M5 | ผลรวมให้ SQL ทำ (`sum` บน numeric) แล้วแปลงผลด้วย `toSatang()` |
| M6 | ทุกการคำนวณกรอง `deleted_at is null` และตัด `type='transfer'` ออก |
| M7 | แสดงผลเป็น `฿1,250.00` ผ่าน `formatBaht()` เท่านั้น |
| M8 | ค่าจาก Supabase ที่เป็น numeric อาจมาเป็น number หรือ string — ผ่าน `toSatang()` ทุกครั้ง ห้าม `parseFloat()` แล้วคูณ 100 |

### 5.2 กฎเรื่อง AI

| # | กฎ |
|---|---|
| A1 | 🔴 AI ห้ามคำนวณตัวเลขใด ๆ ที่มีผลกับยอดเงิน ทำได้แค่ดึงตัวเลขที่ปรากฏในข้อความ/รูป และเลือก tool |
| A2 | 🔴 args ของ tool และ JSON จากสลิป ต้องผ่าน Zod + sanity check ก่อนใช้ ไม่ผ่าน = ทิ้ง แล้วถามผู้ใช้กลับ |
| A3 | 🔴 tool ประเภท write ทุกตัว → `pending_actions` → ผู้ใช้กด ✅ ไม่มีข้อยกเว้น ไม่ว่า AI จะมั่นใจแค่ไหน |
| A4 | 🔴 ระบบต้องทำงานได้เมื่อ `AI_ENABLED=false` ทุก code path ที่เรียก AI ต้องมีทางไปต่อแบบไม่ใช้ AI |
| A5 | 🔴 ห้ามส่งรายการธุรกรรมดิบให้ AI และห้ามส่งผลของ tool กลับเข้า AI |
| A6 | 🔴 redact ข้อความก่อนส่ง AI ทุกครั้ง (เลขบัญชี, เบอร์โทร, เลขบัตร, เลขบัตรประชาชน) |
| A7 | 🔴 ทุกการเรียก AI ผ่าน `services/ai/guard.ts` ห้ามเรียก provider ตรงจากที่อื่น |
| A8 | 🟠 history ส่งไม่เกิน `CHAT_HISTORY_TURNS` (3) turn |
| A9 | 🟠 ข้อความ `kind='text'` จาก Gemini ใช้ได้เฉพาะคำถามถามกลับ ถ้ามีตัวเลขเงินที่ไม่อยู่ในข้อความผู้ใช้ → ทิ้ง |
| A10 | 🟠 เนื้อหาที่มาจาก AI แสดงป้าย ✨ AI / เนื้อหาเชิงวางแผนแสดง `AI_DISCLAIMER` |
| A11 | 🟠 ผู้ใช้ปิด AI ได้ด้วย `users.ai_enabled` และ guard ต้องเคารพค่านี้ |

### 5.3 กฎความปลอดภัย

| # | กฎ |
|---|---|
| S1 | 🔴 ตรวจ `x-line-signature` ทุก webhook → 401 เมื่อไม่ผ่าน |
| S2 | 🔴 `/api/*` ต้องผ่าน `liffAuth` ซึ่งตรวจ ID token กับ LINE ที่ฝั่ง server |
| S3 | 🔴 ห้ามเชื่อ userId จาก body / query / header ที่ client ใส่เอง ใช้ `req.userId` หรือ userId จาก event ที่ผ่านการตรวจลายเซ็นแล้วเท่านั้น |
| S4 | 🔴 ทุก query ต้องมี `.eq('user_id', userId)` — `SERVICE_ROLE_KEY` ข้าม RLS ได้ทั้งหมด ลืมครั้งเดียว = ข้อมูลรั่ว |
| S5 | 🔴 id ใด ๆ ที่ client ส่งมา (`categoryId`, `planId`, `pendingId`) ต้องตรวจว่าเป็นของผู้ใช้คนนั้นก่อนใช้ |
| S6 | 🔴 secret ทุกตัวอยู่ใน `.env` ฝั่ง server เท่านั้น ห้ามอยู่ใน `liff/` ห้าม commit |
| S7 | 🔴 อีเมลต้องผ่าน DKIM + whitelist โดเมนธนาคาร + token ถูกต้อง |
| S8 | 🟠 `/jobs/*` ตรวจ `CRON_SECRET` ด้วย `crypto.timingSafeEqual` |
| S9 | 🟠 logger ต้อง redact ก่อนเขียน / ห้าม log token, key, เนื้อหาสลิป |
| S10 | 🟠 LIFF ห้ามใช้ localStorage / sessionStorage เก็บ token |

### 5.4 กฎข้อมูล

| # | กฎ |
|---|---|
| D1 | เวลาใช้ `timestamptz` ใน DB และ dayjs + `Asia/Bangkok` ในโค้ด ห้ามใช้ `new Date()` ตัดวัน/เดือนที่ผู้ใช้เห็น |
| D2 | ใน SQL แบ่งวันด้วย `(occurred_at at time zone 'Asia/Bangkok')::date` |
| D3 | ลบ transaction = ตั้ง `deleted_at` / ห้าม `.delete()` กับตาราง transactions |
| D4 | เปลี่ยน schema = ไฟล์ migration ใหม่ ห้ามแก้ไฟล์ migration เก่าที่รันไปแล้ว |
| D5 | ห้าม commit อีเมล สลิป เลขบัญชี หรือยอดเงินจริง fixtures ต้องเป็นข้อมูลปลอม |
| D6 | ห้ามเก็บไฟล์รูปสลิป |
| D7 | ทุก cron job และทุก postback ต้อง idempotent |

### 5.5 กฎเรื่อง LINE

| # | กฎ |
|---|---|
| L1 | ตอบด้วย reply ก่อนเสมอ (ฟรี) ใช้ push เฉพาะเมื่อไม่มี reply token |
| L2 | push ทุกครั้งผ่าน `quota.service` + มี `dedup_key` |
| L3 | ก่อนรอ Gemini เรียก loading animation แล้วใช้ reply token เดิม ห้ามเปลี่ยนเป็น push เพราะ AI ช้า |
| L4 | reply token ใช้ได้ครั้งเดียว — รวมทุกข้อความที่จะตอบไว้ใน reply เดียว (สูงสุด 5 message) |
| L5 | postback data ≤ 300 ตัวอักษร ใส่แค่ `action` + id ห้ามใส่ข้อมูลทั้งก้อน |
| L6 | ห้าม `app.use(express.json())` ครอบทั้งแอป (middleware ของ LINE ต้องใช้ body ดิบ) |

---

## 6. เขตห้าม AI 🔴

ไฟล์เหล่านี้ต้องไม่มีการเรียก AI เลย ถ้างานที่ได้รับขอให้ใส่ AI ในไฟล์เหล่านี้ **ให้ปฏิเสธและอธิบายเหตุผล**

| ไฟล์ / งาน | ทำไมต้องเป็นโค้ดล้วน |
|---|---|
| `summary.service.ts` | ผู้ใช้ถามยอดเดิมสองครั้งต้องได้ตัวเลขเดิม ถ้าไม่เท่ากันผู้ใช้จะเลิกเชื่อแอปทันที |
| `plan.service.ts` | แผนออมคือคำสัญญาต่อผู้ใช้ สูตรต้องอธิบายได้และทดสอบได้ |
| `budget.service.ts` | การเตือนงบต้องแม่นทุกสตางค์ |
| `recurring.service.ts` | การนับรอบคือตรรกะวันที่ล้วน ๆ |
| `dedup.service.ts` | รวมรายการผิด = ข้อมูลหายแบบไม่มีร่องรอย |
| `quota.service.ts`, `pending.service.ts` | ตรรกะควบคุมระบบ ต้องคาดเดาได้ |
| `utils/money.ts`, `thaiDate.ts`, `thaiNumber.ts`, `regexParser.ts` | ฟังก์ชันพื้นฐานที่ทุกอย่างพึ่งพา ต้องทดสอบได้ 100% |
| `email.service.ts` | อีเมลธนาคารรูปแบบคงที่ regex แม่นกว่าและฟรี |

---

## 7. ที่ที่อนุญาตให้ใช้ AI

มีแค่ 2 งาน อยู่ใน `src/services/ai/` ทั้งคู่

| งาน | ไฟล์ | ผู้เรียก | หน้าที่ |
|---|---|---|---|
| T1 `understandText` | `gemini.ts` + `tools.ts` + `prompt.ts` | `ai/router.ts` (L4) | เลือก 1 ใน 8 tools + ดึง args จากข้อความ หรือถามกลับ |
| T2 `readSlip` | `vision.ts` | `imageHandler.ts` | อ่านสลิปเป็น JSON |

**ทุกงานต้องผ่าน Guard ตามลำดับนี้:**

```
1. AI_ENABLED และ users.ai_enabled     → ไม่ผ่าน: { ok:false, reason:'disabled' }
2. จำนวนครั้งวันนี้ของ user (เวลาไทย)    → ≥ AI_DAILY_LIMIT_PER_USER: 'user_limit'
3. จำนวนครั้งวันนี้ทั้งระบบ              → ≥ AI_DAILY_LIMIT_GLOBAL: 'global_limit'
4. redact ข้อความ
5. เรียก provider พร้อม timeout AI_TIMEOUT_MS, retry 1 ครั้ง (timeout/network/5xx เท่านั้น)
6. Zod + sanity check                  → ไม่ผ่าน: ถามผู้ใช้กลับ
7. เขียน ai_usage_log                  → ทุกครั้ง ทั้งสำเร็จและล้มเหลว
```

**Sanity check:**

- `0 < amount ≤ 10,000,000`
- `split_count` อยู่ระหว่าง 2–50
- วันที่: ไม่เกินพรุ่งนี้ ไม่ย้อนเกิน 1 ปี (สลิป: ไม่อยู่ในอนาคต)
- `limit` ของ query ≤ 10 / batch ≤ 10 รายการ

**ข้อกำหนดของ prompt:**

- เขียน Zod schema **ก่อน** เขียน prompt
- ต้องมีประโยคประมาณ: "ดึงเฉพาะตัวเลขที่ผู้ใช้พิมพ์ ห้ามคำนวณ ห้ามประมาณ ไม่มีให้เว้นไว้"
- สั้นที่สุดเท่าที่ทำได้ — token คือโควตา
- ใส่วันที่ปัจจุบันเวลาไทยใน system prompt ทุกครั้ง

---

## 8. แนวทางการเขียนโค้ด

### TypeScript

- `strict: true` — ห้าม `any` ห้าม `!` (non-null assertion) ถ้าไม่มีเหตุผลเขียนกำกับ
- ใช้ named export (ไม่ใช้ `export default`)
- Zod schema มาก่อน แล้วค่อยได้ type ด้วย `z.infer` — ห้ามเขียน type ซ้ำด้วยมือ
- `async/await` เท่านั้น ห้าม `.then()` ต่อกันยาว ๆ
- error: โยน `Error` ที่มีข้อความชัดเจน → handler/route จับ → log ผ่าน `logger` → ตอบ `errorCard` หรือ HTTP 500
- ห้าม `catch (e) {}` ว่างเปล่าเด็ดขาด
- ฟังก์ชันใน `services/` รับ `userId` เป็นพารามิเตอร์แรกเสมอ
- ฟังก์ชันที่ขึ้นกับเวลา รับ `now` เป็นพารามิเตอร์ (ค่าเริ่มต้น = เวลาปัจจุบัน) เพื่อให้ test ได้

### การตั้งชื่อ

| ประเภท | รูปแบบ | ตัวอย่าง |
|---|---|---|
| ไฟล์ทั่วไป | camelCase | `textHandler.ts`, `regexParser.ts` |
| ไฟล์ service | camelCase + `.service.ts` | `plan.service.ts` |
| ฟังก์ชัน | camelCase ขึ้นต้นด้วยกริยา | `createSavingPlan()`, `getDailySafeToSpend()` |
| ตัวแปรเงิน | ลงท้าย `Satang` | `amountSatang`, `capacitySatang` |
| ค่าคงที่ | SCREAMING_SNAKE | `MAX_ACTIVE_PLANS` |
| ตาราง / คอลัมน์ DB | snake_case | `pending_actions`, `occurred_at` |
| Zod schema | PascalCase + `Schema` | `CreateTransactionSchema` |
| ชื่อ tool ของ Gemini | snake_case | `create_transaction` |
| postback action | snake_case | `confirm_action` |

### Comment

เขียน **ภาษาไทย** อธิบาย **ทำไม** ไม่ใช่แค่ **ทำอะไร** และอ้างกฎหรือหัวข้อ SPEC เมื่อเป็นเรื่องเงิน:

```typescript
// ⚖️ G7 (SPEC §S5): ตัด transfer ออก เพราะการโอนเข้าบัญชีออมของตัวเอง
// ไม่ใช่การใช้เงิน ถ้านับรวม รายจ่ายเดือนนี้จะสูงเกินจริง
```

ทุกไฟล์มี comment หัวไฟล์ตามแบบนี้:

```typescript
/**
 * 📄 plan.service.ts — คำนวณและจัดการแผนออม
 * 👤 ผู้รับผิดชอบ: ③ AI
 * 📅 สัปดาห์: W3
 * ⚖️ กฎที่ต้องระวัง: G1, G3, G7 / SPEC §S5.3–S5.6
 *
 * TODO:
 * [ ] getDisposable(userId, now)
 * [ ] createSavingPlan(userId, targetSatang, months?, now)
 * [ ] confirmPlan(userId, planId)
 */
```

---

## 9. การทดสอบ

| กฎ | รายละเอียด |
|---|---|
| T1 | ห้ามเรียก Gemini หรือ LINE จริงใน test — mock เสมอ |
| T2 | fixtures เป็นข้อมูลปลอมทั้งหมด |
| T3 | ไฟล์ที่ต้องมี test: `regexParser`, `thaiNumber`, `thaiDate`, `money`, `redact`, `plan.service`, `summary.service` |
| T4 | golden set: `tests/fixtures/messages.json` ≥ 30 ข้อความ ข้อความที่ควรจบที่ L1 ต้องผ่าน ≥ 90% |
| T5 | ความแม่นยำเงิน: บวก ฿0.10 × 10,000 ครั้ง = ฿1,000.00 เป๊ะ |
| T6 | ความสม่ำเสมอ: `getDailySafeToSpend` / `createSavingPlan` ข้อมูลเดิม 100 ครั้งได้ผลเดิม |
| T7 | ความเป็นเจ้าของ: service ที่รับ id ต้องมี test ว่าใช้ id ของผู้ใช้อื่นแล้วไม่ได้ข้อมูล |
| T8 | เวลา: test กรณี 23:59 และ 00:01 เวลาไทย สิ้นเดือน และข้ามปี |
| T9 | ห้ามแก้ test ให้ผ่านด้วยการลบ assertion หรือปิดการตรวจ — ถ้า test ผิด ให้รายงาน |

เขียน test **ก่อน** โค้ดจริง สำหรับ `utils/money.ts`, `regexParser.ts` และ `plan.service.ts`

**แนะนำ (ถ้ามีเวลา):** `tests/architecture.test.ts` อ่านไฟล์ทั้งหมดใน `src/` แล้ว assert ว่าไม่มีไฟล์นอก `src/services/ai/` ที่ import `@google/genai`

---

## 10. นิยามของ "เสร็จ"

งานถือว่าเสร็จเมื่อทุกข้อเป็นจริง:

- [ ] `npm run typecheck` ผ่าน ไม่มี error
- [ ] `npm test` ผ่านทั้งหมด (และมี test ใหม่ถ้าแตะไฟล์ในข้อ T3)
- [ ] ไม่ละเมิดกฎใน §5
- [ ] ทุก query มี `user_id`
- [ ] เงินทุกตัวเป็นสตางค์ ชื่อตัวแปรลงท้าย `Satang`
- [ ] code path ที่เรียก AI มีทางไปต่อเมื่อ AI ปิด
- [ ] comment หัวไฟล์อัปเดตแล้ว (ติ๊ก TODO ที่ทำเสร็จ)
- [ ] `.env.example` อัปเดตถ้าเพิ่มตัวแปร
- [ ] `SPEC.md` อัปเดตถ้าพฤติกรรมเปลี่ยน
- [ ] ไม่มี secret หรือข้อมูลจริงใน commit
- [ ] commit message แบบ Conventional Commits
- [ ] มีรายงานตาม §12

---

## 11. Playbook ตามประเภทงาน

### 11.1 เพิ่ม API endpoint ให้ LIFF

```
1. เขียน Zod schema ของ request (เงินเป็น amountSatang: integer)
2. เขียน logic ใน services/ (รับ userId เป็นพารามิเตอร์แรก)
3. เพิ่ม route ใน routes/api.ts — ตรวจ Zod → เรียก service → ตอบ
4. ตรวจความเป็นเจ้าของของทุก id ที่ client ส่งมา
5. เพิ่มฟังก์ชันเรียกใน liff/js/api.js
6. อัปเดตตาราง endpoint ใน SPEC §S3.2
```

แม่แบบ:

```typescript
// src/routes/api.ts (ตัวอย่าง endpoint เดียว)
import { Router } from 'express';
import { z } from 'zod';
import { liffAuth } from '../middleware/liffAuth';
import { createTransaction } from '../services/transaction.service';
import { MAX_AMOUNT_SATANG } from '../config/constants';
import { logger } from '../utils/logger';

// Zod มาก่อนเสมอ — type ได้จาก z.infer ไม่ต้องเขียนซ้ำ
const CreateTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amountSatang: z.number().int().positive().max(MAX_AMOUNT_SATANG), // ⚖️ G3
  categoryId: z.string().uuid().nullable(),
  note: z.string().max(500).optional(),
  occurredAt: z.string().datetime({ offset: true }),
});

export const apiRouter = Router();
apiRouter.use(liffAuth); // ⚖️ G6: ได้ req.userId จาก ID token ที่ LINE ยืนยันแล้ว

apiRouter.post('/transactions', async (req, res) => {
  const parsed = CreateTransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
  }

  try {
    // ผู้ใช้กรอกเองในหน้า LIFF → บันทึกทันที ไม่ต้องผ่าน pending (SPEC §S3.2)
    // ⚖️ G6: service จะตรวจว่า categoryId เป็นของ userId นี้จริง
    const tx = await createTransaction(req.userId, {
      ...parsed.data,
      source: 'liff',
      parsedBy: 'manual',
    });
    return res.status(201).json(tx);
  } catch (e) {
    logger.error('สร้างรายการจาก LIFF ไม่สำเร็จ', e);
    return res.status(500).json({ error: 'INTERNAL' });
  }
});
```

### 11.2 เพิ่มหรือแก้ Gemini tool

```
1. ยืนยันว่างานนี้ทำด้วย regex/พจนานุกรม/คำสั่งตายตัวไม่ได้ (ถ้าได้ ให้ทำแบบนั้น)
2. กำหนด kind: 'read' หรือ 'write'
3. เขียน Zod schema ของ args ก่อน — args เป็น "ข้อมูลดิบจากผู้ใช้" เท่านั้น ไม่มีค่าที่ต้องคำนวณ
4. เขียน declaration ให้ตรงกับ Zod (ชื่อฟิลด์เดียวกันทุกตัว)
5. write → ผลลัพธ์คือ createPending() + pendingCard
   read  → เรียก service ใน S5 → Flex (ไม่ส่งผลกลับเข้า Gemini)
6. เพิ่มข้อความตัวอย่างอย่างน้อย 3 ข้อใน fixtures
7. เพิ่มทางไปต่อเมื่อ AI ปิด (คำสั่งตายตัว หรือแนะนำให้ใช้ LIFF)
8. อัปเดต Tool catalog ใน SPEC §S11.2
```

แม่แบบ:

```typescript
// src/services/ai/tools.ts (ตัวอย่าง tool เดียว)
import { Type, type FunctionDeclaration } from '@google/genai';
import { z } from 'zod';

export const createTransactionTool = {
  kind: 'write' as const, // ⚖️ G2: write → ต้องผ่าน pending_actions

  // ⚖️ G1: ทุกฟิลด์คือ "สิ่งที่ผู้ใช้พูด" ไม่มีฟิลด์ไหนให้ AI คำนวณ
  args: z.object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.number().positive().max(10_000_000), // ตามที่พิมพ์ เช่น 320
    item: z.string().min(1).max(100),
    split_count: z.number().int().min(2).max(50).optional(), // โค้ดเป็นคนหาร
    date_text: z.string().max(50).optional(),              // เช่น "เมื่อวาน" → thaiDate แปลง
    category_hint: z.string().max(50).optional(),
    plan_name: z.string().max(100).optional(),
  }),

  declaration: {
    name: 'create_transaction',
    description: 'บันทึกรายรับหรือรายจ่าย 1 รายการตามที่ผู้ใช้พิมพ์ ห้ามคำนวณตัวเลขเอง',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['income', 'expense', 'transfer'] },
        amount: { type: Type.NUMBER, description: 'ตัวเลขตามที่ผู้ใช้พิมพ์ ห้ามคำนวณ ห้ามหาร' },
        item: { type: Type.STRING, description: 'ชื่อสิ่งที่ซื้อหรือที่มาของเงิน' },
        split_count: { type: Type.INTEGER, description: 'ถ้าผู้ใช้บอกว่าหารกันกี่คน' },
        date_text: { type: Type.STRING, description: 'คำบอกวันตามที่ผู้ใช้พูด เช่น เมื่อวาน ห้ามแปลงเป็นวันที่' },
        category_hint: { type: Type.STRING },
        plan_name: { type: Type.STRING, description: 'ชื่อแผนออม ใช้เมื่อ type เป็น transfer' },
      },
      required: ['type', 'amount', 'item'],
    },
  } satisfies FunctionDeclaration,
};
```

### 11.3 เพิ่มคำสั่งตายตัวในแชท

```
1. ตรวจว่าชื่อคำสั่งไม่ชนกับข้อความจดรายการทั่วไป (เช่น "ข้าว" ห้ามเป็นคำสั่ง)
2. เพิ่มใน textHandler ก่อนส่งเข้า router — จับแบบตรงทั้งข้อความ
3. logic อยู่ใน service ไม่ใช่ใน handler
4. ต้องทำงานได้เมื่อ AI ปิด (นี่คือเหตุผลที่มีคำสั่งตายตัว)
5. อัปเดตข้อความ "ช่วยเหลือ" + ตารางคำสั่งใน SPEC §S1
```

### 11.4 แตะ `plan.service.ts` หรือ `summary.service.ts`

> ⚠️ **พื้นที่เสี่ยงที่สุด — ทำอย่างระมัดระวัง**

```
1. อ่าน SPEC §S5 ทั้งหมด
2. เขียน/แก้ test ก่อน ด้วยตัวเลขที่คำนวณด้วยมือไว้ใน comment
3. คำนวณเป็นสตางค์ทั้งหมด ปัดครั้งเดียวตอนท้าย ตามทิศทางที่ SPEC กำหนด
4. ตัด transfer และรายการที่ลบแล้วเสมอ
5. avgEssential ต้องตัด source='recurring' (ไม่งั้นนับซ้ำกับ recurringTotal)
6. ตรวจกฎ 0.8 และ 3 แผน ทั้งตอนสร้าง draft และตอนกดยืนยัน
7. แสดงป้ายความมั่นใจตาม cold-start ทุกครั้ง
8. รัน test ความสม่ำเสมอ (T6)
9. ห้ามใส่ AI
10. เปลี่ยนสูตร → หยุดถามทีม (② + ③) และแก้ SPEC พร้อมกัน
```

### 11.5 เพิ่มการบันทึกที่มาจาก AI หรือสลิป

```
1. ได้ args/JSON → Zod → sanity
2. แปลงเป็นข้อมูลจริงในโค้ด: toSatang, splitEvenly, thaiDate, หา category_id
3. แปลงไม่ได้ (วันที่ไม่รู้จัก, แผนหาไม่เจอ) → ถามกลับ ห้ามเดา
4. createPending(userId, action, payloadที่แปลงแล้ว, source)
5. ตอบ pendingCard (✨ AI + รายละเอียด + คำเตือนถ้าอาจซ้ำ)
6. ตอน confirm: จองแถวแบบ atomic → บันทึก → learn คำ
```

แม่แบบการจองแถว:

```typescript
// src/services/pending.service.ts (แนวคิด)
export async function confirmPending(userId: string, pendingId: string) {
  // ⚖️ G2 + D7: "จอง" แถวแบบ atomic
  // ถ้าผู้ใช้กด ✅ สองครั้ง ครั้งที่สองจะไม่เจอแถวที่ยัง waiting → ไม่บันทึกซ้ำ
  const { data: row, error } = await supabase
    .from('pending_actions')
    .update({ status: 'confirmed' })
    .eq('id', pendingId)
    .eq('user_id', userId) // ⚖️ G6
    .eq('status', 'waiting')
    .gt('expires_at', new Date().toISOString())
    .select()
    .maybeSingle();

  if (error) throw new Error(`confirmPending: ${error.message}`);
  if (!row) return { ok: false as const, reason: 'already_handled_or_expired' };

  try {
    await executeAction(userId, row); // เรียก transaction.service / recurring.service
  } catch (e) {
    // บันทึกจริงไม่สำเร็จ → คืนสถานะให้ผู้ใช้กดใหม่ได้
    await supabase.from('pending_actions').update({ status: 'waiting' })
      .eq('id', pendingId).eq('user_id', userId);
    throw e;
  }
  return { ok: true as const };
}
```

### 11.6 เพิ่ม Flex card

```
1. สร้างไฟล์ใน line/flex/ รับข้อมูลที่ "คำนวณเสร็จแล้ว" (สตางค์) → คืน Flex JSON
2. การ์ดไม่คำนวณอะไรเอง แสดงเงินด้วย formatBaht() เท่านั้น
3. ปุ่ม postback: data = action + id เท่านั้น (≤ 300 ตัวอักษร)
4. มาจาก AI → ป้าย ✨ AI / เชิงวางแผน → AI_DISCLAIMER
5. ทดสอบใน Flex Message Simulator ของ LINE ก่อน
```

### 11.7 เพิ่ม cron job

```
1. เขียนฟังก์ชันใน jobs/ ให้ idempotent (unique key, flag, หรือ dedup_key)
2. ลงทะเบียนใน jobs/index.ts พร้อม { timezone: 'Asia/Bangkok' }
3. ลงทะเบียนชื่อใน routes/jobs.ts
4. ถ้าต้องมีตัวสำรองใน cron.yml → แปลงเวลาไทยเป็น UTC (ลบ 7 ชั่วโมง)
5. ถ้า push → ผ่าน quota.service + dedup_key
6. อัปเดตตาราง S7 ใน SPEC
```

### 11.8 แก้ Database schema

```
1. สร้างไฟล์ใหม่ supabase/migrations/00X_xxx.sql (ห้ามแก้ไฟล์เก่า)
2. เงิน numeric(12,2) / เวลา timestamptz / ตารางใหม่ต้องมี user_id + enable RLS
3. เพิ่ม index ถ้ามี query รูปแบบใหม่
4. อัปเดต types/index.ts และ SPEC §S6
5. แจ้งทีมให้รัน migration ใน Supabase ของทุกคน
```

### 11.9 ธนาคารเปลี่ยนรูปแบบอีเมล

```
1. ดู user_emails ที่ parsed=false → เอา body_redacted มาเป็น fixture ใหม่ (ตรวจว่าไม่มีข้อมูลจริงเหลือ)
2. เขียน test ที่ fail ก่อน
3. แก้/เพิ่ม pattern ของธนาคารนั้น
4. เขียนสคริปต์ parse ใหม่สำหรับแถวที่ parsed=false (ผ่าน dedup ทุกแถว)
5. ห้ามแก้ปัญหาด้วยการส่งอีเมลให้ AI อ่าน
```

---

## 12. รูปแบบรายงานเมื่อทำงานเสร็จ

```markdown
## สรุป
<1 ย่อหน้า: ทำอะไร และทำไม — เขียนให้นักศึกษาปี 1 อ่านเข้าใจ>

## ไฟล์ที่เปลี่ยน
- `path/to/file.ts` — <เปลี่ยนอะไร>

## กฎที่เกี่ยวข้อง
- ⚖️ G3: เงินเป็นสตางค์ผ่าน utils/money.ts
- ⚖️ G6: ทุก query กรอง user_id

## Test
- <ชื่อ test> — <พิสูจน์อะไร> — ผ่าน/ไม่ผ่าน

## Dependency ที่เพิ่ม
- ไม่มี  (หรือ: <ชื่อ> — <เหตุผล>)

## สมมติฐาน
- <เฉพาะเรื่องที่ไม่เกี่ยวกับเงิน>

## คำถามที่ต้องให้ทีมยืนยัน
- <โดยเฉพาะเรื่องสูตร การปัดเศษ และตรรกะเงิน>

## สิ่งที่ทีมควรเรียนรู้จากงานนี้
- <1-2 ข้อ อธิบายแนวคิดที่ใช้ เช่น "ทำไมต้องจองแถวแบบ atomic">

## Commit message
feat(plan): <ข้อความแบบ Conventional Commits>
```

ถ้าคุณตั้งสมมติฐานเรื่อง **ตรรกะเงิน** ให้ใส่ใน "คำถามที่ต้องให้ทีมยืนยัน" ไม่ใช่ "สมมติฐาน"

---

## 13. เมื่อไหร่ต้องหยุดแล้วถาม 🛑

| สถานการณ์ | เหตุผล |
|---|---|
| งานขอให้ใส่ AI ในเขตห้าม AI (§6) | ละเมิดหลักการออกแบบ |
| งานขอให้ AI เขียนข้อมูลโดยไม่ผ่าน pending | ละเมิด G2 |
| ต้องเปลี่ยนสูตรใน S5 หรือวิธีปัดเศษ | ตัวเลขที่ผู้ใช้เห็นจะเปลี่ยน |
| SPEC กำกวมหรือขัดกันเอง | ต้องให้คนตัดสิน |
| กฎความปลอดภัยดูเหมือนขวางงาน | ห้ามหาทางอ้อม ให้แจ้งทีม |
| อยากเพิ่ม dependency นอก §3 | stack ล็อกแล้ว |
| อยากเก็บเงินเป็นทศนิยม | ห้ามเด็ดขาด |
| จะมีข้อมูลจริงเข้า repo | ความเป็นส่วนตัว |
| งานจะทำให้เรียก AI มากขึ้นชัดเจน | โควตาจำกัด (③ ต้อง review) |
| งานจะเพิ่ม push | โควตาจำกัด (① ต้อง review) |

**ห้ามทำเงียบ ๆ:**

- เปลี่ยนชนิดคอลัมน์ใน DB หรือแก้ไฟล์ migration เก่า
- เปลี่ยนตรรกะ `liffAuth` หรือการตรวจลายเซ็น
- เปลี่ยนเงื่อนไขของ dedup (30 นาที, ยอดเท่ากันเป๊ะ)
- ปิดการตรวจ Zod หรือลบ assertion เพื่อให้ test ผ่าน
- commit ตรงเข้า `main`

---

## 14. ข้อผิดพลาดที่พบบ่อย

| ❌ ผิด | ✅ ถูก |
|---|---|
| `const total = a + b` โดย a, b เป็นบาทมีทศนิยม | `const totalSatang = aSatang + bSatang` |
| `Number(row.amount) * 100` | `toSatang(row.amount)` |
| เก็บรายจ่ายเป็นเลขติดลบ | เลขบวก + `type: 'expense'` |
| `.from('transactions').select('*')` | `.select('*').eq('user_id', userId).is('deleted_at', null)` |
| `.from('transactions').delete()` | `.update({ deleted_at: new Date().toISOString() })` |
| `req.body.userId` | `req.userId` จาก `liffAuth` |
| `const userId = req.query.uid` ใน LIFF API | ห้ามเด็ดขาด |
| Gemini ตอบ "เดือนนี้ใช้ไป 4,520 บาท" แล้วส่งให้ผู้ใช้ | Gemini เรียก `get_summary` → S5 คำนวณ → summaryCard |
| Gemini ส่ง `amount: 80` จาก "หาร 4 คน 320" | `amount: 320, split_count: 4` → `splitEvenly()` |
| Gemini ส่ง `date: "2026-09-10"` | `date_text: "เมื่อวาน"` → `thaiDate` |
| เรียก `delete_transaction` แล้วลบทันที | สร้าง pending → ผู้ใช้กด ✅ |
| ส่งผลของ `query_transactions` กลับให้ Gemini สรุป | โค้ดสร้าง Flex จากผลลัพธ์เอง |
| ส่ง history ทั้งหมดให้ Gemini | 3 turn ล่าสุด + redact |
| `import { GoogleGenAI } from '@google/genai'` ใน handler | เรียกผ่าน `services/ai/` เท่านั้น |
| `new Date().getDate()` เพื่อหาวันนี้ | `dayjs().tz('Asia/Bangkok')` |
| `sum` ใน SQL โดยไม่แปลงเวลา | `(occurred_at at time zone 'Asia/Bangkok')::date` |
| cron.yml `0 21 * * *` สำหรับ 3 ทุ่มไทย | `0 14 * * *` (UTC) |
| `z.coerce.boolean()` กับค่า env | `z.enum(['true','false']).transform(v => v === 'true')` |
| `app.use(express.json())` บนสุดของแอป | ใส่เฉพาะ router `/api` และ `/jobs` |
| Gemini ช้าแล้วเปลี่ยนไป push | loading animation + reply token เดิม |
| ส่งสรุปรายวันให้ผู้ใช้ทุกคน | เฉพาะคนที่เปิด + ผ่าน quota + dedup_key |
| ใส่ข้อมูลทั้งก้อนใน postback data | `action=confirm_action&id=<uuid>` |
| เก็บ ID token ใน localStorage | เก็บในตัวแปร เรียก `liff.getIDToken()` ใหม่ได้ |
| `catch (e) {}` | `logger.error(...)` แล้วตอบ errorCard |
| นับ `avgEssential` รวมรายการจาก recurring | ตัด `source='recurring'` เพราะอยู่ใน `recurringTotal` แล้ว |
| เก็บยอดสะสมของแผนแล้วบวกทีละครั้ง | คำนวณสดจาก transfer ที่มี `plan_id` |

---

## 15. อภิธานศัพท์

| คำ | ความหมาย |
|---|---|
| ทางด่วน | บันทึกผ่าน L1-L3 ไม่ใช้ AI บันทึกทันทีพร้อมปุ่ม ↩️ ยกเลิก |
| L1-L4 | ชั้นของตัวแปลงข้อความ: regex / พจนานุกรมกลาง / พจนานุกรมส่วนตัว / Gemini |
| Pending action | คำขอเขียนข้อมูลจาก AI หรือสลิปที่รอผู้ใช้กด ✅ |
| จองแถวแบบ atomic | update ที่มีเงื่อนไขสถานะในคำสั่งเดียว ทำให้กดซ้ำไม่เกิดผลซ้ำ |
| Guard | ด่านตรวจก่อนเรียก AI (เปิดอยู่ไหม / เกินโควตาไหม / redact / timeout / log) |
| Tool (Function Calling) | ฟังก์ชันที่ Gemini เลือกเรียกได้ Gemini ส่งแค่ชื่อ + args โค้ดเป็นคนทำงานจริง |
| read / write tool | tool ที่แค่อ่านข้อมูล / tool ที่จะเปลี่ยนข้อมูล (ต้องผ่าน pending) |
| Safe-to-spend | เงินที่ใช้ได้ต่อวันถึงสิ้นเดือน (SPEC §S5.2) |
| disposable / capacity | เงินที่ย้ายไปออมได้ต่อเดือน / ส่วนที่ยังว่างหลังหักแผนเดิม (SPEC §S5.3) |
| Cold-start | ผู้ใช้ใหม่ข้อมูลน้อย ใช้วิธีคำนวณแบบระมัดระวังพร้อมป้าย 🔴🟡🟢 |
| สตางค์ | หน่วยเงินในโค้ด 1 บาท = 100 สตางค์ เป็นจำนวนเต็มเสมอ |
| Soft delete | ลบด้วยการตั้ง `deleted_at` กู้คืนได้ |
| Idempotent | ทำซ้ำกี่ครั้งผลเหมือนทำครั้งเดียว |
| Redact | ปิดข้อมูลส่วนตัวให้เหลือ 4 ตัวท้าย เช่น `***1234` |
| Reply / Push | ข้อความตอบกลับที่ใช้ reply token (ฟรี) / ข้อความส่งเอง (มีโควตา) |
| RLS | Row Level Security ของ Postgres — เราเปิดไว้กัน anon key แต่ service role ข้ามได้ |
| dedup_key | คีย์ไม่ซ้ำของ push แต่ละครั้ง กันส่งซ้ำ |

---

## 16. ปรัชญา

> **กฎมาก่อน AI มาทีหลัง — และ AI ไม่เคยแตะตัวเลข**

แอปนี้บอกผู้ใช้ว่า "วันนี้ใช้ได้อีก ฿320" และ "ออมเดือนละ ฿2,500 จะได้ไอแพดในเดือนมีนาคม"
ผู้ใช้จะเชื่อตัวเลขนี้ก็ต่อเมื่อมัน **ถูกต้องและเหมือนเดิมทุกครั้ง** ความน่าเชื่อถือมาจากความคาดเดาได้ ไม่ใช่ความฉลาด

ทุกการตัดสินใจตอบคำถามนี้:

> *"ถ้าส่วนนี้ทำงานผิดพลาด ผู้ใช้จะเสียเงิน เสียความเชื่อใจ หรือเสียข้อมูล — แบบที่ไม่มีใครรู้ตัวไหม?"*

ถ้าใช่ ต้องเป็นโค้ดที่คาดเดาได้ ทดสอบได้ และตรวจย้อนหลังได้

AI อยู่ที่ขอบของระบบ — รับภาษาคนที่ยุ่งเหยิงและสลิปหลากหลายรูปแบบ แล้วแปลงเป็นคำขอที่ผู้ใช้ตรวจได้
ถ้าวันหนึ่ง Gemini หายไป แอปนี้ต้องยังจดเงิน สรุปยอด และบอกได้ว่าวันนี้ใช้ได้อีกเท่าไหร่
เกณฑ์ความสำเร็จข้อ 2 ใน `SPEC.md` มีไว้พิสูจน์เรื่องนี้

และเพราะทีมนี้กำลังเรียนรู้ โค้ดที่ดีที่สุดคือโค้ดที่เพื่อนร่วมทีมอ่านแล้วเข้าใจ แก้ได้เอง และรู้ว่าทำไมมันถึงเขียนแบบนั้น

---

*เวอร์ชันเอกสาร: 3.0 — 2026-09-11*
*คู่กับ: `SPEC.md` v3.0*
*ถ้า `SPEC.md` เปลี่ยน ให้ตรวจการอ้างอิงในไฟล์นี้ให้ตรงกันเสมอ*
