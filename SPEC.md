# SPEC.md — money-bot

**เอกสารข้อกำหนดของระบบ (Source of Truth)**
ถ้าเอกสารอื่น โค้ด หรือ Prompt ขัดกับไฟล์นี้ **ให้ยึดไฟล์นี้** และแจ้งทีมเพื่อแก้ให้ตรงกัน

| หัวข้อ | รายละเอียด |
|---|---|
| ชื่อโปรเจกต์ | JOD tang |
| ประเภท | โปรเจกต์ทดลอง / การศึกษา (ไม่แสวงหากำไร) |
| ทีม | 5 คน (นักศึกษา ประสบการณ์น้อย) |
| งบประมาณ | 0 บาท/เดือน — ใช้ free tier ทั้งหมด |
| ระยะเวลา | 4 สัปดาห์ |
| เวอร์ชัน | 3.0 — รวมฟังก์ชันของ Prompt AI เข้ากับกฎความปลอดภัยของ Cashcast V2 |
| เอกสารคู่กัน | `AIDO.md` (กฎการทำงานของ AI Agent), `docs/RULES.md` (กฎเหล็กฉบับย่อ) |

---

## 1. ภาพรวมโปรเจกต์

### 1.1 ปัญหาที่แก้

1. **จดแล้วเลิก** — แอปจดรายจ่ายส่วนใหญ่ต้องกรอกหลายขั้นตอน ผู้ใช้เลิกจดภายใน 2–3 สัปดาห์
2. **รู้แค่ว่าเงินหายไปไหน** — แต่ไม่ได้ตอบคำถามที่ผู้ใช้อยากรู้จริง ๆ ว่า "วันนี้ใช้ได้อีกเท่าไหร่" หรือ "อยากได้ของชิ้นนี้ ต้องเก็บยังไง"

### 1.2 แนวคิดของผลิตภัณฑ์

แอปนี้ตอบ 2 คำถาม:

> **"วันนี้ฉันใช้เงินได้อีกเท่าไหร่?"** และ **"อยากได้สิ่งนี้ ต้องออมเดือนละเท่าไหร่ถึงจะไหว?"**

สามเสาหลัก:

- **เสา A — จดง่ายที่สุด:** พิมพ์ `กาแฟ 80` ใน LINE, ส่งรูปสลิป, หรือให้อีเมลธนาคารไหลเข้ามาเอง
- **เสา B — วางแผนออมที่ทำได้จริง:** ระบบคำนวณเงินที่เหลือใช้จากพฤติกรรมจริง แล้วเสนอแผนออม 3 ทางเลือกที่ไม่ทำให้ชีวิตลำบาก
- **เสา C — AI ช่วยเข้าใจภาษาคน แต่ไม่แตะตัวเลข:** Gemini ช่วยตีความข้อความและสลิปที่ซับซ้อน ส่วนการคำนวณเงินทุกบาทเป็นหน้าที่ของโค้ด

### 1.3 สิ่งที่ไม่ทำ (Non-goals)

- ❌ เชื่อมต่อ API ธนาคาร / Open Banking
- ❌ ติดตามการลงทุน หุ้น คริปโต
- ❌ หลายสกุลเงิน (บาทเท่านั้น)
- ❌ เชิงพาณิชย์ / เก็บเงินผู้ใช้
- ❌ แอป native และเว็บแอปแยก (ใช้ LIFF ใน LINE แทน)
- ❌ AI คำนวณเงิน พยากรณ์ตัวเลข หรือให้คำแนะนำการลงทุน
- ❌ แชทคุยเล่นทั่วไป (Gemini ตอบเป็นข้อความได้เฉพาะคำถามถามกลับเพื่อความชัดเจน)
- ❌ พยากรณ์เชิงสถิติขั้นสูง (Monte Carlo, seasonality)

---

## 2. สถาปัตยกรรม

### 2.1 หน้าจอของผู้ใช้

| ช่องทาง | หน้าที่ | เหตุผล |
|---|---|---|
| LINE Chat | จด, ถาม, ยืนยัน, รับแจ้งเตือน | ผู้ใช้อยู่ใน LINE อยู่แล้ว จดได้ใน 3 วินาที |
| LIFF (หน้าเว็บใน LINE) | กราฟ, แก้ไขรายการ, จัดการหมวด/งบ, ตั้งค่า | งานที่ต้องใช้จอเต็ม ไม่ต้องล็อกอินแยก |

ทั้งสองช่องทางใช้ **backend เดียว ฐานข้อมูลเดียว ตัวตนเดียว** (`line_user_id`)

### 2.2 แผนภาพระบบ

```
┌──────────────┐                         ┌──────────────────┐
│  LINE App    │                         │ LIFF (Vercel)    │
└──────┬───────┘                         └────────┬─────────┘
       │ webhook (มีลายเซ็น)                        │ REST + ID token
       ▼                                          ▼
┌─────────────────────┐              ┌──────────────────────┐
│ S1 LINE Gateway     │              │ S3 Core API          │
│ webhook + handlers  │              │ liffAuth + api.ts    │
└──────┬──────────────┘              └──────────┬───────────┘
       │                                        │
       ▼                                        │
┌─────────────────────┐   L4 เท่านั้น   ┌──────────────────────┐
│ S4 Text Parser      │──────────────►│ S11 AI Service       │
│ L1 regex            │               │ ① Guard              │
│ L2 พจนานุกรมกลาง     │               │ ② Gemini + 8 tools   │
│ L3 พจนานุกรมส่วนตัว   │               │ ③ Zod + sanity       │
└──────┬──────────────┘               └───┬──────────▲───────┘
       │                                  │ tool+args │ รูปสลิป
       │           ┌──────────────────────┘          │
       ▼           ▼                         ┌───────┴────────┐
┌──────────────────────┐                     │ S9 Slip Reader │
│ S12 Pending Actions  │◄────────────────────┤ (vision)       │
│ รอผู้ใช้กด ✅          │                     └────────────────┘
└──────┬───────────────┘
       ▼
┌──────────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ S5 Money Engine      │◄──►│ S6 Supabase      │◄───┤ S8 Email Ingest │
│ 🔴 ห้ามมี AI          │    │ (PostgreSQL)     │    │ IMAP + regex    │
│ summary/plan/budget  │    └──────▲───────────┘    └───────┬─────────┘
└──────────────────────┘           │                        ▼
                          ┌────────┴─────────┐     ┌─────────────────┐
                          │ S7 Scheduler     │     │ S10 Dedup       │
                          │ node-cron + GHA  │     │ 🔴 ห้ามมี AI      │
                          └────────┬─────────┘     └─────────────────┘
                                   ▼
                          ┌──────────────────┐
                          │ S13 Push + Quota │
                          └──────────────────┘
```

### 2.3 เทคโนโลยี

| ชั้น | เทคโนโลยี | ค่าใช้จ่าย |
|---|---|---|
| Backend | Node.js + TypeScript + Express | ฟรี |
| Hosting backend | Render (free) | ฟรี |
| Database | Supabase (PostgreSQL) ผ่าน `@supabase/supabase-js` | ฟรี |
| Chat | LINE Messaging API (`@line/bot-sdk`) | ฟรี (reply ไม่จำกัด, push มีโควตา) |
| Frontend | LIFF + Vanilla HTML/CSS/JS + Chart.js | ฟรี (Vercel) |
| AI | Google Gemini ผ่าน `@google/genai` (Function Calling + Vision) | free tier |
| Validation | Zod | ฟรี |
| วันที่/เวลา | dayjs + plugin utc, timezone | ฟรี |
| Cron | node-cron (หลัก) + GitHub Actions (สำรอง) | ฟรี |
| Test | vitest | ฟรี |

**นโยบายภาษา:** TypeScript ทั้ง backend / Vanilla JS ในโฟลเดอร์ `liff/` เท่านั้น
**นโยบาย AI:** ทุกการเรียก AI ต้องผ่าน `src/services/ai/` เท่านั้น เปลี่ยน provider ได้ด้วย `AI_PROVIDER` และปิดทั้งระบบได้ด้วย `AI_ENABLED=false`

### 2.4 หลักการออกแบบ 7 ข้อ (กฎเหล็ก)

| ข้อ | กฎ |
|---|---|
| G1 | AI ไม่คิดเลขเงิน — ดึงตัวเลขที่ผู้ใช้พิมพ์ได้ และเลือก tool ได้ เท่านั้น |
| G2 | AI จะเขียน/แก้/ลบข้อมูล ต้องผ่าน S12 และผู้ใช้กดยืนยันก่อนเสมอ |
| G3 | เงินเป็นเลขบวก, DB เป็น `numeric(12,2)`, โค้ดคำนวณเป็นสตางค์ (integer) |
| G4 | `AI_ENABLED=false` แล้วฟีเจอร์ P0 ทุกข้อยังใช้ได้ |
| G5 | ส่งให้ AI เท่าที่จำเป็น: ไม่เกิน 3 turn, ไม่ส่งรายการดิบ, ปิดข้อมูลส่วนตัวก่อนส่ง |
| G6 | ทุก query กรอง `user_id` และ `user_id` มาจากฝั่ง server เท่านั้น |
| G7 | `type='transfer'` ไม่นับเป็นรายรับหรือรายจ่ายในทุกการคำนวณ |

รายละเอียดวิธีปฏิบัติของแต่ละข้ออยู่ใน `AIDO.md` §5

---

## 3. โมดูล

### S1 — LINE Gateway

