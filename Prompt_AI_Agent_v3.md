# TASK: สร้าง Scaffold โปรเจกต์ LINE Chatbot บันทึกรายรับ-รายจ่าย (v3)

คุณคือ Senior Node.js Developer ช่วยสร้างโครงสร้างโปรเจกต์ให้ทีมนักศึกษา
ที่ยังไม่มีประสบการณ์เขียนโค้ดมาก่อน

> **v3 = ฟังก์ชันหลักทั้งหมดจาก Prompt AI เดิม + กฎความปลอดภัยทางการเงินจาก Cashcast V2**
> stack, ทีม ①-⑤, แผน 4 สัปดาห์, 8 tools ของ Gemini, ระบบแผนออม — ยังเหมือนเดิมทุกอย่าง
> จุดที่เพิ่มหรือเปลี่ยนมีเครื่องหมาย 🆕
>
> 📚 เอกสารคู่กัน: `SPEC.md` (ข้อกำหนดทั้งหมด — ถ้าขัดกับไฟล์นี้ **ให้ยึด SPEC.md**) และ `AIDO.md` (กฎการทำงานของ AI Agent) ให้วางทั้งสองไฟล์ไว้ที่ root ของโปรเจกต์

---

## 🆕 มีอะไรเปลี่ยนจากเวอร์ชันเดิม (อ่าน 1 นาที)

| เรื่อง | Prompt AI เดิม | v3 | ได้แนวคิดมาจาก |
|---|---|---|---|
| AI เขียนข้อมูล | Gemini สั่งสร้าง/แก้/ลบได้ทันที | กลายเป็น "คำขอรอยืนยัน" ผู้ใช้กด ✅ ก่อนค่อยบันทึก | V2 (A3) |
| ใครคิดเลข | ไม่ได้ระบุ | AI แค่ดึงตัวเลขที่ผู้ใช้พิมพ์ การบวก ลบ หาร สรุป วางแผน ทำในโค้ดทั้งหมด | V2 (A1) |
| ชนิดข้อมูลเงิน | ไม่ได้ระบุ | DB ใช้ `numeric(12,2)` ในโค้ดคำนวณเป็น "สตางค์" (จำนวนเต็ม) | V2 (M1) |
| ตัวแปลงข้อความ | Regex → Gemini | Regex → พจนานุกรมกลาง → พจนานุกรมส่วนตัว → Gemini | V2 (S4) |
| เรียนรู้จากผู้ใช้ | ไม่มี | ผู้ใช้แก้หมวด / ยืนยันผล AI → จำคำนั้นไว้ ครั้งหน้าไม่ต้องใช้ AI | V2 (S4) |
| คุม AI | retry 1 ครั้ง | + สวิตช์เปิด/ปิด, จำกัดครั้งต่อวัน, timeout, ตรวจ args ด้วย Zod, log ทุกครั้ง | V2 (Guard Layer) |
| ข้อมูลส่วนตัว | ไม่ได้ระบุ | ปิดเลขบัญชี/เบอร์/บัตร ก่อนส่ง AI และก่อนเขียน log | V2 (A6) |
| ถ้า AI ล่ม | ไม่ได้ระบุ | คำสั่งพื้นฐานยังใช้ได้ครบ (`กาแฟ 80`, สรุป, เหลือ, ยกเลิก) | V2 (A4) |
| กันรายการซ้ำ | เฉพาะในอีเมล | ข้ามช่องทาง แชท / สลิป / อีเมล | V2 (S10) |
| การลบ | ไม่ได้ระบุ | soft delete (`deleted_at`) ทำให้ปุ่ม ↩️ ยกเลิก ทำงานได้จริง | V2 (D3) |
| ใช้ได้วันละเท่าไหร่ | ไม่มี | มี สูตรตายตัว ผูกกับแผนออมที่ active | V2 (Level 1.5) |
| ผู้ใช้ใหม่ข้อมูลน้อย | ไม่ได้ระบุ | cold-start policy + ป้ายความมั่นใจ 🔴🟡🟢 | V2 (S5) |
| Database | ไม่มีไฟล์ schema | มี migration SQL ครบ + เปิด RLS ทุกตาราง | V2 (S6) |
| Test | ไม่มี | vitest เฉพาะส่วนที่คำนวณเงิน/แปลงข้อความ | V2 (§9) |
| Cron | node-cron + GitHub Actions | ทุกงาน idempotent (รันซ้ำไม่พัง) + `CRON_SECRET` + ระวัง UTC | V2 (S7) |

### สิ่งที่ตั้งใจ "ไม่เอา" มาจาก V2 (เพราะเกินเวลา 4 สัปดาห์ของทีมมือใหม่)

Next.js / Prisma / Tailwind / Recharts, เว็บแอปแยกพร้อม LINE Login OAuth, Cloudflare Email Worker,
Python Monte Carlo, Forecast Level 2-3, Sentry, ตาราง `ai_cache` แยก
(ใช้ "พจนานุกรมส่วนตัว" ทำหน้าที่เป็น cache แทน ง่ายกว่าและได้ผลคล้ายกัน)

---

## ⚠️ กฎการสร้าง Scaffold — อ่านก่อนเริ่ม

1. **สร้างแค่โครงสร้างไฟล์ + comment อธิบาย** ยังไม่ต้องเขียน business logic
2. ทุกไฟล์ต้องมี **comment หัวไฟล์ภาษาไทย** บอกว่า:
   - ไฟล์นี้ทำหน้าที่อะไร
   - ใครรับผิดชอบ (①-⑤)
   - เขียนในสัปดาห์ไหน (W1-W4)
   - มี TODO list ว่าต้องทำอะไรบ้าง
   - 🆕 กฎเหล็กข้อไหนที่ไฟล์นี้ต้องระวัง (เช่น `// ⚖️ กฎเหล็ก G1, G6`)