**ไฟล์:** `src/routes/webhook.ts`, `src/handlers/*`, `src/line/*`
**ผู้รับผิดชอบ:** ① (webhook, reply, push) / ③ (textHandler) / ④ (postback, flex, rich menu) / ⑤ (imageHandler) / ② (followHandler)

**ข้อกำหนด:**

- MUST ตรวจ `x-line-signature` ทุก request ด้วย middleware ของ `@line/bot-sdk` → ไม่ผ่านตอบ 401
- MUST ตอบ `200 OK` ภายใน 1 วินาที แล้วค่อยประมวลผลต่อแบบ async
- MUST idempotent — insert `webhookEventId` ลงตาราง `webhook_events` ถ้าชน primary key ให้ข้าม
- MUST ใช้ Reply API เป็นหลัก ใช้ Push เฉพาะงานที่ไม่มี reply token (cron) และต้องผ่าน S13
- MUST เรียก loading animation ก่อนรอ S11 แล้วตอบด้วย reply token เดิม ห้ามเปลี่ยนไป push เพราะ AI ช้า
- MUST NOT ใส่ `express.json()` ครอบทั้งแอป (middleware ของ LINE ต้องใช้ body ดิบ)

**Event:**

| Event | พฤติกรรม |
|---|---|
| `follow` | ผู้ใช้ใหม่: สร้าง user + seed หมวดเริ่มต้น + ข้อความต้อนรับ (แจ้งว่าใช้ AI และปิดได้) / ผู้ใช้เดิมกลับมา: `is_active=true` ไม่ seed ซ้ำ |
| `unfollow` | `is_active=false` เท่านั้น ห้ามลบข้อมูล |
| `message.text` | คำสั่งตายตัว → ไม่ใช่ → S4 |
| `message.image` | S9 |
| `postback` | ดูตาราง postback |

**คำสั่งในแชท:**

| ผู้ใช้พิมพ์ | ผลลัพธ์ | ใช้ AI? |
|---|---|---|
| `กาแฟ 80`, `ข้าว60`, `1,250 ซื้อของ` | บันทึกรายจ่าย (ทางด่วน) → confirmCard | ❌ |
| `+เงินเดือน 35000` | บันทึกรายรับ | ❌ |
| `ออม 2000` | บันทึก `transfer` เข้าแผนออม (มีแผน active แผนเดียว = เข้าแผนนั้นเลย / หลายแผน = quick reply ให้เลือก / ไม่มีแผน = แนะนำให้สร้างแผน) | ❌ |
| `สรุป` | สรุปวันนี้ + เดือนนี้ (summaryCard) | ❌ |
| `เหลือ` | ใช้ได้วันละเท่าไหร่ + คงเหลือเดือนนี้ + ป้ายความมั่นใจ | ❌ |
| `แผน` | แผนออม active ทั้งหมด + ความคืบหน้า | ❌ |
| `ยกเลิก` | soft delete รายการล่าสุดที่ผู้ใช้สร้างผ่านแชทภายใน 24 ชม. + ปุ่ม ↩️ เอากลับคืน | ❌ |
| `ช่วยเหลือ` | วิธีใช้ | ❌ |
| ข้อความอื่น / คำถาม | ส่งเข้า S4 → อาจถึง L4 | ⚠️ เมื่อจำเป็น |
| ส่งรูปสลิป | S9 → pendingCard | ✅ |

การจับคำสั่งตายตัวต้องตรงทั้งข้อความ (ตัดช่องว่างหัวท้าย) ยกเว้น `ออม <จำนวน>` ที่ใช้ regex

**Postback** (data ≤ 300 ตัวอักษร รูปแบบ `action=...&id=...`):

| action | มาจาก | ทำอะไร |
|---|---|---|
| `undo` | confirmCard | soft delete รายการ `id` |
| `restore` | ข้อความหลัง undo | ยกเลิก soft delete |
| `edit_category` | confirmCard | ตอบ quick reply รายการหมวด |
| `set_category` | quick reply | เปลี่ยนหมวด + `keyword.service.learn()` |
| `confirm_action` | pendingCard | S12 confirm |
| `cancel_action` | pendingCard | S12 cancel |
| `confirm_plan` | planCard | draft → active (ตรวจกฎ S5.3 ซ้ำอีกครั้ง ณ ตอนกด) และยกเลิก draft อื่นของผู้ใช้ |
| `save_to_plan` | quick reply หลัง `ออม` | บันทึก transfer เข้าแผน `plan` จำนวน `amt` (สตางค์) |
| `delete_tx` | ผลค้นหา | soft delete + ปุ่ม ↩️ (ผู้ใช้กดเองจึงไม่ต้องผ่าน S12) |
| `edit_tx` | ผลค้นหา | เปิด LIFF หน้าแก้ไขรายการนั้น |

ทุก action MUST ตรวจว่า record เป็นของผู้ใช้ที่กด (G6) และกดซ้ำต้องไม่เกิดผลซ้ำ

**Flex Message:**

| การ์ด | ใช้เมื่อ | ต้องมี |
|---|---|---|
| `confirmCard` | บันทึกผ่านทางด่วนสำเร็จ | รายการ, หมวด, ยอด, ปุ่ม ↩️ ยกเลิก / ✏️ แก้หมวด, แนบคำเตือนงบถ้ามี |
| `pendingCard` | AI หรือสลิปเสนอรายการ | "เข้าใจแบบนี้ ถูกไหม?", รายละเอียดทุกรายการ, ✅ / ❌, ป้าย ✨ AI, คำเตือนถ้าอาจซ้ำ |
| `summaryCard` | สรุป / get_summary | รายรับ, รายจ่าย, top 3 หมวด (ไม่รวม transfer) |
| `planCard` | แผนออม / simulate | 3 ทางเลือก, ป้ายความมั่นใจ, disclaimer |
| `errorCard` | ผิดพลาด | ข้อความสุภาพ + ตัวอย่างวิธีพิมพ์ที่ถูก |

**Rich Menu 6 ช่อง:** วิธีบันทึก / สรุป / เหลือ / แผน / เปิด LIFF / ตั้งค่า — ทุกปุ่มต้องใช้ได้เมื่อ AI ปิด

---

### S2 — LIFF Frontend

**ไฟล์:** `liff/*` / **ผู้รับผิดชอบ:** ④

| หน้า | เนื้อหา | ระดับ |
|---|---|---|
| `index.html` | ภาพรวม: ใช้ได้วันนี้, รายรับ/รายจ่ายเดือนนี้, แผน active | P0 |
| `transactions.html` | รายการ + กรอง + ค้นหา + เพิ่ม/แก้/ลบ (ป้าย ✨ AI สำหรับ `parsed_by='ai'`) | P0 |
| `categories.html` | จัดการหมวด, ตั้งงบรายเดือน, ติ๊กหมวดจำเป็น | P1 |
| `analyze.html` | กราฟตามหมวด, แนวโน้ม 6 เดือน, แผนออม + ป้ายความมั่นใจ | P1 |
| `settings.html` | สวิตช์ AI, สวิตช์สรุปรายวัน, ที่อยู่อีเมลสำหรับ forward, สร้าง token ใหม่, วิธีตั้ง Gmail filter | P1 |

**ข้อกำหนด:**

- MUST ส่ง `Authorization: Bearer <idToken>` ทุก request และ MUST NOT ส่ง userId เอง
- MUST NOT เก็บ token ใน localStorage / sessionStorage (เรียก `liff.getIDToken()` ใหม่ได้)
- MUST NOT มี `SERVICE_ROLE_KEY` หรือ secret ใด ๆ ในโฟลเดอร์นี้
- แสดงเงินเป็น `฿1,250.00` (API ส่งมาเป็นสตางค์) ผ่านฟังก์ชันเดียวใน `js/api.js`
- กราฟต้องแสดงข้อความแทนเมื่อข้อมูลน้อยกว่า 7 วัน
- เนื้อหาเชิงวางแผนต้องมี disclaimer "ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน"
- mobile-first, ฟอนต์ Sarabun, bottom nav 5 ปุ่ม

---

### S3 — Core API

**ไฟล์:** `src/routes/api.ts`, `src/middleware/liffAuth.ts` / **ผู้รับผิดชอบ:** ④ (api) / ① (liffAuth)

#### S3.1 การยืนยันตัวตน

```
1. LIFF เรียก liff.getIDToken() → ส่งมาใน header Authorization
2. liffAuth ส่ง POST https://api.line.me/oauth2/v2.1/verify
      id_token=<token>&client_id=<LINE_LOGIN_CHANNEL_ID>
3. ไม่ผ่าน / หมดอายุ → 401
4. ผ่าน → ได้ sub (= line_user_id) → หา users.id (ไม่เจอหรือ is_active=false → 403)
5. ใส่ req.userId แล้วไปต่อ
```

#### S3.2 Endpoints

เงินทุกช่องใน request/response เป็น **สตางค์ (integer)** ชื่อฟิลด์ลงท้าย `Satang`

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/overview` | `{ safeToSpendTodaySatang, monthIncomeSatang, monthExpenseSatang, activePlans[], confidence }` |
| GET | `/api/summary?period=&groupBy=` | period: today / this_week / this_month / last_month / last_6_months, groupBy: category / day / month |
| GET | `/api/transactions?from&to&categoryId&q&page&pageSize` | pageSize ≤ 50, ไม่รวมรายการที่ลบแล้ว |
| POST | `/api/transactions` | สร้าง (`source='liff'`, `parsed_by='manual'`) |
| PATCH | `/api/transactions/:id` | แก้ |
| DELETE | `/api/transactions/:id` | soft delete |
| POST | `/api/transactions/:id/restore` | เอากลับคืน |
| GET | `/api/categories` | หมวดทั้งหมด + งบเดือนนี้ + ยอดใช้ไป |
| POST | `/api/categories` | สร้างหมวดใหม่ |
| PATCH | `/api/categories/:id` | เปลี่ยนชื่อ / emoji / `isEssential` |
| DELETE | `/api/categories/:id` | ลบได้เฉพาะหมวดที่ผู้ใช้สร้าง รายการในหมวดนั้นย้ายไป "อื่นๆ" |
| PUT | `/api/categories/:id/budget` | `{ month, limitSatang }` (`null` = ลบงบ) |
| GET | `/api/settings` | สวิตช์ต่าง ๆ + ที่อยู่อีเมลสำหรับ forward |
| PATCH | `/api/settings` | `aiEnabled`, `dailySummaryEnabled` |
| POST | `/api/settings/email-token/rotate` | สุ่ม token ใหม่ (ที่อยู่เดิมใช้ไม่ได้ทันที) |

**ข้อกำหนด:**

- ทุก request ผ่าน Zod ก่อนเรียก service → ไม่ผ่านตอบ 400 `{ error: 'VALIDATION_ERROR', issues }`
- ทุก query กรอง `req.userId` และทุก id ที่ client ส่งมา (เช่น `categoryId`) ต้องตรวจว่าเป็นของผู้ใช้คนนั้น
- การแก้ไขจาก LIFF คือผู้ใช้ทำเอง → บันทึกทันที ไม่ผ่าน S12
- ข้อจำกัดข้อมูล: `amount > 0` และ ≤ 10,000,000 บาท, `occurred_at ≤ now + 1 วัน`, `note ≤ 500` ตัวอักษร

---

### S4 — Text Parser

**ไฟล์:** `src/utils/regexParser.ts`, `thaiNumber.ts`, `thaiDate.ts`, `src/config/keywords.ts`, `src/services/keyword.service.ts`, `src/services/ai/router.ts` / **ผู้รับผิดชอบ:** ③

ตัวแปลง 4 ชั้น เรียงจากถูกไปแพง:

| ชั้น | วิธี | หน้าที่ | สัดส่วนที่คาด | ค่าใช้จ่าย |
|---|---|---|---|---|
| L1 | Regex + thaiNumber | หาจำนวนเงิน, เครื่องหมาย `+` (รายรับ), หลายรายการในบรรทัด | ~60% | ฟรี |
| L2 | พจนานุกรมกลาง (`config/keywords.ts`) | คำ → หมวด | +15% | ฟรี |
| L3 | พจนานุกรมส่วนตัว (`user_keyword_map`) | คำที่ผู้ใช้คนนี้เคยแก้/ยืนยัน → หมวด (มาก่อน L2) | +10% | ฟรี |
| L4 | Gemini (S11) | ข้อความซับซ้อน, คำถาม, คำสั่งแก้/ลบ | ~15% และลดลงเรื่อย ๆ | โควตา |

**กฎการส่งต่อ (router):**

| สถานการณ์ | AI เปิด | AI ปิด (G4) |
|---|---|---|
| L1 ได้ตัวเลข + L2/L3 ได้หมวด | บันทึกทันที → confirmCard | เหมือนกัน |
| ได้ตัวเลข แต่ไม่รู้หมวด | L4 | บันทึกหมวด "อื่นๆ" + ปุ่ม ✏️ แก้หมวด |
| ไม่มีตัวเลข / มีคำถาม (เท่าไหร่, ไหม, ?) / คำสั่งแก้ลบ | L4 | ตอบวิธีใช้ + ตัวอย่าง |
| L4 ถูก guard ปฏิเสธ (โควตาหมด ฯลฯ) | — | ใช้ทาง "AI ปิด" |

**ข้อความที่ต้องรองรับ:**

```
กาแฟ 80                      → L1+L2  expense ฿80 อาหาร
ข้าว60                       → L1+L2  expense ฿60 (ไม่มีเว้นวรรค)
+เงินเดือน 35000              → L1+L2  income ฿35,000 เงินเดือน
1,250 ซื้อของ                 → L1     expense ฿1,250 (ตัวเลขขึ้นก่อน, มีคอมมา)
กาแฟ 50 ข้าว 60               → L1     2 รายการ
ห้าสิบบาท ค่าวิน               → L1+L2  expense ฿50 เดินทาง
ชาไข่มุก 1.2k                  → L1     expense ฿1,200
จ่ายค่าไฟ 890 ค่าน้ำ 210        → L4     create_transaction_batch
หารค่าข้าว 4 คน จ่าย 320       → L4     create_transaction {amount:320, split_count:4} → โค้ดหาร = ฿80
เมื่อวานซื้อกาแฟกับขนม 145     → L4     create_transaction {date_text:"เมื่อวาน"}
```

**วงจรเรียนรู้ (สำคัญมาก):**

1. ทุกการบันทึกผ่านทางด่วนมีปุ่ม ✏️ แก้หมวด → ผู้ใช้แก้ → `learn(userId, keyword, categoryId)`
2. ผู้ใช้ยืนยันผลจาก L4 → เขียนคำ → หมวด ลง `user_keyword_map`
3. ผลคือข้อความรูปแบบเดิมจะไม่ถึง L4 เป็นครั้งที่สอง ระบบจึงถูกลงและเร็วขึ้นเมื่อใช้ไปนาน ๆ

**thaiDate** ต้องรองรับ: วันนี้, เมื่อวาน, เมื่อวานซืน, พรุ่งนี้, X วันก่อน, ศุกร์ที่แล้ว (ทุกวันในสัปดาห์), ต้นเดือน (วันที่ 1), สิ้นเดือน (วันสุดท้าย), เดือนที่แล้ว — ไม่เข้าใจคืน `null` ห้ามเดา ทุกฟังก์ชันรับ `now` เป็นพารามิเตอร์

**thaiNumber** ต้องรองรับ: `50`, `1,500`, `1.2k`, `50บ`, `50฿`, `50บาท`, `ห้าสิบ`, `สองร้อยห้าสิบ`, `หนึ่งพันสอง` → คืนค่าเป็นสตางค์

---

### S5 — Money Engine 🔴 ห้ามมี AI

**ไฟล์:** `src/services/summary.service.ts`, `plan.service.ts`, `budget.service.ts`, `recurring.service.ts`, `src/utils/money.ts` / **ผู้รับผิดชอบ:** ② (summary, budget, recurring, money) / ③ (plan)

> 🔴 ทุกตัวเลขในโมดูลนี้มาจากโค้ดที่ให้ผลเหมือนเดิมทุกครั้งเมื่อข้อมูลเหมือนเดิม
> AI ห้ามคำนวณ ปรับ หรือแก้ค่าใด ๆ ในโมดูลนี้

**กติการ่วม:**

- ข้อมูลที่นับ = `deleted_at is null` เท่านั้น (ตาราง transactions มีแต่รายการที่ยืนยันแล้ว เพราะ pending อยู่ในตารางแยก)
- `transfer` ไม่นับเป็นรายรับหรือรายจ่าย (G7)
- แบ่งวัน/เดือนตามเวลาไทย: `(occurred_at at time zone 'Asia/Bangkok')`
- ผลรวมให้ SQL คำนวณ (`sum` บน numeric แม่นยำ) แล้วแปลงเป็นสตางค์ด้วย `toSatang()`
- ไม่มีคอลัมน์ "ยอดคงเหลือ" เก็บไว้ ทุกยอดคำนวณสดจาก transactions ทุกครั้ง ห้ามบวกเพิ่มทีละครั้ง
- การปัดเศษ: คำนวณเป็นสตางค์ ปัดครั้งเดียวตอนท้าย (ปัดครึ่งขึ้น) ยกเว้นที่ระบุว่าปัดลง

#### S5.1 สรุป (`get_summary`, คำสั่ง `สรุป`)

รายรับ, รายจ่าย, ส่วนต่าง, แยกตามหมวด (เรียงมากไปน้อย) ของช่วงที่เลือก

#### S5.2 ใช้ได้วันละเท่าไหร่ (Safe-to-spend, คำสั่ง `เหลือ`)

```
คงเหลือเดือนนี้ = รายรับเดือนนี้
                + recurring รายรับ ที่ยังไม่ถึงรอบ (วันนี้ถึงสิ้นเดือน และยังไม่ถูกสร้าง)
                − รายจ่ายเดือนนี้
                − recurring รายจ่าย ที่ยังไม่ถึงรอบ
                − Σ monthly_save ของแผน status='active'

D               = จำนวนวันที่เหลือในเดือน นับวันนี้ด้วย (เวลาไทย)
ใช้ได้ต่อวัน      = คงเหลือเดือนนี้ ÷ D   (ปัดลงเป็นสตางค์)
```

- ผลติดลบ → แสดงคำเตือนทันทีว่าเดือนนี้ใช้เกินแล้ว เท่าไหร่
- ลบ `monthly_save` ได้ตรง ๆ โดยไม่นับซ้ำ เพราะการโอนเข้าแผน (transfer) ไม่ถูกนับเป็นรายจ่ายอยู่แล้ว
- คำนวณสดทุกครั้งที่ถูกเรียก

#### S5.3 แผนออม — สูตรหลัก

```
disposable = avgIncome3M − recurringTotal − avgEssential − (avgExpense × 0.15)