3. ไฟล์ที่ยังไม่ถึงเวลาเขียน (W3-W4) ให้สร้างเป็นไฟล์ว่างที่มีแค่ comment + `export {}`
4. **ห้ามใส่ค่า API key จริงใด ๆ** ทั้งสิ้น
5. โค้ดทั้งหมดใช้ **TypeScript** (ยกเว้นโฟลเดอร์ `liff/` ที่เป็น Vanilla JS)
6. comment เป็นภาษาไทย เพื่อให้ทีมมือใหม่อ่านเข้าใจ
7. 🆕 **ข้อยกเว้นที่ให้เขียนเนื้อหาจริงได้เลย** (เพราะเป็นฐาน ไม่ใช่ business logic):
   `supabase/migrations/001_init.sql`, `src/config/constants.ts`, `src/config/keywords.ts`,
   `.env.example`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/fixtures/messages.json`, `docs/RULES.md`

---

## 🆕 ⚖️ กฎเหล็ก 7 ข้อของแอปการเงิน

ทุกคนในทีมต้องจำ 7 ข้อนี้ ไฟล์ที่เกี่ยวข้องต้องมี comment อ้างถึงข้อนั้น ๆ

| ข้อ | กฎ | ทำไม |
|---|---|---|
| **G1** | **AI ไม่คิดเลขเงิน** — Gemini ทำได้แค่ ① ดึงตัวเลขที่ผู้ใช้พิมพ์หรืออยู่ในสลิป ② เลือก tool + ใส่ args เท่านั้น การบวก ลบ หาร สรุป วางแผน ต้องทำใน `services/` ตัวเลขที่ผู้ใช้เห็นต้องมาจาก Flex ที่โค้ดสร้าง | AI คำนวณผิดได้โดยไม่มีใครรู้ ถามคำถามเดิมสองครั้งอาจได้ตัวเลขไม่เท่ากัน |
| **G2** | **AI จะแตะข้อมูลต้องมีคนกดยืนยัน** — tool ที่ "เขียน" ทุกตัว → สร้าง `pending_actions` → ส่ง Flex ให้ยืนยัน → กด ✅ แล้วค่อยบันทึก (ข้อยกเว้น: ทางด่วน regex เช่น `กาแฟ 80` บันทึกทันที แต่ต้องมีปุ่ม ↩️ ยกเลิก / ✏️ แก้หมวด) | กัน AI เข้าใจผิดแล้วลบ/แก้ข้อมูลจริงของผู้ใช้ |
| **G3** | **เงินเป็นเลขบวกเสมอ + ห้ามใช้ทศนิยมลอยตัว** — ทิศทางดูจาก `type` / DB ใช้ `numeric(12,2)` / ในโค้ดคำนวณเป็นสตางค์ (จำนวนเต็ม) ผ่าน `utils/money.ts` เท่านั้น | ใน JS `0.1 + 0.2 = 0.30000000000000004` บวกไปเรื่อย ๆ ยอดจะเพี้ยน |
| **G4** | **ปิด AI แล้วแอปต้องยังใช้ได้** — `AI_ENABLED=false` → regex + พจนานุกรม + คำสั่งตายตัว ยังทำงานครบ | Gemini ล่ม/โควตาหมด = แค่ไม่สะดวก ไม่ใช่ใช้งานไม่ได้ |
| **G5** | **ส่งข้อมูลให้ AI เท่าที่จำเป็น** — ข้อความล่าสุด + ย้อนหลังไม่เกิน 3 turn / ห้ามส่งรายการธุรกรรมดิบ / ปิดเลขบัญชี เบอร์โทร เลขบัตร เลขบัตรประชาชน ก่อนส่ง | ความเป็นส่วนตัว + ประหยัดโควตา |
| **G6** | **ทุก query ต้องกรอง `user_id`** — backend ใช้ `SERVICE_ROLE_KEY` ซึ่ง **ข้าม RLS ได้ทั้งหมด** ลืม `.eq('user_id', userId)` = เห็นข้อมูลคนอื่น / `user_id` ต้องมาจากลายเซ็น LINE หรือ ID token เท่านั้น ห้ามเชื่อค่าที่ client ส่งมา | ข้อมูลการเงินรั่วข้ามผู้ใช้ = ร้ายแรงที่สุด |
| **G7** | **`type='transfer'` ไม่นับเป็นรายรับหรือรายจ่าย** ในทุกการคำนวณ (สรุป, งบ, แผนออม, ใช้ได้วันละเท่าไหร่) | โอนเงินเข้าบัญชีออมของตัวเองไม่ใช่การใช้เงิน |

---

## 📋 ข้อมูลโปรเจกต์

| หัวข้อ | รายละเอียด |
|---|---|
| ชื่อ | JOD tang |
| คืออะไร | LINE Chatbot บันทึกรายรับ-รายจ่าย + AI วางแผนการเงิน |
| Backend | Node.js + TypeScript + Express |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini (Function Calling + Vision) — 🆕 เปิด/ปิดได้ด้วย `AI_ENABLED` |
| Chat | LINE Messaging API |
| Frontend | LIFF (Vanilla HTML/CSS/JS + Chart.js) |
| Hosting | Render (backend) + Vercel (LIFF) |
| Timezone | Asia/Bangkok (สำคัญมาก) |
| สกุลเงิน | บาท (THB) เท่านั้น |
| 🆕 หน่วยเงินในโค้ด | สตางค์ (integer) — ตัวแปรชื่อลงท้าย `Satang` เสมอ เช่น `amountSatang` |

> 🆕 ก่อนให้ผู้ใช้จริงส่งสลิป ให้ทีมอ่านเงื่อนไขของ Gemini API (โดยเฉพาะ free tier) เรื่องการนำข้อมูลที่ส่งเข้าไปใช้ปรับปรุงบริการ แล้วเขียนแจ้งผู้ใช้ในข้อความต้อนรับให้ตรงกับความจริง

## 👥 ทีม 5 คน (ใช้สัญลักษณ์นี้ใน comment)

- ① Bot Core — LINE OA, webhook, deploy, security, 🆕 redact, jobs route
- ② Database — schema, query, recurring, budget, 🆕 money utils, pending actions
- ③ AI — Gemini, function calling, prompt, planner, 🆕 guard, พจนานุกรม
- ④ Frontend — Flex Message, Rich Menu, LIFF
- ⑤ Integration — OCR, email, testing, docs, 🆕 กันรายการซ้ำ

---

## 🆕 ภาพรวม: ข้อความ 1 ข้อความเดินทางอย่างไร

```
ผู้ใช้พิมพ์ใน LINE
   ↓
[routes/webhook]  ตรวจลายเซ็น → ตอบ 200 ทันที → กันซ้ำด้วย webhookEventId
   ↓
[handlers/textHandler]  เป็นคำสั่งตายตัวไหม? (สรุป / เหลือ / แผน / ออม / ยกเลิก / ช่วยเหลือ)
   ├─ ใช่ → service คำนวณ → Flex                                  ← ไม่ใช้ AI เลย
   ↓ ไม่ใช่
[services/ai/router]  ตัวแปลง 4 ชั้น (ถูกไปแพง)
   L1 regexParser         "กาแฟ 80", "ข้าว60", "+เงินเดือน 35000"
   L2 พจนานุกรมกลาง       "กาแฟ" → อาหาร
   L3 พจนานุกรมส่วนตัว     ผู้ใช้คนนี้เคยแก้ "ชาไข่มุก" → อาหาร
   ├─ มั่นใจ → บันทึกทันที → confirmCard (↩️ ยกเลิก / ✏️ แก้หมวด)   ← ทางด่วน ~85%
   ↓ ไม่มั่นใจ / ไม่มีตัวเลข / เป็นคำถาม
   L4 Gemini (ผ่าน guard: เปิดอยู่ไหม? เกินโควตาไหม? ปิดข้อมูลส่วนตัวแล้วหรือยัง?)
   ↓
   Gemini ตอบกลับเป็น "เลือก tool + args" (หรือคำถามถามกลับ)
   ↓
[ตรวจ args ด้วย Zod + sanity check]  ไม่ผ่าน → ถามผู้ใช้กลับ ไม่เดา
   ├─ tool อ่านอย่างเดียว (get_summary, query_transactions, simulate)
   │     → service คำนวณ → Flex ที่โค้ดสร้าง
   └─ tool เขียนข้อมูล (create, batch, update, delete, recurring)
         → pending_actions → pendingCard "ยืนยันไหม?"
         → ผู้ใช้กด ✅ → service บันทึกจริง
         → จำคำใหม่เข้า L3 (ครั้งหน้าข้อความแบบนี้ไม่ต้องใช้ AI)
```

**กติกาประหยัด:** 1 ข้อความ = เรียก Gemini ไม่เกิน 1 ครั้ง (+ retry 1)
ผลลัพธ์ของ tool **ไม่ส่งกลับไปให้ Gemini แต่งประโยค** โค้ดสร้าง Flex เองเลย (ได้ทั้ง G1, G5 และประหยัดโควตาครึ่งหนึ่ง)

**ระหว่างรอ Gemini:** เรียก loading animation ของ LINE (ฟรี) แล้วตอบด้วย reply token เดิม **ห้ามเปลี่ยนไปใช้ push** เพราะ push มีโควตา

---

## 🗂️ โครงสร้างที่ต้องสร้าง

```
money-bot/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts                🆕
├── README.md
│
├── supabase/
│   └── migrations/
│       └── 001_init.sql            🆕 schema ทั้งหมด
│
├── src/
│   ├── index.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── constants.ts
│   │   └── keywords.ts             🆕 พจนานุกรมกลาง (L2)
│   │
│   ├── middleware/
│   │   └── liffAuth.ts             🆕 ตรวจ LIFF ID token
│   │
│   ├── routes/
│   │   ├── webhook.ts
│   │   ├── health.ts
│   │   ├── api.ts
│   │   └── jobs.ts                 🆕 ให้ GitHub Actions เรียกงาน cron
│   │
│   ├── handlers/
│   │   ├── textHandler.ts
│   │   ├── imageHandler.ts
│   │   ├── postbackHandler.ts
│   │   └── followHandler.ts
│   │
│   ├── services/
│   │   ├── ai/
│   │   │   ├── router.ts
│   │   │   ├── gemini.ts
│   │   │   ├── tools.ts
│   │   │   ├── prompt.ts
│   │   │   ├── vision.ts
│   │   │   └── guard.ts            🆕 ด่านตรวจก่อนเรียก AI ทุกครั้ง
│   │   ├── transaction.service.ts
│   │   ├── summary.service.ts
│   │   ├── recurring.service.ts
│   │   ├── budget.service.ts
│   │   ├── plan.service.ts
│   │   ├── email.service.ts
│   │   ├── quota.service.ts
│   │   ├── pending.service.ts      🆕 คำขอรอยืนยัน
│   │   ├── keyword.service.ts      🆕 พจนานุกรมส่วนตัว (L3) + เรียนรู้
│   │   └── dedup.service.ts        🆕 กันรายการซ้ำข้ามช่องทาง
│   │
│   ├── db/
│   │   ├── supabase.ts
│   │   └── queries/
│   │       ├── transactions.ts
│   │       ├── summary.ts
│   │       ├── categories.ts
│   │       ├── plans.ts
│   │       ├── pending.ts          🆕
│   │       ├── keywords.ts         🆕
│   │       └── logs.ts             🆕 webhook_events, push_log, ai_usage_log
│   │
│   ├── line/
│   │   ├── client.ts
│   │   ├── reply.ts
│   │   ├── push.ts
│   │   ├── richmenu.ts
│   │   └── flex/
│   │       ├── confirmCard.ts
│   │       ├── pendingCard.ts      🆕 การ์ด "AI เข้าใจแบบนี้ ยืนยันไหม?"
│   │       ├── summaryCard.ts
│   │       ├── planCard.ts
│   │       └── errorCard.ts
│   │
│   ├── utils/
│   │   ├── thaiDate.ts
│   │   ├── thaiNumber.ts
│   │   ├── regexParser.ts
│   │   ├── logger.ts
│   │   ├── money.ts                🆕 สตางค์ ↔ บาท
│   │   └── redact.ts               🆕 ปิดข้อมูลส่วนตัว
│   │
│   ├── jobs/
│   │   ├── index.ts
│   │   ├── recurringJob.ts
│   │   ├── dailySummary.ts
│   │   ├── planCheck.ts
│   │   ├── emailPoll.ts
│   │   └── cleanup.ts              🆕 ล้างคำขอหมดอายุ / log เก่า
│   │
│   └── types/
│       └── index.ts
│
├── tests/                          🆕
│   ├── fixtures/
│   │   └── messages.json           ข้อความตัวอย่าง 30 ข้อ + ผลที่คาดหวัง
│   ├── regexParser.test.ts
│   ├── thaiNumber.test.ts
│   ├── thaiDate.test.ts
│   ├── money.test.ts
│   ├── redact.test.ts
│   ├── plan.service.test.ts
│   └── summary.service.test.ts
│
├── liff/
│   ├── index.html
│   ├── analyze.html
│   ├── categories.html
│   ├── transactions.html
│   ├── settings.html
│   ├── css/style.css
│   └── js/
│       ├── liff-init.js
│       ├── api.js
│       └── charts.js
│
├── docs/
│   ├── SRS.md
│   ├── SETUP.md
│   └── RULES.md                    🆕 กฎเหล็ก 7 ข้อ + ตัวอย่างผิด/ถูก
│
└── .github/workflows/
    ├── ping.yml
    └── cron.yml