กฎ 1: Σ monthly_save ของทุกแผน active (รวมแผนใหม่) ≤ disposable × 0.8
กฎ 2: จำนวนแผน status='active' ≤ 3
```

**นิยามตัวแปร** (ช่วงข้อมูล = 90 วันย้อนหลัง นับจากเมื่อวาน / ไม่รวม transfer):

| ตัวแปร | ความหมาย | วิธีคำนวณ (ระดับความมั่นใจสูง) |
|---|---|---|
| `avgIncome3M` | รายรับเฉลี่ยต่อเดือน | ผลรวมรายรับ 90 วัน ÷ 3 |
| `recurringTotal` | รายจ่ายประจำต่อเดือน | ผลรวม `recurring_rules` รายจ่ายที่ active แปลงเป็นต่อเดือน: daily × 365 ÷ 12, weekly × 52 ÷ 12, monthly × 1, yearly ÷ 12 |
| `avgEssential` | รายจ่ายจำเป็นที่ไม่ใช่รายการประจำ | ผลรวมรายจ่ายในหมวด `is_essential=true` และ `source ≠ 'recurring'` 90 วัน ÷ 3 (ตัด recurring ออกเพื่อไม่ให้นับซ้ำกับ `recurringTotal`) |
| `avgExpense` | รายจ่ายรวมเฉลี่ยต่อเดือน | ผลรวมรายจ่ายทั้งหมด 90 วัน ÷ 3 |
| `0.15` | กันเงินฉุกเฉิน | `EMERGENCY_BUFFER` |
| `0.8` | เผื่อความคลาดเคลื่อน | `PLAN_SAFETY_RATIO` |

ความหมายของสูตร: `disposable` คือเงินที่ "ย้ายไปออมได้" โดยไม่กระทบรายจ่ายจำเป็น ส่วนรายจ่ายไม่จำเป็น (ช้อปปิ้ง บันเทิง) คือส่วนที่ผู้ใช้ต้องลดเองถ้าจะออมตามแผน

`capacity = disposable × 0.8 − Σ monthly_save ของแผน active เดิม`
ถ้า `capacity ≤ 0` → ไม่สร้างแผน แสดงเหตุผลเป็นตัวเลข และแนะนำให้ลดแผนเดิมหรือยืดเวลา

#### S5.4 สร้าง 3 ทางเลือก (`createSavingPlan`)

อินพุต: `target` (ราคาของ, สตางค์), `months` (ถ้าผู้ใช้ระบุเวลา)

| ทางเลือก | monthly_save | จำนวนเดือน |
|---|---|---|
| ⚡ เร็ว | ถ้าผู้ใช้ระบุเวลา และ `ceil(target ÷ months) ≤ capacity` → ใช้ค่านั้น (ชื่อ "ตามเป้า") / ไม่งั้น = `capacity` | `ceil(target ÷ monthly_save)` |
| ⚖️ สมดุล | `capacity × 0.6` | `ceil(target ÷ monthly_save)` |
| 🌿 สบาย | `capacity × 0.35` | `ceil(target ÷ monthly_save)` |

- `monthly_save` ปัดลงเป็นหลักสิบบาท / ทางเลือกที่ได้ `monthly_save < ฿100` ให้ซ่อน
- ถ้าผู้ใช้ระบุเวลาแต่ทำไม่ได้ ต้องบอกตรง ๆ ว่า "ภายใน X เดือนต้องออมเดือนละ ฿Y ซึ่งเกินกำลัง" แล้วเสนอ 3 ทางเลือกตามปกติ
- ทุกทางเลือกบันทึกเป็น `plans.status='draft'` เมื่อสร้างชุดใหม่ draft เก่าของผู้ใช้ถูก `cancelled` ทั้งหมด
- `confirm_plan` ต้องตรวจกฎ 1 และ 2 ซ้ำ ณ เวลาที่กด (ข้อมูลอาจเปลี่ยนไปแล้ว)
- ค่าสัดส่วน 0.6 / 0.35 / ฿100 ปรับได้ แต่ต้องแก้ SPEC และ test พร้อมกัน

#### S5.5 Cold-start (ผู้ใช้ใหม่)

| ข้อมูลย้อนหลัง | รายรับที่ใช้ | รายจ่ายที่ใช้ | ป้าย |
|---|---|---|---|
| < 7 วัน | recurring รายรับเท่านั้น (ถ้าไม่มี → ถามรายได้ประจำก่อน ยังไม่สร้างแผน) | recurring รายจ่ายเท่านั้น | 🔴 ประมาณการเบื้องต้น |
| 7–89 วัน | recurring รายรับต่อเดือน ถ้ามี / ไม่มี = รายรับที่บันทึก ÷ `ceil(วัน ÷ 30)` | ผลรวมรายจ่าย ÷ วัน × 30 | 🟡 ปานกลาง |
| ≥ 90 วัน | ตาม S5.3 | ตาม S5.3 | 🟢 สูง |

"ข้อมูลย้อนหลัง" = จำนวนวันนับจากรายการแรกของผู้ใช้ถึงเมื่อวาน / ป้ายนี้ต้องแสดงบนทุกการ์ดแผนและหน้า `เหลือ`

#### S5.6 ติดตามและปรับแผน

- **ความคืบหน้า** = `sum(amount) where plan_id = X and type='transfer' and deleted_at is null` คำนวณสดทุกครั้ง
- **เป้าสะสม ณ วันนี้** = `monthly_save × (จำนวนวันนับจาก confirmed_at ÷ 30)`
- **หลุดเป้า** = ความคืบหน้า < เป้าสะสม × 0.9 และแผนเริ่มมาแล้ว ≥ 14 วัน → เตือน (สัปดาห์ละครั้ง) + เสนอ `replan`
- **ครบเป้า** = ความคืบหน้า ≥ target → `status='completed'` + แสดงความยินดี
- **replan** = เรียก S5.4 ใหม่ด้วย `target − ความคืบหน้า`

#### S5.7 จำลองการซื้อ (`simulateImpact`)

อินพุต: ราคาของ → แสดง 2 ฉาก:

1. **ซื้อเลยตอนนี้:** ใช้ได้ต่อวันจะเหลือ `(คงเหลือเดือนนี้ − ราคา) ÷ D` และถ้าติดลบให้บอกว่ากระทบแผนออมที่ active
2. **ออมแทน:** ผลจาก S5.4

#### S5.8 งบรายหมวด

- ยอดใช้ = รายจ่ายของหมวดในเดือนนั้น (ไม่รวม transfer)
- ถึง 80% → เตือนครั้งเดียว (`alerted_80`) / ถึง 100% → เตือนครั้งเดียว (`alerted_100`)
- ถ้ารายการที่ทำให้ถึงเกณฑ์มาจากแชท → แนบไปใน reply เดียวกัน (ฟรี) / มาจากอีเมลหรือ recurring → push ผ่าน S13

#### S5.9 Recurring

- `next_run` คำนวณตาม `frequency` / `day_of_month = 31` ในเดือนที่สั้นกว่า → วันสุดท้ายของเดือน
- เมื่อถึงรอบ S7 สร้าง transaction `source='recurring'` พร้อม `recurring_rule_id` + `recurring_run_date` (unique กันซ้ำ)

---

### S6 — Database

**Engine:** Supabase (PostgreSQL 15+) / **ไฟล์:** `supabase/migrations/001_init.sql` / **ผู้รับผิดชอบ:** ②

```sql
-- กติกา: เงิน numeric(12,2) / เวลา timestamptz / จำนวนเงิน > 0 เสมอ

create table users (
  id                    uuid primary key default gen_random_uuid(),
  line_user_id          text unique not null,
  display_name          text,
  is_active             boolean not null default true,
  ai_enabled            boolean not null default true,
  daily_summary_enabled boolean not null default false,
  email_ingest_token    text unique,                    -- สุ่ม ≥ 16 bytes (hex) ห้ามสร้างจาก user_id
  created_at            timestamptz not null default now()
);

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
  ref_number         text,
  plan_id            uuid references plans(id),
  recurring_rule_id  uuid references recurring_rules(id),
  recurring_run_date date,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (recurring_rule_id, recurring_run_date),
  check (type = 'transfer' or plan_id is null)          -- plan_id ใช้ได้เฉพาะ transfer
);
create unique index uq_tx_ref on transactions (user_id, ref_number)
  where ref_number is not null and deleted_at is null;
create index idx_tx_user_date on transactions (user_id, occurred_at desc)
  where deleted_at is null;

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