```

---

## 📄 รายละเอียดแต่ละไฟล์

### Root files

**package.json** — ใส่ scripts เหล่านี้
- `dev` = รันด้วย tsx watch (โหมดพัฒนา)
- `build` = tsc
- `start` = node dist/index.js
- `tunnel` = คำสั่งเปิด ngrok (ใส่ comment ว่าให้แก้ static domain เอง)
- 🆕 `test` = vitest run
- 🆕 `typecheck` = tsc --noEmit

dependencies: express, @line/bot-sdk, @supabase/supabase-js, @google/genai, dotenv, dayjs, node-cron, zod
devDependencies: typescript, tsx, @types/node, @types/express, 🆕 vitest
🆕 comment ใน README: ถ้า node-cron เวอร์ชันที่ติดตั้งยังไม่มี type ในตัว ให้เพิ่ม `@types/node-cron`
🆕 ไลบรารีอ่านอีเมล (เช่น imapflow + mailparser) **ยังไม่ต้องติดตั้ง** ให้ ⑤ ติดตั้งตอน W4

**tsconfig.json** — target ES2022, module commonjs, outDir ./dist, rootDir ./src, strict true, esModuleInterop true, skipLibCheck true, resolveJsonModule true

**🆕 vitest.config.ts** — environment node, include `tests/**/*.test.ts`

**.gitignore** — node_modules/, .env, .env.local, dist/, *.log, .DS_Store

**.env.example** — ใส่ key ทั้งหมดแบบเว้นค่าว่าง พร้อม comment ภาษาไทยว่าเอามาจากไหน:
PORT, NODE_ENV, TZ, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET,
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL,
AI_PROVIDER, LIFF_ID, PUSH_LIMIT, GMAIL_USER, GMAIL_APP_PASSWORD
🆕 เพิ่ม:
- `LINE_LOGIN_CHANNEL_ID` — ID ของ LINE Login channel ที่ LIFF อยู่ (ใช้ตรวจ ID token)
- `AI_ENABLED=true` — ใส่ `false` เพื่อทดสอบว่าแอปยังทำงานได้โดยไม่มี AI (G4)
- `AI_DAILY_LIMIT_PER_USER=30` — เรียก Gemini ได้กี่ครั้งต่อคนต่อวัน
- `AI_DAILY_LIMIT_GLOBAL=` — เพดานรวมทั้งระบบต่อวัน ตั้งให้ต่ำกว่าโควตาของโมเดลที่ใช้ (ดูใน Google AI Studio)
- `AI_TIMEOUT_MS=8000`
- `CRON_SECRET=` — สุ่มยาว ๆ ใช้ยืนยันว่าคนเรียก /jobs คือ GitHub Actions ของเราจริง

**README.md** — วิธีติดตั้ง, วิธีรัน, โครงสร้างโฟลเดอร์, ใครดูแลส่วนไหน, 🆕 ลิงก์ไป `docs/RULES.md` ไว้บนสุด

---

### 🆕 supabase/migrations/001_init.sql — [② / W1] ⚖️ G3, G6

เขียนเต็ม (ข้อยกเว้นข้อ 7) ใส่ comment ภาษาไทยทุกตาราง ใช้ตามนี้:

```sql
-- กติกา: เงิน numeric(12,2) เท่านั้น / เวลา timestamptz เท่านั้น / จำนวนเงินต้อง > 0 เสมอ

create table users (
  id                    uuid primary key default gen_random_uuid(),
  line_user_id          text unique not null,
  display_name          text,
  is_active             boolean not null default true,   -- unfollow = false (ห้ามลบข้อมูล)
  ai_enabled            boolean not null default true,   -- ผู้ใช้ปิด AI เองได้ใน settings
  daily_summary_enabled boolean not null default false,  -- opt-in เพราะ push มีโควตา
  email_ingest_token    text unique,                     -- สุ่ม ≥ 16 bytes ห้ามสร้างจาก user_id
  created_at            timestamptz not null default now()
);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('income','expense')),
  emoji      text,
  is_default boolean not null default false,
  is_essential boolean not null default false,          -- หมวดจำเป็น ใช้ในสูตร avgEssential ของ plan.service
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

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
-- กฎ "active ไม่เกิน 3 แผน" ตรวจใน plan.service (SQL นับข้ามแถวด้วย constraint ธรรมดาไม่ได้)

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
  ref_number         text,                               -- เลขอ้างอิงจากสลิป/อีเมล
  plan_id            uuid references plans(id),          -- โอนเข้าแผนออม (type='transfer')
  recurring_rule_id  uuid references recurring_rules(id),
  recurring_run_date date,                               -- วันที่ของรอบ recurring
  deleted_at         timestamptz,                        -- soft delete → ↩️ ยกเลิกได้
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (recurring_rule_id, recurring_run_date),       -- กัน recurring job สร้างซ้ำ
  check (type = 'transfer' or plan_id is null)          -- plan_id ใช้ได้เฉพาะ transfer
);
create unique index uq_tx_ref on transactions (user_id, ref_number)
  where ref_number is not null and deleted_at is null;  -- สลิป/อีเมลเดียวกันเข้าได้ครั้งเดียว
create index idx_tx_user_date on transactions (user_id, occurred_at desc)
  where deleted_at is null;

create table budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  month        date not null,                           -- วันที่ 1 ของเดือน
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  alerted_80   boolean not null default false,           -- เตือนครั้งเดียวต่อเดือน
  alerted_100  boolean not null default false,
  unique (user_id, category_id, month)
);