create table user_keyword_map (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  keyword     text not null,
  category_id uuid not null references categories(id) on delete cascade,
  hit_count   integer not null default 1,
  updated_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

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

create table webhook_events (
  id          text primary key,
  received_at timestamptz not null default now()
);

create table push_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references users(id) on delete set null,
  kind      text not null,
  dedup_key text unique not null,
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

-- เปิด RLS ทุกตารางโดยไม่สร้าง policy → anon key เข้าไม่ได้เลย
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

**กฎข้อมูล:**

- MUST ใช้ `numeric(12,2)` สำหรับเงิน ห้าม `real` / `double precision` / `float`
- MUST ใช้ `timestamptz` ห้าม `timestamp` เปล่า
- จำนวนเงินเป็นบวกเสมอ ทิศทางดูจาก `type`
- ลบรายการ = ตั้ง `deleted_at` / ลบจริงเฉพาะเมื่อลบบัญชีผู้ใช้ (cascade)
- backend ใช้ service role ซึ่งข้าม RLS → การกรอง `user_id` เป็นความรับผิดชอบของโค้ด 100%
- เปลี่ยน schema ต้องทำเป็นไฟล์ migration ใหม่ (`002_...sql`) ห้ามแก้ใน Supabase dashboard ตรง ๆ

---

### S7 — Scheduler

**ไฟล์:** `src/jobs/*`, `src/routes/jobs.ts`, `.github/workflows/cron.yml` / **ผู้รับผิดชอบ:** ② ③ ⑤ ① ตามงาน

| งาน | เวลาไทย | node-cron | cron.yml (UTC) | ผู้รับผิดชอบ | ทำอะไร |
|---|---|---|---|---|---|
| `recurring` | 06:00 | `0 6 * * *` | `0 23 * * *` | ② | สร้างรายการตามรอบ วนจนกว่า `next_run > วันนี้` (ตามทันถ้าเซิร์ฟเวอร์หลับ) |
| `planCheck` | 09:00 | `0 9 * * *` | `0 2 * * *` | ③ | ตรวจแผนหลุดเป้า/ครบเป้า (S5.6) |
| `dailySummary` | 21:00 | `0 21 * * *` | `0 14 * * *` | ② | สรุปวันนี้ เฉพาะผู้ใช้ที่เปิดไว้ + แจ้งจำนวนอีเมลที่อ่านไม่ออก |
| `cleanup` | 03:00 | `0 3 * * *` | `0 20 * * *` | ① | pending หมดอายุ → expired, draft plan > 24 ชม. → cancelled, ลบ webhook_events > 7 วัน, ลบ ai_usage_log > 90 วัน |
| `emailPoll` | ทุก 5 นาที | `*/5 * * * *` | — | ⑤ | ดึงอีเมลใหม่ (S8) |

**ข้อกำหนด:**

- node-cron ต้องใส่ `{ timezone: 'Asia/Bangkok' }` ทุกงาน
- ทุกงาน MUST idempotent — รันซ้ำ (จาก node-cron และ GitHub Actions พร้อมกัน) ต้องไม่เกิดข้อมูลซ้ำหรือ push ซ้ำ
- `POST /jobs/:name` MUST ตรวจ header `x-cron-secret` ด้วย `crypto.timingSafeEqual` ไม่ตรง → 401
- `ping.yml` เรียก `GET /health` ทุก 10 นาที กัน Render หลับ

---

### S8 — Email Ingestion

**ไฟล์:** `src/services/email.service.ts`, `src/jobs/emailPoll.ts` / **ผู้รับผิดชอบ:** ⑤ / **สัปดาห์:** W4

**วิธีตั้งค่าของผู้ใช้ (ครั้งเดียว):**

1. เปิดการแจ้งเตือนทางอีเมลในแอปธนาคาร (เริ่มจาก K PLUS)
2. สร้าง Gmail filter: อีเมลจากโดเมนธนาคาร → forward ไปที่ `<GMAIL_USER ส่วนหน้า>+<email_ingest_token>@gmail.com` (ดูที่อยู่เต็มในหน้า settings ของ LIFF)
3. ยืนยันอีเมล verification ของ Gmail

**ขั้นตอนฝั่งเซิร์ฟเวอร์:**

```
IMAP (GMAIL_USER + GMAIL_APP_PASSWORD) ดึงอีเมลที่ยังไม่อ่าน
  ↓
1. อ่าน token จากที่อยู่ปลายทาง (+token) → หา user        → ไม่เจอ/ไม่ active: ข้าม
2. ตรวจ Authentication-Results: dkim=pass และโดเมนผู้ลงนามอยู่ใน whitelist ธนาคาร → ไม่ผ่าน: ข้าม
3. Message-ID ซ้ำใน user_emails                        → ข้าม
4. แปลงเป็น plain text → redact → บันทึก user_emails (body_redacted)
5. regex parser ของธนาคารนั้น → ได้ amount, direction, occurred_at, ref_number
   ├─ ไม่ครบ → parsed=false (แจ้งจำนวนใน dailySummary)
   └─ ครบ + ผ่าน sanity → S10 dedup
        ├─ ซ้ำ → ไม่สร้าง ใส่ matched_transaction_id
        └─ ไม่ซ้ำ → สร้าง transaction (source='email', parsed_by='regex') + หมวดจาก S4 L2/L3
6. mark อีเมลว่าอ่านแล้ว
```

**ข้อกำหนด:**

- MUST ตรวจ DKIM ของโดเมนธนาคาร (SPF มักไม่ผ่านหลัง forward) — ไม่งั้นใครรู้ที่อยู่ก็ส่งรายการปลอมเข้ามาได้
- `email_ingest_token` MUST สุ่มด้วย `crypto.randomBytes(16)` ขึ้นไป ห้ามสร้างจาก user_id และเปลี่ยนใหม่ได้จาก LIFF
- ใช้ regex เท่านั้น ไม่ใช้ AI กับอีเมล
- MUST เก็บ `body_redacted` ก่อน parse เสมอ เผื่อธนาคารเปลี่ยนรูปแบบจะได้ parse ใหม่ได้
- pattern ของแต่ละธนาคารแยกเป็นฟังก์ชัน/ไฟล์ ห้ามเขียนปนใน logic หลัก
- ตัวอย่างอีเมลใน repo (สำหรับ test) MUST ถูกแก้เลขบัญชี ชื่อ และจำนวนเงินจริงออกแล้ว

---

### S9 — Slip Reader

**ไฟล์:** `src/handlers/imageHandler.ts`, `src/services/ai/vision.ts` / **ผู้รับผิดชอบ:** ⑤ / **สัปดาห์:** W3

```
ผู้ใช้ส่งรูป → loading animation → ดึงรูปจาก LINE Content API
  ↓
S11 guard (kind='vision') → ไม่ผ่าน: ตอบให้พิมพ์เอง เช่น "ร้าน 250"
  ↓
Gemini Vision → JSON → Zod + sanity → ไม่ผ่าน: errorCard
  ↓
ปิดเลขบัญชีในผลลัพธ์ → เช็ค ref_number ซ้ำ + S10 → สร้าง pending_action (source='image')
  ↓
pendingCard (✨ AI + คำเตือนถ้าอาจซ้ำ) → ผู้ใช้กด ✅ → บันทึก source='image', parsed_by='ai'
```

**ฟิลด์ที่อ่าน:**

| ฟิลด์ | บังคับ | หมายเหตุ |
|---|---|---|
| `amount` | ✅ | 0 < amount ≤ 10,000,000 |
| `datetime` | ✅ | ไม่อยู่ในอนาคต แปลงเป็นเวลาไทย |
| `receiver` | ⬜ | ใช้เดาหมวดผ่าน L2/L3 / ไม่ต้องมีเลขบัญชี |
| `bank` | ⬜ | |
| `refNumber` | ⬜ | ใช้กันซ้ำ |

- prompt: "อ่านเฉพาะที่เห็นในรูป ห้ามเดา ไม่เห็นให้ null ไม่ต้องส่งเลขบัญชี"
- MUST NOT เก็บไฟล์รูปไว้ที่ใดเลย
- สลิปคือเงินออกจากบัญชีผู้ใช้ → ค่าเริ่มต้น `type='expense'` ผู้ใช้เปลี่ยนเป็น `transfer` ได้ในหน้า LIFF

---

### S10 — Dedup (กันรายการซ้ำ) 🔴 ห้ามมี AI

**ไฟล์:** `src/services/dedup.service.ts` / **ผู้รับผิดชอบ:** ⑤ / **สัปดาห์:** W4

ถือว่า "อาจซ้ำ" เมื่อ **ข้อใดข้อหนึ่ง** เป็นจริง:

1. `ref_number` เท่ากัน (ของผู้ใช้คนเดียวกัน, ยังไม่ลบ) → **ซ้ำแน่นอน**
2. `amount` เท่ากันเป๊ะ **และ** `type` เดียวกัน **และ** เวลาห่างกันไม่เกิน 30 นาที → **น่าจะซ้ำ**

| ช่องทางใหม่ | ซ้ำแน่นอน | น่าจะซ้ำ |
|---|---|---|
| อีเมล | ไม่สร้าง + `matched_transaction_id` | ไม่สร้าง + `matched_transaction_id` + เติม `ref_number` ให้รายการเดิม |
| สลิป | ปฏิเสธ "สลิปนี้บันทึกไปแล้ว" | pendingCard มีคำเตือน ให้ผู้ใช้ตัดสินใจ |
| แชท (ทางด่วน) | — | ไม่ตรวจ (ผู้ใช้พิมพ์เอง ตั้งใจจด) |

ห้ามรวมรายการอัตโนมัติด้วยเงื่อนไขอื่นนอกจากนี้ การรวมผิดทำให้ข้อมูลหายแบบไม่มีร่องรอย

---

### S11 — AI Service

**ไฟล์:** `src/services/ai/*` / **ผู้รับผิดชอบ:** ③ (⑤ สำหรับ vision) / **สัปดาห์:** W2 (หลังผ่านเกณฑ์ W1)

จุดเดียวในระบบที่เรียก AI provider ได้ โมดูลอื่นห้าม import `@google/genai`

#### S11.1 โครงสร้าง

```
┌───────────────────────────────────────────────────┐
│ S11 AI Service                                    │
├───────────────────────────────────────────────────┤
│ ① GUARD (guard.ts) — ทุกการเรียก ตามลำดับ           │
│    1. AI_ENABLED และ users.ai_enabled            │
│    2. จำกัดต่อคนต่อวัน (AI_DAILY_LIMIT_PER_USER)    │
│    3. จำกัดทั้งระบบต่อวัน (AI_DAILY_LIMIT_GLOBAL)    │
│    4. redact ข้อความ                               │
│    5. timeout AI_TIMEOUT_MS                        │
│    6. log ai_usage_log (ทุกครั้ง)                   │
├───────────────────────────────────────────────────┤
│ ② TASKS                                           │
│    T1 understandText()  ← S4 L4   (gemini.ts)     │
│    T2 readSlip()        ← S9      (vision.ts)     │
├───────────────────────────────────────────────────┤
│ ③ VALIDATOR                                       │
│    Zod ตรวจ args ของ tool / JSON ของสลิป            │
│    sanity check → ไม่ผ่าน: ถามผู้ใช้กลับ ไม่เดา       │
└───────────────────────────────────────────────────┘
```

guard ตอบ `{ ok: false, reason }` เมื่อไม่ให้เรียก → ผู้เรียกต้องมีทางไปต่อแบบไม่ใช้ AI เสมอ

#### S11.2 T1 — understandText (Function Calling)

- อินพุต: ข้อความล่าสุด (redact แล้ว) + 3 turn ก่อนหน้า (เก็บใน memory, หมดอายุ 30 นาที) + วันที่ปัจจุบันเวลาไทย
- เอาต์พุต: `{ kind: 'tool', name, args }` หรือ `{ kind: 'text', text }` อย่างใดอย่างหนึ่ง
- 1 ข้อความ = เรียก Gemini ไม่เกิน 1 ครั้ง + retry 1 ครั้ง (เฉพาะ timeout / network / 5xx)
- ผลของ tool **ไม่ส่งกลับเข้า Gemini** — S5 คำนวณแล้วสร้าง Flex เอง
- `kind='text'` ใช้ได้เฉพาะคำถามถามกลับ ถ้ามีตัวเลขเงินที่ไม่ได้อยู่ในข้อความผู้ใช้ → ทิ้งแล้วใช้ข้อความ fallback

**Tool catalog:**

| # | tool | kind | args (Zod) | ผลเมื่อผ่าน |
|---|---|---|---|---|
| 1 | `create_transaction` | write | `type`, `amount` (ตามที่พิมพ์), `item`, `split_count?`, `date_text?`, `category_hint?`, `plan_name?` | pending → pendingCard |
| 2 | `create_transaction_batch` | write | `items[]` (โครงเดียวกับข้อ 1, สูงสุด 10) | pending |
| 3 | `update_transaction` | write | `target` ('last' หรือ id), `changes` {amount?, item?, category_hint?, date_text?} | pending |
| 4 | `delete_transaction` | write | `target` ('last' หรือ id) | pending |
| 5 | `get_summary` | read | `period` | S5.1 → summaryCard |
| 6 | `query_transactions` | read | `category_hint?`, `date_text?`, `keyword?`, `limit ≤ 10` | Flex รายการ + ปุ่มลบ/แก้ |
| 7 | `create_recurring` | write | `label`, `type`, `amount`, `frequency`, `day?` | pending |
| 8 | `simulate_purchase_or_plan` | read | `item_name`, `price`, `target_text?` | S5.7 / S5.4 → planCard |

**การแปลง args เป็นข้อมูลจริง (ทำในโค้ด):**

- `amount` → `toSatang()` / มี `split_count` → `splitEvenly()` แล้วใช้ก้อนของผู้ใช้
- `date_text` → `thaiDate` ได้ `null` → ถามกลับ / ไม่มี `date_text` → เวลาปัจจุบัน
- `category_hint` → S4 L3 → L2 → ไม่เจอ = "อื่นๆ"
- `plan_name` → ค้นแผน active ของผู้ใช้ด้วยชื่อ ไม่เจอหรือเจอหลายแผน → quick reply ให้เลือก
- `target_text` → จำนวนเดือน (เช่น "6 เดือน", "ภายในสิ้นปี") ด้วยโค้ด ถ้าแปลงไม่ได้ = ไม่ระบุเวลา

**Sanity check:** `0 < amount ≤ 10,000,000`, `split_count` 2–50, วันที่ไม่เกินพรุ่งนี้และไม่ย้อนเกิน 1 ปี

**กฎใน system prompt (prompt.ts):**

- บทบาท: ผู้ช่วยจดรายรับรายจ่ายภาษาไทย ตอบสั้น เป็นกันเอง
- "ดึงเฉพาะตัวเลขที่ผู้ใช้พิมพ์ ห้ามคำนวณ ห้ามประมาณ ถ้าต้องหารให้ใส่ split_count"
- "วันที่ให้ส่งคำที่ผู้ใช้พูดมาใน date_text ไม่ต้องแปลงเอง"
- "คำถามเรื่องยอดเงินให้เรียก get_summary เสมอ ห้ามตอบตัวเลขเอง"
- "ไม่มั่นใจให้ถามกลับ ห้ามเดา"
- "ห้ามให้คำแนะนำการลงทุน ห้ามคุยเรื่องอื่นนอกจากการเงินส่วนตัวของผู้ใช้"

#### S11.3 T2 — readSlip

ดู S9 ใช้ guard เดียวกัน (`kind='vision'`) และนับรวมในโควตาต่อคน

#### S11.4 ประมาณการใช้งาน

สมมติ 20 คน × 5 ข้อความ/วัน = 100 ข้อความ/วัน

| งาน | ครั้ง/วัน (เริ่มต้น) | หลังพจนานุกรมโต |
|---|---|---|
| T1 ข้อความที่ถึง L4 | ~15 | ~8 |
| T1 คำถาม / แก้ / ลบ / วางแผน | ~10 | ~10 |
| T2 สลิป | ~5 | ~5 |
| **รวม** | **~30** | **~23** |

ตั้ง `AI_DAILY_LIMIT_GLOBAL` ให้ต่ำกว่าโควตาของโมเดลที่ใช้ (ดูใน Google AI Studio) และตั้งเพดานในหน้า provider ด้วยถ้าทำได้ — เพดานในโค้ดอาจพังเพราะบั๊ก เพดานฝั่ง provider ไม่พัง

**ความเป็นส่วนตัว:** ก่อนเปิดให้ผู้ใช้จริงส่งสลิป ทีมต้องอ่านเงื่อนไขของ Gemini API เรื่องการนำข้อมูลไปใช้ปรับปรุงบริการ (โดยเฉพาะ free tier) แล้วเขียนแจ้งผู้ใช้ในข้อความต้อนรับให้ตรงกับความจริง

---

### S12 — Pending Actions (คำขอรอยืนยัน)

**ไฟล์:** `src/services/pending.service.ts`, `src/db/queries/pending.ts` / **ผู้รับผิดชอบ:** ② / **สัปดาห์:** W2

```
                 ผู้ใช้กด ✅ (ภายใน 24 ชม.)
   waiting ───────────────────────────► confirmed ──► service บันทึกจริง ──► learn คำ (L3)
      │  ผู้ใช้กด ❌
      ├──────────────────────────────► cancelled
      │  เกิน PENDING_EXPIRE_HOURS (cleanup)
      └──────────────────────────────► expired
```

**ข้อกำหนด:**

- `payload` เก็บ args ที่ผ่าน Zod และแปลงแล้ว (สตางค์, วันที่จริง, category_id) → ตอนยืนยันไม่ต้องเรียก AI ซ้ำ
- `confirm` MUST "จอง" แถวแบบ atomic: `update ... set status='confirmed' where id=? and user_id=? and status='waiting' and expires_at > now() returning *` → ไม่ได้แถวกลับมา = กดซ้ำหรือหมดอายุ ตอบว่าดำเนินการไปแล้ว
- ถ้าบันทึกจริงล้มเหลวหลังจอง → คืนสถานะเป็น `waiting` แล้วตอบ errorCard
- batch ใช้ insert array ครั้งเดียว (1 statement = สำเร็จหรือล้มทั้งหมด)
- `update_transaction` / `delete_transaction` ต้องแสดง "ก่อน → หลัง" ใน pendingCard
- ข้อความใหม่ของผู้ใช้ไม่ยกเลิก pending เดิมอัตโนมัติ (มีได้หลายรายการพร้อมกัน)

---

### S13 — Push & Quota

**ไฟล์:** `src/line/push.ts`, `src/services/quota.service.ts` / **ผู้รับผิดชอบ:** ① / **สัปดาห์:** W2

- push ทุกครั้ง MUST ผ่าน `quota.service` → นับ `push_log` เดือนนี้ (เวลาไทย) ≥ `PUSH_LIMIT` → ไม่ส่ง
- push ทุกครั้ง MUST มี `dedup_key` (เช่น `daily:2026-09-11:<user_id>`) — insert ชน unique = เคยส่งแล้ว ข้าม
- ลำดับความสำคัญ: ① งบเกิน 100% ② แผนหลุดเป้า/ครบเป้า ③ งบ 80% ④ สรุปรายวัน — เมื่อโควตาเหลือน้อยกว่า 20% ให้ส่งเฉพาะ ① และ ②
- สรุปรายวันเป็น opt-in: 280 ÷ 30 วัน ≈ ส่งได้แค่ ~9 คนต่อวันถ้าใช้โควตาทั้งหมดกับงานนี้

---

## 4. รายการฟีเจอร์

### P0 — ต้องมี (ขาดไม่ได้)

| # | ฟีเจอร์ | โมดูล |
|---|---|---|
| 1 | บันทึกผ่านแชทแบบทางด่วน (L1-L3) + ↩️ ยกเลิก / ✏️ แก้หมวด | S1, S4 |
| 2 | หมวดเริ่มต้น + ข้อความต้อนรับ | S1 |
| 3 | คำสั่ง สรุป / เหลือ / ยกเลิก / ช่วยเหลือ | S1, S5 |
| 4 | Safe-to-spend (S5.2) | S5 |
| 5 | Gemini 8 tools + pending flow | S11, S12 |
| 6 | Recurring rules + job | S5, S7 |
| 7 | Push quota | S13 |
| 8 | ทุกข้อข้างบนทำงานได้เมื่อ `AI_ENABLED=false` (ยกเว้นข้อ 5) | ทุกโมดูล |

### P1 — ควรมี

| # | ฟีเจอร์ | โมดูล |
|---|---|---|
| 9 | แผนออม 3 ทางเลือก + cold-start + คำสั่ง แผน / ออม | S5 |
| 10 | อ่านสลิป | S9 |
| 11 | LIFF 5 หน้า | S2, S3 |
| 12 | งบรายหมวด 80% / 100% | S5 |
| 13 | สรุปรายวัน (opt-in) | S7 |
| 14 | ติดตามแผน + replan | S5, S7 |
| 15 | Rich Menu | S1 |

### P2 — มีก็ดี

| # | ฟีเจอร์ | โมดูล |
|---|---|---|
| 16 | อีเมลธนาคาร (K PLUS) | S8 |
| 17 | กันรายการซ้ำข้ามช่องทาง | S10 |
| 18 | จำลองการซื้อ (simulateImpact) | S5 |
| 19 | กราฟแนวโน้ม 6 เดือน | S2 |
| 20 | Rate limit ของ `/api` (ต้องเพิ่ม dependency — ขออนุมัติก่อน) | S3 |

---

## 5. แผนงาน 4 สัปดาห์

| สัปดาห์ | เป้าหมาย | เสร็จเมื่อ |
|---|---|---|
| W1 | ฐาน + ทางด่วน | schema รันแล้ว / webhook ตรวจลายเซ็น + idempotent / `กาแฟ 80`, `ข้าว60`, `+เงินเดือน 35000` ลง DB จริง + confirmCard + ↩️ ยกเลิก / test money + regexParser ผ่าน |
| W2 | AI อย่างปลอดภัย | guard + 8 tools + pending flow / สรุป, เหลือ / recurring job / quota + push / test thaiNumber, thaiDate, redact ผ่าน |
| W3 | ฟีเจอร์เด่น | แผนออม + cold-start / สลิป / งบ / LIFF 5 หน้า / dailySummary / planCheck |
| W4 | ครบวงจร + ทดสอบ | อีเมล + dedup / test ครบ / docs / ทดสอบ `AI_ENABLED=false` ทั้งแอป / ใช้งานจริงในทีม |

**ด่านบังคับ:** ห้ามต่อ Gemini (W2) จนกว่าเกณฑ์ W1 ผ่าน — ทางด่วนต้องแข็งแรงก่อน
**ถ้าล่าช้า:** ตัด P2 ก่อน แล้วค่อย P1 / ห้ามตัด P0, test ของ S5 และ security ระดับ 🔴

---

## 6. ทีม

| สมาชิก | บทบาท | ดูแล |
|---|---|---|
| ① | Bot Core | S1 webhook/reply/push, S3.1 liffAuth, S7 jobs route + cleanup, S13, redact, logger, deploy, security review |
| ② | Database | S6 schema, S5 summary/budget/recurring, S12, money utils, followHandler, types |
| ③ | AI | S4 parser ทั้งหมด, S11 (ยกเว้น vision), S5 plan.service, planCheck |
| ④ | Frontend | S2 LIFF, S3.2 api.ts, Flex ทั้งหมด, Rich Menu, postbackHandler |
| ⑤ | Integration | S8, S9, S10, tests + fixtures, docs |

**จุดประสานงานสำคัญ:**

- ② ↔ ④ ตกลงรูปแบบ JSON ของ `/api/*` ภายใน W1 (เงินเป็นสตางค์)
- ③ เป็นเจ้าของโควตา AI — ใครจะเพิ่มการเรียก AI ต้องให้ ③ review
- ② ↔ ③ สูตรใน S5 เปลี่ยนได้เมื่อทั้งคู่ตกลงและแก้ SPEC + test พร้อมกัน

---

## 7. แนวปฏิบัติทางวิศวกรรม

**Git:** `main` (ป้องกัน) ← `dev` ← `feat/*`, `fix/*` / Conventional Commits / merge ต้องมีคน approve 1 คน + `npm test` และ `npm run typecheck` ผ่าน

**โค้ด:** TypeScript `strict: true` / เงินเป็นสตางค์ผ่าน `utils/money.ts` / comment ภาษาไทย อ้างกฎ (G1-G7) หรือหัวข้อ SPEC

**Test (vitest):**

- ห้ามเรียก Gemini จริงใน test — mock เสมอ
- ต้องมี test: `regexParser`, `thaiNumber`, `thaiDate`, `money`, `redact`, `plan.service`, `summary.service`
- `tests/fixtures/messages.json` อย่างน้อย 30 ข้อความ ข้อความที่ควรจบที่ L1 ต้องได้ผลถูก ≥ 90%
- test ความแม่นยำเงิน: บวก ฿0.10 จำนวน 10,000 ครั้ง ต้องได้ ฿1,000.00 เป๊ะ
- test ความสม่ำเสมอ: เรียก `getDailySafeToSpend` และ `createSavingPlan` ด้วยข้อมูลเดิม 100 ครั้ง ต้องได้ผลเหมือนกันทุกครั้ง

**Environment variables:**

```bash
PORT=3000
NODE_ENV=development
TZ=Asia/Bangkok

LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_LOGIN_CHANNEL_ID=
LIFF_ID=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # server เท่านั้น

AI_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=
AI_DAILY_LIMIT_PER_USER=30
AI_DAILY_LIMIT_GLOBAL=
AI_TIMEOUT_MS=8000

PUSH_LIMIT=280
CRON_SECRET=

GMAIL_USER=
GMAIL_APP_PASSWORD=
```

`.env.example` MUST อยู่ใน repo / `.env` MUST NOT อยู่ใน repo

**ค่าคงที่ (`src/config/constants.ts`):**

| ชื่อ | ค่า |
|---|---|
| `TIMEZONE` | `'Asia/Bangkok'` |
| `PUSH_LIMIT` | 280 |
| `MAX_ACTIVE_PLANS` | 3 |
| `PLAN_SAFETY_RATIO` | 0.8 |
| `EMERGENCY_BUFFER` | 0.15 |
| `MAX_AMOUNT_SATANG` | 1,000,000,000 (10 ล้านบาท) |
| `PENDING_EXPIRE_HOURS` | 24 |
| `DEDUP_WINDOW_MINUTES` | 30 |
| `CHAT_HISTORY_TURNS` | 3 |
| `COLD_START` | `{ LOW_UNDER_DAYS: 7, MEDIUM_UNDER_DAYS: 90 }` |
| `AI_DISCLAIMER` | `'ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน'` |

---

## 8. ความปลอดภัย

| ID | ข้อกำหนด | ระดับ |
|---|---|---|
| SEC-1 | ตรวจ `x-line-signature` ทุก webhook | 🔴 วิกฤต |
| SEC-2 | webhook idempotent ด้วย `webhookEventId` | 🟠 สูง |
| SEC-3 | ตรวจ LIFF ID token ที่ฝั่ง server ทุก request ของ `/api` | 🔴 วิกฤต |
| SEC-4 | ไม่เชื่อ userId จาก client ใด ๆ | 🔴 วิกฤต |
| SEC-5 | ทุก query กรอง `user_id` (service role ข้าม RLS) | 🔴 วิกฤต |
| SEC-6 | เปิด RLS ทุกตารางโดยไม่มี policy | 🟠 สูง |
| SEC-7 | `SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, secret อื่น อยู่ฝั่ง server เท่านั้น | 🔴 วิกฤต |
| SEC-8 | `/jobs/*` ตรวจ `CRON_SECRET` แบบ timing-safe | 🟠 สูง |
| SEC-9 | อีเมลต้องผ่าน DKIM + whitelist โดเมนธนาคาร | 🔴 วิกฤต |
| SEC-10 | `email_ingest_token` สุ่ม ≥ 16 bytes และเปลี่ยนใหม่ได้ | 🟠 สูง |
| SEC-11 | redact ข้อมูลส่วนตัวก่อนส่ง AI และก่อนเขียน log | 🔴 วิกฤต |
| SEC-12 | ไม่ส่งรายการธุรกรรมดิบให้ AI | 🔴 วิกฤต |
| SEC-13 | args/JSON จาก AI ผ่าน Zod ก่อนใช้ทุกครั้ง | 🔴 วิกฤต |
| SEC-14 | ผลจาก AI ที่เขียนข้อมูล ต้องผ่านการยืนยันของผู้ใช้ | 🔴 วิกฤต |
| SEC-15 | ผู้ใช้ปิด AI ได้ทุกเมื่อ | 🟠 สูง |
| SEC-16 | LIFF ห้ามเก็บ token ใน localStorage | 🟠 สูง |
| SEC-17 | ไม่เก็บไฟล์รูปสลิป | 🟠 สูง |
| SEC-18 | ห้าม commit อีเมล/สลิป/ข้อมูลการเงินจริง | 🔴 วิกฤต |
| SEC-19 | rate limit `/api` 60 ครั้ง/นาที/คน | 🟡 กลาง (P2) |

---

## 9. ความเสี่ยงและการรับมือ

| ความเสี่ยง | ผลกระทบ | การรับมือ |
|---|---|---|
| Gemini เข้าใจผิด | ข้อมูลผิด | pending + ผู้ใช้ยืนยัน + Zod + sanity |
| Gemini ล่ม / โควตาหมด | ใช้ภาษาธรรมชาติไม่ได้ | guard ปฏิเสธ → ทางด่วนและคำสั่งตายตัวยังใช้ได้ (G4) |
| ทีมพึ่ง AI จนทางด่วนอ่อน | โควตาหมดเร็ว | ด่านบังคับ W1 + วงจรเรียนรู้ L3 + ดูสัดส่วน L4 จาก ai_usage_log ทุกสัปดาห์ |
| push เกินโควตา | แจ้งเตือนหยุด | reply-first, quota.service, dedup_key, สรุปรายวันเป็น opt-in |
| Render free หลับ | webhook ช้า/หลุด | ping ทุก 10 นาที + ตอบ 200 ก่อนประมวลผล |
| GitHub Actions รันช้า/ไม่รัน | cron พลาด | node-cron เป็นหลัก + ทุกงาน idempotent + recurring ตามทันย้อนหลัง |
| Supabase free หยุดโปรเจกต์เมื่อไม่มีการใช้งานนาน | ระบบล่ม | cron รายวันแตะ DB ทุกวันอยู่แล้ว / ตรวจสถานะโปรเจกต์ใน dashboard สัปดาห์ละครั้ง |
| ลืมกรอง user_id | ข้อมูลรั่ว | กฎ G6 + checklist ใน code review + test ที่เรียกข้อมูลของอีกคน |
| เวลาเพี้ยน (UTC vs ไทย) | สรุปผิดวัน | dayjs timezone, `at time zone` ใน SQL, test ข้ามเที่ยงคืน |
| ธนาคารเปลี่ยนรูปแบบอีเมล | อีเมลอ่านไม่ออก | `parsed=false` แจ้งใน dailySummary + `body_redacted` สำหรับ parse ใหม่ |
| รายการซ้ำระหว่างแชท/สลิป/อีเมล | ยอดเกินจริง | S10 |
| สลิปมีข้อมูลส่วนตัว | ความเป็นส่วนตัว | ไม่เก็บรูป, ไม่ขอเลขบัญชี, แจ้งผู้ใช้, ผู้ใช้ปิด AI ได้ |
| ผู้ใช้ใหม่ข้อมูลน้อย | แผนไม่แม่น | cold-start + ป้ายความมั่นใจ |

---

## 10. เกณฑ์ความสำเร็จ

เมื่อจบสัปดาห์ที่ 4 โปรเจกต์ถือว่าสำเร็จเมื่อ:

1. บันทึกได้ครบ 3 ช่องทาง: แชท, สลิป, อีเมล
2. ตั้ง `AI_ENABLED=false` แล้ว ฟีเจอร์ P0 ทุกข้อ (ยกเว้น Gemini tools) และ LIFF ยังใช้ได้
3. ไม่มีรายการใดที่ AI สร้าง แก้ หรือลบ โดยไม่มีคนกดยืนยัน
4. ตัวเลขทุกตัวที่ผู้ใช้เห็นมาจาก S5 และเรียกซ้ำด้วยข้อมูลเดิมได้ผลเดิม
5. รายการเดียวกันจากแชทและอีเมลไม่ถูกนับซ้ำ
6. push ทั้งเดือนไม่เกิน `PUSH_LIMIT`
7. สมาชิกทีมอย่างน้อย 5 คนใช้ระบบกับข้อมูลจริงต่อเนื่องอย่างน้อย 1 สัปดาห์
8. `npm test` ผ่านทั้งหมด และไม่มี secret ใน repo
9. ความปลอดภัยระดับ 🔴 ทุกข้อทำครบและผ่านการ review

---

## ภาคผนวก A — อภิธานศัพท์

| คำ | ความหมาย |
|---|---|
| ทางด่วน | การบันทึกผ่าน L1-L3 ที่ไม่ใช้ AI บันทึกทันทีพร้อมปุ่มยกเลิก |
| Pending action | คำขอเขียนข้อมูลจาก AI หรือสลิปที่รอผู้ใช้กดยืนยัน |
| Safe-to-spend | เงินที่ใช้ได้ต่อวันจนถึงสิ้นเดือน หลังหักรายการประจำและยอดออมตามแผน (S5.2) |
| disposable | เงินที่ย้ายไปออมได้ต่อเดือนโดยไม่กระทบรายจ่ายจำเป็น (S5.3) |
| capacity | disposable × 0.8 ลบยอดออมของแผน active เดิม |
| Cold-start | ช่วงที่ผู้ใช้เพิ่งเริ่มใช้และข้อมูลยังน้อย (S5.5) |
| Guard | ด่านตรวจก่อนเรียก AI ทุกครั้ง (S11.1) |
| Redact | การปิดข้อมูลส่วนตัว เช่น เลขบัญชี เหลือแค่ 4 ตัวท้าย |
| Idempotent | ทำซ้ำกี่ครั้งผลก็เหมือนทำครั้งเดียว |
| Soft delete | ลบโดยตั้ง `deleted_at` ข้อมูลยังอยู่ กู้คืนได้ |
| สตางค์ | หน่วยเงินในโค้ด (1 บาท = 100 สตางค์) เป็นจำนวนเต็มเสมอ |
| L1-L4 | ชั้นของตัวแปลงข้อความ (S4) |
| Reply / Push | ข้อความตอบกลับ (ฟรี) / ข้อความส่งเอง (มีโควตา) |

---

## ภาคผนวก B — ตารางตัดสินใจเรื่อง AI

| งาน | ใช้ AI? | เหตุผล |
|---|---|---|
| จด `กาแฟ 80` | ❌ | regex เร็วและฟรี |
| จดข้อความซับซ้อน / หลายรายการแบบเล่าเรื่อง | ✅ T1 | ภาษาคนหลากหลายเกินกว่า regex |
| เข้าใจคำถาม "เดือนนี้ใช้ไปเท่าไหร่" | ✅ T1 (เลือก tool) | ส่วนตัวเลขมาจาก S5 |
| หารค่าข้าว | ⚠️ AI ดึงตัวเลข / โค้ดหาร | การหารคือการคำนวณ (G1) |
| แปลงวันที่ "ศุกร์ที่แล้ว" | ❌ thaiDate | ต้องแม่นยำและทดสอบได้ |
| เดาหมวด | ⚠️ พจนานุกรมก่อน AI เฉพาะที่ไม่เจอ | ฟรีและเรียนรู้ได้ |
| อ่านสลิป | ✅ T2 | รูปแบบสลิปหลากหลาย |
| อ่านอีเมลธนาคาร | ❌ regex | รูปแบบคงที่ แม่นยำ 100% |
| สรุป / safe-to-spend / แผนออม / งบ | ❌ | ต้องได้ผลเดิมทุกครั้ง |
| กันรายการซ้ำ | ❌ | ต้องตรวจสอบย้อนหลังได้ |
| แต่งประโยคสรุปตัวเลข | ❌ | ไม่คุ้มโควตา ใช้ Flex template แทน |

---

## ภาคผนวก C — ที่มาของเวอร์ชันนี้

| มาจาก | สิ่งที่นำมา |
|---|---|
| Prompt AI | stack (Express, Supabase, Gemini, LIFF, Render, Vercel), ทีม ①-⑤, แผน 4 สัปดาห์, 8 tools, สูตรแผนออม, อ่านสลิป, อีเมล IMAP, push quota, Rich Menu |
| Cashcast V2 | AI ไม่คิดเลข, pending + ยืนยัน, เงินเป็น numeric/สตางค์, ตัวแปลง 4 ชั้น + เรียนรู้, guard layer, redact, AI_ENABLED=false, dedup, soft delete, safe-to-spend, cold-start, DKIM + ingest token, idempotent jobs, test |
| ใหม่ในเวอร์ชันนี้ | pending_actions แยกตาราง, tool ไม่ส่งผลกลับเข้า AI, `split_count` / `date_text`, safe-to-spend ที่หักยอดออมตามแผน, 3 ทางเลือกแบบกำหนดสูตรตายตัว, Gmail plus-address แทน Cloudflare |
| ตั้งใจไม่เอา | Next.js, Prisma, เว็บแอป + LINE Login, Cloudflare Worker, Python Monte Carlo, seasonality, Sentry, ai_cache, AI แต่งประโยค (T4/T5 ของ V2) |

---

*เวอร์ชันเอกสาร: 3.0 — 2026-09-11*
*คู่กับ: `AIDO.md` v3.0 และ `Prompt_AI_Agent_v3.md`*
*แก้ไฟล์นี้เมื่อไหร่ ให้ตรวจ `AIDO.md`, `docs/RULES.md` และ test ที่เกี่ยวข้องให้ตรงกันเสมอ*