create table user_keyword_map (                          -- พจนานุกรมส่วนตัว (L3)
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  keyword     text not null,
  category_id uuid not null references categories(id) on delete cascade,
  hit_count   integer not null default 1,
  updated_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

create table pending_actions (                           -- คำขอรอยืนยัน (G2)
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  action     text not null check (action in (
               'create_transaction','create_transaction_batch','update_transaction',
               'delete_transaction','create_recurring')),
  payload    jsonb not null,                             -- args ที่ผ่าน Zod แล้ว
  source     text not null check (source in ('chat','image')),
  status     text not null default 'waiting'
               check (status in ('waiting','confirmed','cancelled','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_pending_user on pending_actions (user_id, status);

create table user_emails (                               -- อีเมลธนาคารที่ดึงเข้ามา
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  message_id             text not null,                  -- Message-ID ของอีเมล
  body_redacted          text not null,                  -- ปิดเลขบัญชีแล้ว เก็บไว้ parse ใหม่ได้
  parsed                 boolean not null default false,
  matched_transaction_id uuid references transactions(id),
  received_at            timestamptz not null,
  unique (user_id, message_id)
);

create table webhook_events (id text primary key, received_at timestamptz not null default now());

create table push_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references users(id) on delete set null,
  kind      text not null,
  dedup_key text unique not null,                        -- เช่น daily:2026-09-11:<user_id>
  sent_at   timestamptz not null default now()
);
create index idx_push_time on push_log (sent_at desc);

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

-- เปิด RLS ทุกตาราง แต่ "ไม่สร้าง policy" → anon key เข้าไม่ได้เลย
-- backend ใช้ service role (ข้าม RLS) → ต้องกรอง user_id เองทุก query (G6)
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
```

---

### src/index.ts — [① / W1]
จุดเริ่มต้นแอป: โหลด dotenv → ตั้ง TZ → สร้าง Express app →
mount routes (/webhook, /health, /api, 🆕 /jobs) → start cron jobs → listen PORT
ใส่ TODO comment เป็นขั้นตอน
🆕 comment เตือน: **ห้าม** `app.use(express.json())` แบบครอบทั้งแอป เพราะ middleware ของ LINE ต้องใช้ body ดิบในการตรวจลายเซ็น ให้ใส่ `express.json()` เฉพาะ router `/api` และ `/jobs`

### src/config/env.ts — [① / W1]
อ่านค่าจาก process.env และ validate ด้วย zod
ถ้าขาดตัวแปรสำคัญให้ throw error ทันทีตอนเปิดแอป
export เป็น object `env` ที่ type-safe
🆕 comment เตือนกับดัก: `z.coerce.boolean()` แปลงสตริง `"false"` เป็น `true` ให้ใช้
`z.enum(['true','false']).transform(v => v === 'true')` แทน

### src/config/constants.ts — [② / W1]
- DEFAULT_CATEGORIES: หมวดรายจ่าย 8 หมวด (อาหาร, เดินทาง, ช้อปปิ้ง, ที่พัก/บิล, บันเทิง, สุขภาพ, การศึกษา, อื่นๆ) + รายรับ 3 หมวด (เงินเดือน, รายได้เสริม, เงินคืน/รับโอน) พร้อม emoji
  🆕 + flag `isEssential` (จำเป็น = อาหาร, เดินทาง, ที่พัก/บิล, สุขภาพ, การศึกษา) ใช้ในสูตรแผนออม ดู SPEC §S5.3
- PUSH_LIMIT = 280
- MAX_ACTIVE_PLANS = 3
- PLAN_SAFETY_RATIO = 0.8
- EMERGENCY_BUFFER = 0.15
- TIMEZONE = 'Asia/Bangkok'
- 🆕 MAX_AMOUNT_SATANG = 1_000_000_000 (10 ล้านบาท — sanity check)
- 🆕 PENDING_EXPIRE_HOURS = 24
- 🆕 DEDUP_WINDOW_MINUTES = 30
- 🆕 CHAT_HISTORY_TURNS = 3
- 🆕 COLD_START: `{ LOW_UNDER_DAYS: 7, MEDIUM_UNDER_DAYS: 90 }` (ดู plan.service)
- 🆕 AI_DISCLAIMER = 'ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน'

### 🆕 src/config/keywords.ts — [③ / W1]
พจนานุกรมกลาง (L2) คำ → ชื่อหมวด เขียนจริงอย่างน้อย 8 คำต่อหมวด เช่น
อาหาร: กาแฟ, ข้าว, ก๋วยเตี๋ยว, ชานม, ขนม, 7-11 / เดินทาง: grab, bts, mrt, แท็กซี่, น้ำมัน, วิน /
ที่พัก/บิล: ค่าไฟ, ค่าน้ำ, ค่าเน็ต, ค่าหอ, ค่าโทรศัพท์ / รายรับ: เงินเดือน, โบนัส, ค่าจ้าง
comment: ตอนจับคู่ให้เรียงคำยาวก่อนคำสั้น (กัน "ค่าน้ำมัน" ไปตรงกับ "ค่าน้ำ")

---

### src/middleware/liffAuth.ts — 🆕 [① / W3] ⚖️ G6
TODO:
1. อ่าน header `Authorization: Bearer <idToken>`
2. ส่งไปตรวจที่ `POST https://api.line.me/oauth2/v2.1/verify` (id_token + client_id = LINE_LOGIN_CHANNEL_ID)
3. ได้ `sub` (= line_user_id) → หา `users.id` → ใส่ `req.userId`
4. ไม่ผ่าน → 401
comment: ห้ามอ่าน userId จาก body หรือ query string เด็ดขาด

### src/routes/webhook.ts — [① / W1] 🔴
รับ POST จาก LINE
TODO: validateSignature ด้วย x-line-signature (ใช้ middleware ของ @line/bot-sdk), ตอบ 200 ทันที,
เช็ค idempotency ด้วย webhookEventId (🆕 insert ลง `webhook_events` ถ้าชน primary key = เคยทำแล้ว ข้าม),
แยก event ไปแต่ละ handler (🆕 รวม `unfollow` ด้วย)

### src/routes/health.ts — [① / W1]
GET /health → ตอบ { ok: true, timestamp } ให้ GitHub Actions ping

### 🆕 src/routes/jobs.ts — [① / W2]
`POST /jobs/:name` ให้ `cron.yml` เรียก
TODO: เทียบ header `x-cron-secret` กับ `env.CRON_SECRET` (ใช้ `crypto.timingSafeEqual`) → ไม่ตรง 401 →
เรียกฟังก์ชันงานจาก `jobs/` → ตอบ 200
comment: งานทุกตัว idempotent จึงปลอดภัยแม้ node-cron กับ GitHub Actions เรียกซ้ำกัน

### src/routes/api.ts — [④ / W3] ⚖️ G6
REST API ให้ LIFF เรียก ใช้ `middleware/liffAuth.ts` ก่อนทุก request
endpoints: /overview, /transactions, /categories, /summary, /settings
🆕 comment: การเพิ่ม/แก้/ลบจาก LIFF คือผู้ใช้ทำเองกับมือ → บันทึกได้ทันทีไม่ต้องผ่าน pending
แต่ต้องผ่าน Zod, ลบ = soft delete, และทุก query กรอง `req.userId`

---

### src/handlers/ (ทั้ง 4 ไฟล์)
- **textHandler.ts** [③ / W1-W2] — รับข้อความ → 🆕 เช็คคำสั่งตายตัวก่อน (สรุป / เหลือ / แผน / ออม / ยกเลิก / ช่วยเหลือ) → ถ้าไม่ใช่ส่งเข้า ai/router → เรียก service → ตอบ Flex
  🆕 ถ้า router จะเรียก Gemini ให้เรียก loading animation ก่อน (ดู line/reply.ts)
- **imageHandler.ts** [⑤ / W3] ⚖️ G2, G5 — ดึงรูปจาก LINE Content API → 🆕 ผ่าน guard → vision → Zod + sanity →
  🆕 ปิดเลขบัญชีในผลลัพธ์ → 🆕 เช็คซ้ำ (ref_number + dedup.service) → 🆕 สร้าง pending_action → ตอบ pendingCard
  🆕 comment: ไม่เก็บไฟล์รูปลง DB หรือดิสก์
- **postbackHandler.ts** [④ / W2] ⚖️ G2, G6 — parse postback data (URLSearchParams) → action:
  🆕 `confirm_action` / `cancel_action` (คำขอรอยืนยัน), `confirm_plan`, `delete_tx`, `edit_tx`, `undo`, 🆕 `restore`, 🆕 `edit_category` → `set_category` (แล้วสั่ง keyword.service จำคำ), 🆕 `save_to_plan` (เลือกแผนหลังพิมพ์ `ออม 2000`)
  🆕 comment: ต้องเช็คว่า pending/transaction นั้นเป็นของ user คนนี้ และกด ✅ ซ้ำสองครั้งต้องไม่บันทึกสองรอบ
- **followHandler.ts** [② / W1] — follow: สร้าง user ใหม่ + seed DEFAULT_CATEGORIES + ส่งข้อความต้อนรับ
  🆕 follow ซ้ำ (เคย block แล้วกลับมา): แค่ตั้ง `is_active=true` ห้าม seed หมวดซ้ำ
  🆕 ข้อความต้อนรับต้องบอกว่าใช้ AI อ่านข้อความ/สลิป และปิดได้ที่หน้าตั้งค่า
  🆕 unfollow: `is_active=false` เท่านั้น ห้ามลบข้อมูล

---

### src/services/ai/tools.ts — [③ / W2] 🔴 สำคัญที่สุด ⚖️ G1, G2
นิยาม Function Declaration ของ Gemini 8 ตัว (ใส่เป็น schema skeleton + comment)
🆕 ทุก tool ต้องมี 3 อย่างคู่กันในไฟล์นี้: **declaration** ที่ส่งให้ Gemini, **Zod schema** ไว้ตรวจ args, และ **kind** = `'read'` หรือ `'write'`

| # | tool | kind | 🆕 หมายเหตุเรื่อง args (G1) |
|---|---|---|---|
| 1 | create_transaction | write | `amount` = ตัวเลขที่ผู้ใช้พิมพ์ตรง ๆ, `date_text` = คำที่ผู้ใช้พูด เช่น "เมื่อวาน", `split_count` = หารกี่คน (โค้ดเป็นคนหาร), `plan_name` = ชื่อแผน (เมื่อ type='transfer') |
| 2 | create_transaction_batch | write | `items[]` เช่น "ค่าไฟ 890 ค่าน้ำ 210" → 2 รายการ |
| 3 | update_transaction | write | `target` = `'last'` หรือ id จาก Flex + field ที่จะแก้ |
| 4 | delete_transaction | write | `target` = `'last'` หรือ id จาก Flex |
| 5 | get_summary | read | `period` = today / yesterday / this_week / this_month / last_month |
| 6 | query_transactions | read | ตัวกรอง หมวด/ช่วงวัน/คำค้น, `limit ≤ 10` ผลลัพธ์ส่งเป็น Flex ตรง ไม่ส่งกลับให้ Gemini (G5) |
| 7 | create_recurring | write | label, amount, type, frequency, day |
| 8 | simulate_purchase_or_plan | read | `item_name`, `price` (ตามที่ผู้ใช้พิมพ์), `target_text` เช่น "ภายใน 6 เดือน" → plan.service คำนวณทั้งหมด |

ตัวอย่างใน comment: "หารค่าข้าว 4 คน จ่าย 320" → Gemini ส่ง `{ amount: 320, split_count: 4 }` → โค้ดหารได้ 80 บาท (Gemini ห้ามส่ง 80 มาเอง)

### src/services/ai/router.ts — [③ / W2]
Layered routing 🆕 4 ชั้น:
1. L1 `regexParser` → ได้ตัวเลข
2. L2 `config/keywords.ts` + L3 `keyword.service` → ได้หมวด
3. มีทั้งตัวเลขและหมวด → บันทึกทันที (ทางด่วน G2 ข้อยกเว้น)
4. มีตัวเลขแต่ไม่รู้หมวด → AI เปิดอยู่: ไป L4 / AI ปิด: บันทึกหมวด "อื่นๆ" + ปุ่ม ✏️ แก้หมวด
5. ไม่มีตัวเลข หรือเป็นคำถาม → L4 Gemini / AI ปิด: ตอบวิธีใช้ (G4)
ถ้า AI_PROVIDER=local → เรียก local LLM (เผื่ออนาคต)
comment: เป้าหมายคือ ~85% ของข้อความจบที่ L1-L3 และลดลงเรื่อย ๆ เมื่อพจนานุกรมส่วนตัวโตขึ้น

### src/services/ai/gemini.ts — [③ / W2] ⚖️ G5
เรียก Gemini API พร้อม tools + system prompt + chat history 🆕 **3 turn** (เก็บใน memory ด้วย Map หมดอายุ 30 นาที)
มี try-catch + retry 1 ครั้ง (🆕 เฉพาะ timeout / network / 5xx ไม่ retry เมื่อ 4xx) + fallback ถามผู้ใช้กลับ
🆕 ทุกการเรียกต้องผ่าน `guard.ts`
🆕 คืนค่าเป็น `{ kind: 'tool', name, args }` หรือ `{ kind: 'text', text }` เท่านั้น — ไม่ส่งผลของ tool กลับเข้า Gemini
🆕 ถ้าได้ `text` ที่มีตัวเลขเงินอยู่ ต้องเป็นตัวเลขที่ผู้ใช้พิมพ์มาเท่านั้น ไม่งั้นทิ้งแล้วใช้ข้อความ fallback (G1)

### src/services/ai/prompt.ts — [③ / W2] ⚖️ G1
System prompt ภาษาไทย: บทบาท, กฎการตีความ, วันที่ปัจจุบัน (เวลาไทย),
กฎว่าถ้าไม่มั่นใจให้ถามกลับห้ามเดา
🆕 เพิ่มกฎใน prompt:
- "ดึงเฉพาะตัวเลขที่ผู้ใช้พิมพ์ ห้ามคำนวณ ห้ามประมาณ ถ้าต้องหารให้ใส่ split_count"
- "วันที่ให้ส่งคำที่ผู้ใช้พูดมาใน date_text ไม่ต้องแปลงเอง"
- "คำถามเรื่องยอดเงิน ให้เรียก get_summary เสมอ ห้ามตอบตัวเลขเอง"
- "ห้ามให้คำแนะนำการลงทุน"
- "ตอบสั้น ภาษาไทยเป็นกันเอง"

### src/services/ai/vision.ts — [⑤ / W3] ⚖️ G1, G5
อ่านสลิป → คืน JSON: amount, datetime, receiver, bank, refNumber
🆕 prompt: "อ่านเฉพาะที่เห็นในรูป ห้ามเดา ไม่เห็นให้ใส่ null ไม่ต้องส่งเลขบัญชีกลับมา"
🆕 ผลลัพธ์ต้องผ่าน Zod + sanity: `0 < amount ≤ 10 ล้าน`, datetime ไม่อยู่ในอนาคต
🆕 ผ่านทุกด่านแล้วก็ยังเป็น pending เสมอ (G2)

### 🆕 src/services/ai/guard.ts — [③ / W2] ⚖️ G4, G5
ด่านตรวจก่อนเรียก AI ทุกครั้ง ตามลำดับ:
1. `env.AI_ENABLED` และ `users.ai_enabled` เปิดอยู่ไหม → ไม่ → คืน `{ ok: false, reason: 'disabled' }`
2. นับ `ai_usage_log` วันนี้ (ตามเวลาไทย) ของ user นี้ ≥ `AI_DAILY_LIMIT_PER_USER` → `'user_limit'`
3. นับรวมทั้งระบบวันนี้ ≥ `AI_DAILY_LIMIT_GLOBAL` → `'global_limit'`
4. ข้อความผ่าน `utils/redact.ts`
5. เรียกจริงพร้อม timeout `AI_TIMEOUT_MS`
6. เขียน `ai_usage_log` **ทุกครั้ง** ทั้งสำเร็จและล้มเหลว
comment: ถ้าได้ `ok: false` ผู้เรียกต้องมีทางไปต่อแบบไม่ใช้ AI เสมอ

---

### src/services/*.service.ts

🆕 กติการ่วมทุกไฟล์: ฟังก์ชันทุกตัวรับ `userId` เป็นพารามิเตอร์แรก (G6) และรับ/คืนเงินเป็นสตางค์ (G3)

- **transaction.service.ts** [② / W1] — create/update/delete/query
  🆕 delete = ตั้ง `deleted_at`, เพิ่ม `restore()` สำหรับปุ่ม ↩️ ยกเลิก, ตรวจ amount > 0 และ ≤ MAX, note ≤ 500 ตัวอักษร
- **summary.service.ts** [② / W2] 🔴 ⚖️ G7 — สรุปวัน/เดือน **ต้อง exclude type='transfer'** 🆕 และแถวที่ถูกลบแล้ว (`deleted_at` ไม่ว่าง)
  🆕 ให้ SQL เป็นคนบวก (`sum` บน numeric แม่นยำ) และแบ่งวันตามเวลาไทย (`occurred_at at time zone 'Asia/Bangkok'`)
  🆕 เพิ่ม `getDailySafeToSpend(userId)` — ใช้ได้วันละเท่าไหร่ (คำสั่ง `เหลือ` + dailySummary ใช้):
  ```
  คงเหลือเดือนนี้ = รายรับเดือนนี้ + recurring รายรับที่ยังไม่ถึงรอบ
                  − รายจ่ายเดือนนี้ − recurring รายจ่ายที่ยังไม่ถึงรอบ
                  − Σ monthly_save (แผน status='active')
  ใช้ได้ต่อวัน   = คงเหลือเดือนนี้ ÷ จำนวนวันที่เหลือในเดือน (นับวันนี้ด้วย)
  ติดลบ          → เตือนทันทีว่าเดือนนี้เกินแล้ว ไม่ต้องรอสิ้นเดือน
  ```
  comment: transfer ถูกตัดออกจากรายรับ/รายจ่าย จึงลบ monthly_save ครั้งเดียวได้โดยไม่นับซ้ำ (G7)
- **recurring.service.ts** [② / W2] — CRUD + คำนวณ next_run
  🆕 กับดัก: `day_of_month = 31` ในเดือนที่มี 30 วัน → ใช้วันสุดท้ายของเดือน
- **budget.service.ts** [② / W3] — เช็ค 80%/100% แจ้งเตือน
  🆕 เตือนครั้งเดียวต่อเดือนต่อหมวด (ใช้ `alerted_80` / `alerted_100`)
  🆕 ถ้ารายการที่ทำให้เกินงบมาจากแชท ให้แนบคำเตือนไปใน **reply** เดียวกันเลย (ฟรี) ไม่ต้อง push
- **plan.service.ts** [③ / W3] 🔴 หัวใจโปรเจกต์ ⚖️ G1, G3, G7 ใส่ comment สูตร:
  ```
  disposable = avgIncome3M - recurringTotal - avgEssential - (avgExpense * 0.15)
  กฎ: sum(monthly_save ทุกแผน) <= disposable * 0.8
  กฎ: แผน status='active' <= 3 แผน
  ```
  functions: simulateImpact, createSavingPlan (3 ทางเลือก), confirmPlan, trackPlan, replan
  🆕 ส่วนเสริมจาก V2:
  - คำนวณเป็นสตางค์ทั้งหมด ค่าเฉลี่ยทุกตัวไม่รวม transfer
  - 3 ทางเลือก เช่น เร็ว / สมดุล / สบาย — ทางเลือกไหนผิดกฎ 0.8 ให้ซ่อน ไม่ต้องแสดง
  - นิยามตัวแปรในสูตร (ช่วง 90 วัน, avgEssential ตัด source='recurring' ฯลฯ) และสัดส่วนของ 3 ทางเลือก ดู SPEC §S5.3–S5.4
  - **Cold-start policy** (ผู้ใช้ใหม่ข้อมูลน้อย — วิธีคำนวณละเอียดดู SPEC §S5.5):

    | ข้อมูลย้อนหลัง | วิธีคำนวณ | ป้าย |
    |---|---|---|
    | < 7 วัน | ใช้ recurring อย่างเดียว ถ้ายังไม่มีรายรับประจำ ให้ถามก่อนสร้างแผน | 🔴 ประมาณการเบื้องต้น |
    | 7–89 วัน | เฉลี่ยจากข้อมูลที่มี แล้วปรับเป็นต่อเดือน | 🟡 ความมั่นใจปานกลาง |
    | ≥ 90 วัน | สูตรเต็ม avg 3 เดือน | 🟢 ความมั่นใจสูง |

  - ความคืบหน้าของแผน = คำนวณใหม่ทุกครั้งจาก `sum(amount) where plan_id = X and type='transfer'` ห้ามเก็บยอดสะสมแล้วบวกเพิ่มทีละครั้ง
  - planCard ต้องมีป้ายความมั่นใจ + `AI_DISCLAIMER`
- **email.service.ts** [⑤ / W4] — IMAP + parse + dedup
  🆕 ผู้ใช้ตั้ง Gmail ให้ forward อีเมลธนาคารไปที่ `GMAIL_USER` แบบมี `+token` เช่น `moneybot+<email_ingest_token>@gmail.com` → ระบุตัวผู้ใช้จาก token
  🆕 ตรวจ header `Authentication-Results` ว่า `dkim=pass` และโดเมนผู้ลงนามเป็นของธนาคาร (SPF มักไม่ผ่านหลัง forward ให้ดู DKIM เป็นหลัก) + whitelist โดเมนผู้ส่ง — ไม่งั้นใครรู้ที่อยู่ก็ส่งอีเมลปลอมเข้ามาได้
  🆕 parse ด้วย regex เท่านั้น (ไม่ใช้ AI) → ผ่านแล้วบันทึกอัตโนมัติ `source='email'` → อ่านไม่ออกให้เก็บ `parsed=false` แล้วแจ้งจำนวนใน dailySummary
  🆕 เก็บ `body_redacted` ไว้เสมอ เผื่อธนาคารเปลี่ยนรูปแบบอีเมลจะได้ parse ใหม่ได้
- **quota.service.ts** [① / W2] 🔴 — นับ push ต่อเดือน, หยุดที่ PUSH_LIMIT
  🆕 นับจาก `push_log` เดือนนี้ (เวลาไทย) / ลำดับความสำคัญเมื่อโควตาใกล้หมด: งบเกิน 100% > แผนหลุดเป้า > สรุปรายวัน
  🆕 comment คำนวณให้เห็นภาพ: 280 ÷ 30 วัน ≈ ส่งสรุปรายวันได้แค่ ~9 คน จึงตั้ง daily summary เป็น opt-in
- **🆕 pending.service.ts** [② / W2] ⚖️ G2, G6
  - `createPending(userId, action, payload, source)` → คืน id (หมดอายุใน PENDING_EXPIRE_HOURS)
  - `confirm(userId, id)` → update `status='confirmed'` **เฉพาะแถวที่ยัง `waiting` และยังไม่หมดอายุ** แล้วค่อยเรียก service จริง (กดซ้ำไม่บันทึกซ้ำ) → สั่ง keyword.service จำคำ
  - `cancel(userId, id)`
- **🆕 keyword.service.ts** [③ / W2]
  - `lookup(userId, text)` → หา L3 ก่อน แล้วค่อย L2
  - `learn(userId, keyword, categoryId)` → upsert + hit_count++ เรียกเมื่อ ① ผู้ใช้กด ✏️ แก้หมวด ② ผู้ใช้ยืนยันผลจาก AI
  - comment: นี่คือเหตุผลที่ข้อความแบบเดิม "ห้ามถึง AI ครั้งที่สอง"
- **🆕 dedup.service.ts** [⑤ / W4] (ห้ามใช้ AI)
  - `findDuplicate(userId, { amountSatang, type, occurredAt, refNumber? })` → ref_number ตรงกัน หรือ ยอดเท่ากันเป๊ะ + type เดียวกัน + เวลาห่างไม่เกิน DEDUP_WINDOW_MINUTES
  - อีเมล: เจอซ้ำ → ไม่สร้างใหม่ ใส่ `matched_transaction_id` ใน user_emails
  - สลิป: เจอซ้ำ → แสดงคำเตือน "อาจซ้ำกับรายการ ..." ใน pendingCard ให้ผู้ใช้ตัดสินใจ

---

### src/db/
- **supabase.ts** [② / W1] — createClient ด้วย SERVICE_ROLE_KEY (comment เตือนว่าห้ามใช้ฝั่ง client)
  🆕 เพิ่ม comment ตัวใหญ่: key นี้ข้าม RLS ทั้งหมด → ทุก query ต้อง `.eq('user_id', userId)` (G6)
- **queries/*.ts** — แยกคำสั่งตามโดเมน ใส่ comment ตัวอย่าง SQL
  🆕 เพิ่ม `pending.ts`, `keywords.ts`, `logs.ts` / ทุกฟังก์ชันที่อ่าน transactions ต้องมี `deleted_at is null`

---

### src/line/
- **client.ts** [① / W1] — สร้าง messagingApi client (🆕 + blob client สำหรับดึงรูป)
- **reply.ts** [① / W1] — comment เตือน: reply ฟรี ใช้ให้มากที่สุด
  🆕 เพิ่ม `showLoading(userId)` เรียก loading animation (`showLoadingAnimation` ใน @line/bot-sdk ใช้ได้ในแชท 1:1) ก่อนรอ Gemini
  🆕 comment: reply token ใช้ได้ครั้งเดียวและอายุสั้น ถ้า Gemini ช้าเกิน timeout ให้ตอบ fallback ด้วย reply token เดิม ห้ามเปลี่ยนไป push
- **push.ts** [① / W2] — ต้องเช็ค quota.service ก่อนส่งทุกครั้ง 🆕 + บันทึก `push_log` พร้อม `dedup_key`
- **richmenu.ts** [④ / W2] — สคริปต์สร้าง Rich Menu 6 ช่อง (รันแยกครั้งเดียว)
  🆕 ปุ่มต้องส่งคำสั่งที่ทำงานได้โดยไม่ใช้ AI (G4) แนะนำ: วิธีบันทึก / สรุป / เหลือ / แผน / เปิด LIFF / ตั้งค่า
- **flex/*.ts** — 🆕 5 การ์ด:
  - `confirmCard` — บันทึกแล้ว + ↩️ ยกเลิก / ✏️ แก้หมวด
  - 🆕 `pendingCard` — "เข้าใจแบบนี้ ถูกไหม?" + ✅ ยืนยัน / ❌ ยกเลิก + ป้าย ✨ AI + คำเตือนถ้าอาจซ้ำ
  - `summaryCard`, `planCard` (🆕 + ป้ายความมั่นใจ + disclaimer), `errorCard`
  - 🆕 comment: postback data ยาวได้ไม่เกิน 300 ตัวอักษร → ใส่แค่ `action` + `id` ห้ามยัด payload ทั้งก้อน

---

### src/utils/
- **thaiDate.ts** [③ / W2] 🔴 — dayjs + timezone Asia/Bangkok (🆕 ต้อง extend plugin `utc` และ `timezone`)
  รองรับ: วันนี้, เมื่อวาน, พรุ่งนี้, เมื่อวานซืน, X วันก่อน, ศุกร์ที่แล้ว, ต้นเดือน, สิ้นเดือน, เดือนที่แล้ว
  🆕 ไม่เข้าใจให้คืน `null` (ห้ามเดา) / 🆕 ทุกฟังก์ชันรับ `now` เป็นพารามิเตอร์ (เพื่อให้ test ได้)
- **thaiNumber.ts** [③ / W2] — "ห้าสิบ", "1.2k", "1,500", "50บ", "50฿" 🆕 + "สองร้อยห้าสิบ" / 🆕 คืนค่าเป็นสตางค์
- **regexParser.ts** [③ / W1] — จับ pattern `<ชื่อ> <ตัวเลข>` และหลายรายการในบรรทัดเดียว
  🆕 ต้องรองรับ (จาก V2): `ข้าว60` (ไม่มีเว้นวรรค), `+เงินเดือน 35000` (+ = รายรับ), `1,250 ซื้อของ` (ตัวเลขขึ้นก่อน)
  🆕 คืน `{ items, confidence }` ให้ router ตัดสินใจ
- **logger.ts** [① / W1] — log ที่มี timestamp + level 🆕 ผ่าน `redact()` ก่อนเขียนทุกครั้ง
- **🆕 money.ts** [② / W1] ⚖️ G3
  - `toSatang(value: string | number)` — ค่า numeric จาก Supabase อาจมาเป็น number หรือ string ให้ผ่านฟังก์ชันนี้เสมอ แปลงโดยแยกสตริงตรงจุด ไม่ใช่ `x * 100` ตรง ๆ
  - `fromSatang(satang)` → `'1250.00'` สำหรับ insert ลง DB
  - `formatBaht(satang)` → `'฿1,250.00'`
  - `splitEvenly(totalSatang, count)` — หารค่าข้าว (เศษสตางค์ให้ไปอยู่ก้อนแรก)
- **🆕 redact.ts** [① / W2] ⚖️ G5
  ปิดเลขบัญชี, เบอร์โทร, เลขบัตรประชาชน 13 หลัก, เลขบัตรเครดิต → เหลือ 4 ตัวท้าย เช่น `***1234`
  comment: ต้องไม่ไปปิดจำนวนเงิน เช่น `35000` หรือ `1,250.00` (มี test คุม)

---

### src/jobs/
🆕 กติการ่วม: ทุกงาน **idempotent** (รันซ้ำแล้วผลเหมือนเดิม) และส่งออกฟังก์ชันให้ `routes/jobs.ts` เรียกได้ด้วย

- **index.ts** — รวม cron ทั้งหมด เรียกจาก index.ts 🆕 ใส่ `{ timezone: 'Asia/Bangkok' }` ทุกตัว
- **recurringJob.ts** [② / W2] — cron `0 6 * * *`
  🆕 วนสร้างจนกว่า `next_run > วันนี้` (กรณีเซิร์ฟเวอร์หลับไปหลายวันจะได้ตามทัน) + unique `(recurring_rule_id, recurring_run_date)` กันซ้ำ
- **dailySummary.ts** [② / W3] — cron `0 21 * * *` 🆕 เฉพาะผู้ใช้ที่เปิด `daily_summary_enabled` + ผ่าน quota + `dedup_key` รายวัน
- **planCheck.ts** [③ / W3] — cron รายวัน 🆕 เตือนแผนหลุดเป้าไม่เกินสัปดาห์ละครั้งต่อแผน
- **emailPoll.ts** [⑤ / W4] — cron `*/5 * * * *`
- **🆕 cleanup.ts** [① / W3] — cron `0 3 * * *` เปลี่ยน pending ที่หมดอายุเป็น `expired`, draft plan เก่ากว่า 24 ชม. เป็น `cancelled`, ลบ webhook_events เก่ากว่า 7 วัน, ลบ ai_usage_log เก่ากว่า 90 วัน

---

### src/types/index.ts — [② / W1]
interface: User, Category, Transaction, RecurringRule, Plan, Budget, UserEmail, 🆕 PendingAction
type: TransactionType = 'income' | 'expense' | 'transfer'
type: PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled'
type: Source = 'chat' | 'image' | 'email' | 'recurring' | 🆕 'liff'
🆕 type: ParsedBy = 'regex' | 'dictionary' | 'learned' | 'ai' | 'manual'
🆕 type: PendingStatus = 'waiting' | 'confirmed' | 'cancelled' | 'expired'
🆕 type: Confidence = 'low' | 'medium' | 'high'
🆕 comment: field เงินใน interface ของแอปใช้ชื่อ `amountSatang: number` (จำนวนเต็ม) ให้เห็นชัดว่าหน่วยคืออะไร

---

### 🆕 tests/ — [⑤ / W2-W4]
ใช้ vitest / **ห้ามเรียก Gemini จริงใน test** ให้ mock เสมอ / test เฉพาะส่วนที่ผิดแล้วเงินเพี้ยน

| ไฟล์ | ต้องพิสูจน์อะไร |
|---|---|
| `regexParser.test.ts` | ข้อความใน fixtures ที่ควรจบที่ L1 ต้องได้ผลตรง ≥ 90% / ข้อความซับซ้อนต้องคืน "ไม่มั่นใจ" (ไม่เดา) |
| `thaiNumber.test.ts` | ทุกรูปแบบในหัวข้อ utils แปลงเป็นสตางค์ถูก |
| `thaiDate.test.ts` | ส่ง `now` คงที่เข้าไป แล้วเช็คทุกคำ รวมกรณีข้ามเดือน/ข้ามปี และคำที่ไม่รู้จักต้องได้ `null` |
| `money.test.ts` | บวก 0.10 บาท 10,000 ครั้ง ต้องได้ 1,000.00 เป๊ะ / `toSatang('19.99') === 1999` |
| `redact.test.ts` | เลขบัญชี/เบอร์ถูกปิด แต่ `35000` และ `1,250.00` ไม่ถูกปิด |
| `plan.service.test.ts` | สูตร disposable ถูก / กฎ 0.8 / active เกิน 3 ถูกปฏิเสธ / cold-start ได้ป้ายถูกระดับ |
| `summary.service.test.ts` | transfer ไม่ถูกนับ / รายการที่ลบแล้วไม่ถูกนับ / safe-to-spend ติดลบแล้วมีคำเตือน |

**tests/fixtures/messages.json** — เขียนจริง 30 ข้อ รูปแบบ `{ text, expectedLayer, expected }` ต้องมีอย่างน้อย:
```
"กาแฟ 80"                          → L1+L2, expense 8000 สตางค์, อาหาร
"ข้าว60"                           → L1+L2, expense 6000
"+เงินเดือน 35000"                  → L1+L2, income 3500000, เงินเดือน
"1,250 ซื้อของ"                     → L1, expense 125000
"กาแฟ 50 ข้าว 60"                   → L1, 2 รายการ
"ห้าสิบบาท ค่าวิน"                   → L1+L2, expense 5000, เดินทาง
"จ่ายค่าไฟ 890 ค่าน้ำ 210"            → L4 → create_transaction_batch
"หารค่าข้าว 4 คน จ่าย 320"           → L4 → create_transaction { amount: 320, split_count: 4 }
"เมื่อวานซื้อกาแฟกับขนม 145"          → L4 → create_transaction { date_text: "เมื่อวาน" }
"เดือนนี้ใช้ไปเท่าไหร่"                → L4 → get_summary { period: "this_month" }
"ลบอันเมื่อกี้"                       → L4 → delete_transaction { target: "last" }
"อยากได้ไอแพด 25000 ภายใน 6 เดือน"  → L4 → simulate_purchase_or_plan
"สรุป" / "เหลือ" / "ยกเลิก"          → คำสั่งตายตัว (ไม่ถึง router)
"ออม 2000"                          → คำสั่งตายตัว → transfer 200000 สตางค์ เข้าแผนออม
```

---

### liff/ — [④ / W3]
5 หน้า HTML โครงสร้างเหมือนกัน: meta viewport, Sarabun font,
LIFF SDK CDN, Chart.js CDN, bottom nav 5 ปุ่ม
CSS: mobile-first, สีโทนเดียวกับ LINE
js/liff-init.js: liff.init → getIDToken → เก็บไว้ส่งให้ backend
🔴 comment เตือนตัวใหญ่: ห้ามใส่ SERVICE_ROLE_KEY ในโฟลเดอร์นี้เด็ดขาด
🆕 เพิ่มเติม:
- เก็บ ID token ไว้ในตัวแปรเท่านั้น **ห้าม localStorage** (เรียก `liff.getIDToken()` ใหม่ได้ทุกเมื่อ)
- `js/api.js` ส่ง `Authorization: Bearer <idToken>` ทุก request **ห้ามส่ง userId เอง** (G6)
- `transactions.html` — เพิ่ม/แก้/ลบได้ (ลบ = soft delete) และรายการที่ `parsed_by='ai'` มีป้าย ✨ AI
- `settings.html` — สวิตช์ `ai_enabled`, `daily_summary_enabled`, แสดงที่อยู่อีเมลสำหรับ forward (มี token), วิธีตั้งค่า Gmail filter
- `analyze.html` — แสดง "ใช้ได้วันละเท่าไหร่" + ป้ายความมั่นใจ + disclaimer
- เงินที่ได้จาก API เป็นสตางค์ ให้แปลงแสดงผลเป็น `฿1,250.00` ด้วยฟังก์ชันเดียวใน `api.js`

---

### .github/workflows/
- **ping.yml** — cron ทุก 10 นาที curl /health (กัน Render หลับ)
- **cron.yml** — เรียก endpoint งานตามเวลา
  🆕 เรียก `POST /jobs/:name` พร้อม header `x-cron-secret: ${{ secrets.CRON_SECRET }}`
  🆕 comment ตัวใหญ่: **cron ของ GitHub Actions เป็นเวลา UTC** ต้องลบ 7 ชั่วโมงจากเวลาไทย

  | งาน | เวลาไทย | เขียนใน cron.yml (UTC) |
  |---|---|---|
  | recurring | 06:00 | `0 23 * * *` (ของเมื่อวานตามเวลา UTC) |
  | planCheck | 09:00 | `0 2 * * *` |
  | dailySummary | 21:00 | `0 14 * * *` |
  | cleanup | 03:00 | `0 20 * * *` |

  🆕 comment: GitHub อาจรันช้ากว่าเวลาที่ตั้งได้ จึงเป็น "ตัวสำรอง" ของ node-cron — ปลอดภัยเพราะทุกงาน idempotent
  🆕 emailPoll (ทุก 5 นาที) ใช้ node-cron อย่างเดียว ไม่ต้องใส่ใน cron.yml

---

### docs/
- **SRS.md** — โครง 7 บท + หัวข้อย่อย (ว่างไว้ให้เติม)
- **SETUP.md** — คู่มือติดตั้งสำหรับสมาชิกใหม่ 🆕 + วิธีรัน `001_init.sql` ใน Supabase SQL Editor
- **🆕 RULES.md** — เขียนจริง: กฎเหล็ก G1-G7 + ตารางตัวอย่าง "❌ ผิด / ✅ ถูก" อย่างน้อยนี้:

  | ❌ ผิด | ✅ ถูก |
  |---|---|
  | `amount: 12.5` แล้วบวกกันตรง ๆ | `amountSatang: 1250` ผ่าน `utils/money.ts` |
  | เก็บรายจ่ายเป็นเลขติดลบ | เลขบวก + `type: 'expense'` |
  | `.from('transactions').select()` ไม่มี user_id | `.eq('user_id', userId)` ทุกครั้ง |
  | เชื่อ `req.body.userId` จาก LIFF | ใช้ `req.userId` จาก middleware |
  | ให้ Gemini ตอบว่า "เดือนนี้ใช้ไป 4,520 บาท" | Gemini เรียก `get_summary` → โค้ดคำนวณ → Flex |
  | Gemini ส่ง `delete_transaction` แล้วลบทันที | สร้าง pending → ผู้ใช้กด ✅ ก่อน |
  | ส่งรายการ 200 แถวให้ Gemini วิเคราะห์ | ส่งแค่ข้อความผู้ใช้ + 3 turn |
  | ใช้ `new Date()` ตัดวันสรุป | dayjs + `Asia/Bangkok` |
  | ลบแถวจริงด้วย `.delete()` | ตั้ง `deleted_at` |
  | `catch (e) {}` เงียบ ๆ | log ผ่าน logger แล้วตอบ errorCard |

---

## 🆕 แผน 4 สัปดาห์ + เกณฑ์ว่า "เสร็จ"

| สัปดาห์ | เป้าหมาย | เสร็จเมื่อ |
|---|---|---|
| W1 | ทางด่วนไม่ใช้ AI | `กาแฟ 80`, `ข้าว60`, `+เงินเดือน 35000` ลง Supabase จริง + confirmCard + ↩️ ยกเลิกได้ / schema รันแล้ว / webhook ตรวจลายเซ็นผ่าน |
| W2 | ต่อ AI อย่างปลอดภัย | Gemini + 8 tools + pending flow + guard / คำสั่ง สรุป เหลือ / recurring job / quota / test ของ parser, number, date, money ผ่าน |
| W3 | ฟีเจอร์เด่น | สลิป → pending / แผนออม 3 ทางเลือก + cold-start / งบ 80-100% / LIFF 5 หน้า / dailySummary |
| W4 | ครบวงจร | อีเมล + กันซ้ำ / planCheck / test ครบทุกไฟล์ / docs / ทดสอบ `AI_ENABLED=false` ทั้งแอป |

🔴 **ด่านบังคับ:** ③ ห้ามเริ่มต่อ Gemini จนกว่าเกณฑ์ W1 ผ่าน — ทางด่วนต้องแข็งแรงก่อน ไม่งั้น AI จะกลายเป็นไม้ค้ำที่ปิดบังจุดอ่อน

## 🆕 เกณฑ์ความสำเร็จตอนจบโปรเจกต์

1. บันทึกได้ครบ 3 ช่องทาง: แชท, สลิป, อีเมล
2. ตั้ง `AI_ENABLED=false` แล้ว บันทึก / สรุป / เหลือ / ยกเลิก / LIFF ยังใช้ได้ครบ
3. ไม่มีรายการใดที่ AI สร้าง แก้ หรือลบ โดยไม่มีคนกดยืนยัน
4. รายการเดียวกันที่มาจากแชทและอีเมล ไม่ถูกนับซ้ำ
5. push ทั้งเดือนไม่เกิน `PUSH_LIMIT`
6. `npm test` ผ่านทั้งหมด และไม่มี API key อยู่ใน repo

---

## ✅ เมื่อสร้างเสร็จ ให้รายงาน

1. จำนวนไฟล์ที่สร้าง
2. คำสั่งที่ต้องรันต่อ (npm install, รัน `001_init.sql` ใน Supabase ฯลฯ)
3. 3 ไฟล์แรกที่ทีมควรลงมือเขียนจริง (🆕 แนะนำ: `utils/money.ts`, `utils/regexParser.ts`, `routes/webhook.ts`)
4. เตือนเรื่อง .env ที่ต้องสร้างเองจาก .env.example
5. 🆕 ยืนยันว่าทุกไฟล์ใน `services/` และ `db/queries/` มี comment อ้างกฎเหล็กที่เกี่ยวข้อง
6. 🆕 รายการ dependency ที่ติดตั้ง และถ้าเพิ่มนอกเหนือจากที่ระบุ ให้บอกเหตุผล

เริ่มได้เลย
