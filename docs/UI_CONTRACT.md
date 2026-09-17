# สัญญาระหว่างหน้าเว็บกับ backend

เอกสารสำหรับคนทำ UI — บอกว่ามีข้อมูลอะไรให้ใช้บ้าง หน้าตาเป็นยังไง และมีข้อไหนห้ามแตะ
เพื่อจะได้ออกแบบโดยไม่ต้องไล่อ่านโค้ด backend

> อัปเดตล่าสุด: 17 ก.ย. 2026 — ตรวจกับโค้ดจริงใน `src/routes/api.ts`

---

## เริ่มจากตรงนี้

`backend` กับ `web/` แยกขาดกันสมบูรณ์ — `src/` ไม่รู้จักหน้าเว็บเลย
เปลี่ยน UI ยังไงก็ไม่ต้องแตะ backend

**เก็บไฟล์เดียว: `web/js/api.js`** ยกไปใช้ได้ทั้งไฟล์ จัดการ cookie / error / 401 ให้แล้ว

```js
const summary = await window.moneyBotApi.fetchSummary();
const plans   = await window.moneyBotApi.fetchPlans();
```

ส่วน `app.js` / `boot.js` / `mock-data.js` เป็นโค้ดสมัยยังใช้ข้อมูลจำลอง **ทิ้งได้เลย**

---

## ⚠️ 5 ข้อที่ต้องรักษาไว้

### 1. ไฟล์ต้องอยู่ใน `web/` โดเมนเดียวกับ backend
`express.static` ชี้มาที่โฟลเดอร์นี้ ถ้าแยกไป host ที่อื่น session cookie จะกลายเป็น
third-party cookie ซึ่ง Safari บล็อกโดยปริยาย = ผู้ใช้บางกลุ่มล็อกอินค้างไม่ได้แบบพังเงียบ

### 2. ต้องมี `web/index.html`
`/auth/callback` redirect มาที่ `/` เสมอ พร้อม query ที่ควรเอาไปแสดง:

| query | ความหมาย | ควรแสดง |
|---|---|---|
| `?login=no-account` | ล็อกอิน LINE ผ่าน แต่ยังไม่เคยแอดเพื่อนบอท | "ต้องแอดเพื่อนบอทใน LINE ก่อน" |
| `?login=cancelled` | ผู้ใช้กดยกเลิกตอนล็อกอิน | แถบเตือนเบาๆ |
| ไม่มี query | ล็อกอินสำเร็จ | ปกติ |

### 3. ทุก request ต้องมี `credentials: 'same-origin'`
ไม่ใส่ = เบราว์เซอร์บางตัวไม่แนบ cookie → ได้ 401 ทั้งที่ล็อกอินอยู่
(`api.js` ใส่ไว้ให้แล้ว)

### 4. เงินเป็น "สตางค์" (integer) ทุกจุด ⚖️ G3
API รับ-ส่งเป็นจำนวนเต็มสตางค์เสมอ **หาร 100 เฉพาะตอนแสดงผล**

```js
// ✅ ถูก
const text = new Intl.NumberFormat('th-TH', {
  style: 'currency', currency: 'THB', minimumFractionDigits: 2,
}).format(satang / 100);

// ❌ ผิด — เก็บเป็นทศนิยมแล้วบวกกันจะได้ 0.30000000000000004
let total = 0.1 + 0.2;
```

ตอนรับค่าจากผู้ใช้: `Math.round(parseFloat(baht) * 100)`

### 5. ห้ามคำนวณเงินในหน้าเว็บ ⚖️ G1
ทุกตัวเลขต้องมาจาก API — ห้ามคิดเปอร์เซ็นต์ ค่าเฉลี่ย หรือยอดคงเหลือเอง

UI ชุดเดิมเคยคิด `target * 0.18` เองเพื่อเดายอดออมต่อเดือน ซึ่งไม่ตรงกับกำลังออมจริง
ของผู้ใช้เลย ตัวเลขพวกนี้มี service คำนวณให้แล้วทั้งหมด

**ข้อยกเว้นเดียว:** คำนวณเพื่อ "แสดงผล" ล้วนๆ ได้ เช่น ความกว้างของแถบ progress

---

## การล็อกอิน

```
ยังไม่ล็อกอิน → GET /api/me ตอบ 401
              → พาไป <a href="/auth/login">  (ห้าม redirect อัตโนมัติ เดี๋ยววนลูป)
              → LINE Login → /auth/callback → กลับมาที่ /
ล็อกอินแล้ว   → cookie ชื่อ jodtang_session ถูกแนบให้เองทุก request (httpOnly อ่านจาก JS ไม่ได้)
ออกจากระบบ    → POST /auth/logout
```

อายุ session **7 วัน** หมดอายุแล้วทุก endpoint จะตอบ 401 → ควรแสดงปุ่มเข้าสู่ระบบใหม่

---

## ตารางสรุป endpoint

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/api/me` | ผู้ใช้ที่ล็อกอินอยู่ |
| GET | `/api/summary` | ยอดรวม + กราฟ |
| GET | `/api/transactions?limit=` | รายการเงิน (สูงสุด 200) |
| POST | `/api/transactions` | บันทึกรายการใหม่ |
| PATCH | `/api/transactions/:id` | แก้รายการ |
| DELETE | `/api/transactions/:id` | ลบ (soft delete) |
| POST | `/api/transactions/:id/restore` | กู้คืนที่ลบไป |
| GET | `/api/categories` | หมวดของผู้ใช้ |
| GET | `/api/budgets?month=` | งบรายหมวด + ยอดใช้ |
| PUT | `/api/budgets/:categoryId` | ตั้ง/แก้งบ |
| DELETE | `/api/budgets/:categoryId` | ยกเลิกงบ |
| GET | `/api/plans` | แผนออม + กำลังออม |
| GET | `/api/plans/capacity` | กำลังออมอย่างเดียว |
| POST | `/api/plans` | สร้าง 3 ทางเลือก (เป็น draft) |
| POST | `/api/plans/:planId/confirm` | ยืนยันแผน |
| DELETE | `/api/plans/:planId` | ยกเลิกแผน |
| GET | `/api/recurring` | รายการประจำ |
| POST | `/api/recurring` | เพิ่มรายการประจำ |
| DELETE | `/api/recurring/:ruleId` | ลบรายการประจำ |
| GET | `/api/settings` | ที่อยู่อีเมล forward |
| POST | `/api/settings/email-token/rotate` | สร้าง token ใหม่ |
| GET | `/health` | สถานะระบบ (ไม่ต้องล็อกอิน) |

---

## รายละเอียดแต่ละ endpoint

### `GET /api/me`
```json
{ "userId": "bf2c147b-...", "displayName": "Teerat", "pictureUrl": "https://..." }
```
`displayName` / `pictureUrl` มาจาก LINE ตอนล็อกอิน เป็น `null` ได้

---

### `GET /api/summary`
```json
{
  "monthIncomeSatang": 0,
  "monthExpenseSatang": 13100,
  "netBalanceSatang": -13100,
  "transactionCount": 3,
  "expenseByCategory": [
    { "categoryId": "…", "name": "กาแฟ", "amountSatang": 13000 },
    { "categoryId": null, "name": "ไม่ระบุหมวด", "amountSatang": 100 }
  ],
  "monthlyTrend": [
    { "month": "2026-04", "label": "เม.ย.", "incomeSatang": 0, "expenseSatang": 0 }
  ],
  "unavailable": ["safeToSpend", "confidence"]
}
```

- `expenseByCategory` เรียงมากไปน้อยแล้ว `categoryId` เป็น `null` ได้ (รายการที่ไม่มีหมวด)
- `monthlyTrend` มี **6 เดือนเสมอ** เรียงเก่า→ใหม่ เดือนที่ไม่มีรายการเป็น 0 (ไม่หายไปจากกราฟ)
- `netBalanceSatang` **ติดลบได้**
- **`unavailable`** = ชื่อตัวเลขที่ยังไม่มี service คำนวณ → ต้องแสดงว่า "ยังไม่มีข้อมูล"
  **ห้ามแสดงเป็น ฿0** เพราะผู้ใช้จะอ่านว่า "ฉันมีเงินศูนย์บาท"

---

### `GET /api/transactions?limit=100`
คืน **array** ตรงๆ (ไม่ได้ห่อ object) เรียงใหม่→เก่า สูงสุด 200

```json
[{
  "id": "657a7e0a-…",
  "title": "โอนเงินพร้อมเพย์",
  "type": "expense",
  "amountSatang": 100,
  "category": null,
  "emoji": null,
  "occurredAt": "2026-09-17T07:26:14+00:00",
  "parsedBy": "regex",
  "source": "email"
}]
```

| ฟิลด์ | ค่าที่เป็นไปได้ |
|---|---|
| `type` | `income` · `expense` · `transfer` |
| `source` | `chat` · `image` · `email` · `recurring` · `liff` |
| `parsedBy` | `regex` · `dictionary` · `learned` · `ai` · `manual` · `null` |

- **`amountSatang` เป็นบวกเสมอ** ไม่ว่าจะรายรับหรือรายจ่าย — ดูทิศทางจาก `type`
  ถ้า UI อยากใส่เครื่องหมายลบต้องทำเองตอนแสดงผล
- `title` = สิ่งที่ผู้ใช้พิมพ์ / ชื่อประเภทรายการจากอีเมลธนาคาร / `"ไม่ระบุ"`
- `category` กับ `emoji` เป็น `null` ได้ (รายการจากอีเมลยังไม่มีหมวด)
- `occurredAt` เป็น ISO timestamp — **แปลงเป็นเวลาไทยก่อนแสดงเสมอ**
  ```js
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', … })
  ```
- ⚖️ G7: `transfer` ไม่นับเป็นทั้งรายรับและรายจ่าย — ถ้าทำหน้าสรุปเองต้องกรองออก

---

### `POST /api/transactions`
```json
{ "type": "expense", "amountSatang": 8000,
  "categoryName": "กาแฟ", "note": "ลาเต้", "occurredAt": "2026-09-17T10:00:00+07:00" }
```
`categoryName` · `note` · `occurredAt` ไม่ส่งก็ได้ (ไม่ส่งวันเวลา = ตอนนี้)
หมวดที่ยังไม่มีจะถูกสร้างให้อัตโนมัติ / คืน **201**:

```json
{ "id": "…", "amountSatang": 8000, "type": "expense",
  "occurredAt": "…", "budgetAlert": null }
```

**`budgetAlert`** มีค่าเมื่อรายการนี้ทำให้ข้ามเกณฑ์งบพอดี — ควรแสดงให้ผู้ใช้เห็นทันที:
```json
{ "categoryId": "…", "categoryName": "อาหาร", "emoji": "🍜",
  "limitSatang": 300000, "spentSatang": 250000,
  "percentUsed": 83.3, "threshold": 80 }
```
`threshold` เป็น `80` หรือ `100` / **เตือนระดับละครั้งเดียวต่อเดือน** ถ้าเป็น `null` คือยังไม่ถึงเกณฑ์หรือเตือนไปแล้ว

### `PATCH /api/transactions/:id`
ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยน — ฟิลด์ที่ไม่ส่งจะไม่ถูกแตะ

```json
{ "amountSatang": 12000 }
{ "categoryName": null }          // ล้างหมวดออก
{ "type": "income", "categoryName": "เงินเดือน" }
```
คืนรูปแบบเดียวกับ POST (มี `budgetAlert` ด้วย)

- ไม่ส่งฟิลด์ไหนมาเลย → **400**
- ย้ายประเภทเป็น `income`/`expense` ได้ แต่ **`transfer` ยังไม่รองรับ** → 400
- แก้รายการที่ถูกลบไปแล้วไม่ได้ → 404 (ต้อง `/restore` ก่อน)

### `DELETE /api/transactions/:id`
→ `{ "removed": true }`

เป็น **soft delete** — ข้อมูลยังอยู่ กู้คืนได้ และหายจากทุกยอดรวมทันที
ลบซ้ำ → 404

### `POST /api/transactions/:id/restore`
→ `{ "restored": true }`

ควรทำปุ่ม **"เลิกทำ"** ค้างไว้สักครู่หลังผู้ใช้กดลบ แทนการถามยืนยันก่อนลบทุกครั้ง

---

### `GET /api/categories`
```json
[{ "id": "…", "name": "อาหาร", "type": "expense",
   "emoji": "🍜", "isEssential": true, "isDefault": true }]
```
เรียงหมวดตั้งต้นขึ้นก่อน แล้วตามด้วยชื่อ / `isEssential` ใช้ในสูตรแผนออม

---

### `GET /api/budgets?month=2026-09`
ไม่ส่ง `month` = เดือนปัจจุบัน / รูปแบบผิด → 400

```json
{
  "month": "2026-09-01",
  "items": [{
    "budgetId": "…", "categoryId": "…", "categoryName": "อาหาร", "emoji": "🍜",
    "limitSatang": 300000, "spentSatang": 150050, "remainingSatang": 149950,
    "percentUsed": 50, "level": "ok", "alerted80": false, "alerted100": false
  }],
  "totalLimitSatang": 300000,
  "totalSpentSatang": 150050,
  "available": true
}
```

- `level`: `ok` (<80%) · `warning` (80–99%) · `over` (≥100%)
- `remainingSatang` **ติดลบได้** ถ้าใช้เกินงบ
- `percentUsed` ปัดทศนิยม 1 ตำแหน่ง
- `totalSpentSatang` นับ **เฉพาะหมวดที่ตั้งงบไว้** ไม่รวมหมวดอื่น —
  ถ้าเอายอดใช้ทั้งเดือนมาหารด้วยเพดานของบางหมวด เปอร์เซ็นต์จะทะลุ 100% ทั้งที่ยังไม่เกินงบ
- `items` ว่าง = ยังไม่เคยตั้งงบ → แสดง "ยังไม่ได้ตั้งงบประมาณ" ไม่ใช่ ฿0

### `PUT /api/budgets/:categoryId`
```json
{ "limitSatang": 300000, "month": "2026-09" }
```
คืน `BudgetStatus` ก้อนเดียวแบบใน `items` / ตั้งได้เฉพาะหมวดรายจ่าย
ตั้งใหม่ = รีเซ็ตธงเตือน 80%/100% ให้เตือนได้อีกรอบ

### `DELETE /api/budgets/:categoryId?month=2026-09`
```json
{ "removed": true }
```

---

### `GET /api/plans`
```json
{
  "items": [{
    "planId": "…", "title": "⚡ เร็ว — iPhone",
    "status": "active", "confidence": "high",
    "targetSatang": 3000000, "monthlySaveSatang": 372000, "targetDate": "2027-06-14",
    "savedSatang": 150000, "remainingSatang": 2850000, "percentComplete": 5,
    "expectedSatang": 300000, "offTrack": true, "reachedTarget": false,
    "daysSinceStart": 30
  }],
  "capacity": { … ดูข้างล่าง … },
  "available": true
}
```

| ฟิลด์ | ความหมาย |
|---|---|
| `status` | `draft` (ยังไม่ยืนยัน) · `active` · `completed` · `cancelled` |
| `confidence` | `low` 🔴 ประมาณการเบื้องต้น · `medium` 🟡 ปานกลาง · `high` 🟢 สูง |
| `expectedSatang` | เป้าสะสม ณ วันนี้ — เอาไปเทียบกับ `savedSatang` ได้ |
| `offTrack` | ออมช้ากว่าเป้า ≥14 วันแล้ว |

> **`confidence` ต้องแสดงบนการ์ดแผนทุกใบ** (บังคับตาม SPEC §S5.5)
> และทุกหน้าที่แสดงเนื้อหาเชิงวางแผนต้องมีข้อความ
> *"ℹ️ ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน"*

`draft` ไม่ควรปนอยู่ในรายการแผนหลัก — เป็นทางเลือกที่ยังไม่ได้เลือก

---

### `GET /api/plans/capacity`
```json
{
  "disposableSatang": 465000,
  "capacitySatang": 372000,
  "committedSatang": 0,
  "activePlanCount": 0,
  "confidence": "high",
  "daysOfData": 90,
  "breakdown": {
    "avgIncomeSatang": 1500000,
    "recurringTotalSatang": 400000,
    "avgEssentialSatang": 500000,
    "avgExpenseSatang": 900000,
    "emergencyBufferSatang": 135000
  },
  "canCreatePlan": true,
  "reason": null
}
```

`capacitySatang` = ออมเพิ่มได้อีกเดือนละเท่าไหร่
`canCreatePlan: false` → **แสดง `reason` ตรงๆ** (เป็นข้อความไทยที่มีตัวเลขจับต้องได้แล้ว)
และไม่ต้องให้ผู้ใช้กรอกฟอร์มไปเปล่าๆ

แนะนำให้กาง `breakdown` ให้ผู้ใช้เห็นด้วย — เลขที่บอกว่า "ออมได้เดือนละเท่านี้" ควรตรวจย้อนได้

### `POST /api/plans`
```json
{ "title": "iPhone", "targetSatang": 3000000, "months": 12 }
```
`months` ไม่ส่งก็ได้

```json
{
  "options": [{
    "planId": "…", "kind": "fast", "title": "⚡ เร็ว — iPhone", "emoji": "⚡",
    "targetSatang": 3000000, "monthlySaveSatang": 372000,
    "months": 9, "targetDate": "2027-06-14", "confidence": "high"
  }],
  "capacity": { … },
  "requestedMonthsNote": null
}
```

- `kind`: `fast` ⚡ · `balanced` ⚖️ · `relaxed` 🌿
- **อาจได้น้อยกว่า 3 ทางเลือก** — ตัวที่ออมได้ต่ำกว่า ฿100/เดือน ถูกซ่อน
- `requestedMonthsNote` มีค่าเมื่อผู้ใช้ระบุเวลาแล้วทำไม่ไหว → แสดงข้อความนั้นให้เห็น
- ทุกทางเลือกถูกบันทึกเป็น `draft` และ **draft ชุดเก่าถูกยกเลิกทั้งหมด**

### `POST /api/plans/:planId/confirm`
ไม่มี body → `{ "planId": "…", "status": "active", "confirmedAt": "…" }`

ตรวจกฎซ้ำ ณ เวลาที่กด ถ้าข้อมูลเปลี่ยนจนออมไม่ไหวแล้วจะได้ **409** พร้อมเหตุผล — ต้องแสดงให้ผู้ใช้เห็น

### `DELETE /api/plans/:planId`
→ `{ "planId": "…", "status": "cancelled" }`

---

### `GET /api/recurring`
```json
{
  "items": [{
    "id": "…", "label": "ค่าหอ", "type": "expense",
    "amountSatang": 350000, "monthlySatang": 350000,
    "frequency": "monthly", "nextRun": "2026-10-01", "endDate": null,
    "categoryId": null, "categoryName": null, "emoji": null
  }],
  "available": true
}
```
`monthlySatang` = แปลงเป็นต่อเดือนแล้ว (รายสัปดาห์/รายปีจะไม่เท่ากับ `amountSatang`)

### `POST /api/recurring`
```json
{
  "label": "ค่าหอ", "type": "expense", "amountSatang": 350000,
  "frequency": "monthly", "dayOfMonth": 1, "startDate": "2026-10-01", "endDate": null
}
```
- `frequency`: `daily` · `weekly` · `monthly` · `yearly`
- `dayOfMonth` (1–31) ใช้กับ monthly / `dayOfWeek` (0=อาทิตย์) ใช้กับ weekly — ไม่ส่งจะยึดวันของ `startDate`
- `startDate` ไม่ส่ง = วันนี้ (เวลาไทย)
- คืน 201 พร้อมกฎที่สร้าง

### `DELETE /api/recurring/:ruleId`
→ `{ "removed": true }` (ปิดกฎ ไม่ได้ลบแถว เพื่อให้รายการเก่ายังตามรอยได้)

---

### `GET /api/settings`
```json
{
  "emailIngest": {
    "address": "jodtang.mfu+04593508…@gmail.com",
    "available": true,
    "unparsedCount": 0
  },
  "aiEnabled": false
}
```
`available: false` = ระบบอีเมลยังไม่เปิด → `address` เป็น `null` แสดงว่ายังใช้ไม่ได้
`unparsedCount` = อีเมลที่เก็บไว้แล้วแต่อ่านตัวเลขไม่ออก

### `POST /api/settings/email-token/rotate`
→ `{ "ok": true, "address": "…" }` — ที่อยู่เดิมใช้ไม่ได้ทันที ต้องเตือนผู้ใช้ก่อนกด

---

### `GET /health` (ไม่ต้องล็อกอิน)
```json
{ "ok": true, "service": "JOD tang",
  "features": { "bot": true, "database": true, "webLogin": true,
                "cron": true, "emailIngest": true, "ai": false },
  "notConfigured": ["ai"] }
```
ใช้ซ่อนเมนูของฟีเจอร์ที่ยังไม่ได้เปิดได้

---

## รูปแบบ error

ทุก endpoint ตอบรูปแบบเดียวกัน:
```json
{ "ok": false, "error": "งบต้องเป็นจำนวนเงินที่มากกว่า 0 บาท" }
```

| status | ความหมาย | ควรทำ |
|---|---|---|
| **400** | ค่าที่ส่งมาไม่ถูกต้อง | แสดง `error` ตรงๆ ใต้ช่องกรอก |
| **401** | ยังไม่ล็อกอิน / session หมดอายุ | แสดงปุ่มเข้าสู่ระบบ |
| **403** | Origin ไม่ตรง (กัน CSRF) | ไม่ควรเกิด ถ้าเกิดแปลว่าเสิร์ฟผิดโดเมน |
| **404** | ไม่พบของชิ้นนั้นในบัญชีผู้ใช้ | แสดง `error` |
| **409** | ทำไม่ได้ในสถานะปัจจุบัน | แสดง `error` — เป็นข้อความไทยพร้อมใช้ |
| **500** | ระบบผิดพลาด | แสดงข้อความกลาง ไม่ต้องโชว์รายละเอียด |

**ข้อความใน `error` เขียนมาให้ผู้ใช้อ่านแล้ว** เอาไปแสดงได้เลย ไม่ต้องแปลง

---

## ❌ ยังไม่มี endpoint (ห้ามออกแบบปุ่มพวกนี้ก่อนคุยกับ backend)

| ปุ่มที่อยากได้ | ต้องมี | สถานะ |
|---|---|---|
| โอนเข้าแผนออม | `POST /api/plans/:id/transfer` | ยังไม่มี (`type=transfer` ยังถูกปิดอยู่) |
| จำลองผลกระทบก่อนซื้อ | `POST /api/simulate` (§S5.7) | ยังไม่มี |
| "ใช้ได้วันละเท่าไหร่" | §S5.2 safeToSpend | ยังไม่มี — อยู่ใน `unavailable` |
| แก้ชื่อ/อีโมจิ/ลำดับ หมวด | `PATCH /api/categories/:id` | ยังไม่มี |
| สลับ "หมวดจำเป็น" | `PATCH /api/categories/:id` | ยังไม่มี |

UI ชุดปัจจุบันมีปุ่มพวกนี้อยู่ แต่แก้แค่ค่าในหน่วยความจำ — **หายทันทีที่รีเฟรช**

> ✅ เพิ่ม/แก้/ลบ รายการเงิน ทำเสร็จแล้ว (17 ก.ย. 2026) ดูหัวข้อ `POST /api/transactions` ด้านบน

---

## เช็กลิสต์ก่อนส่งงาน

- [ ] ทุก request ผ่าน `window.moneyBotApi` (มี `credentials: 'same-origin'`)
- [ ] จัดการ 401 ทุกจุด → แสดงปุ่มเข้าสู่ระบบ ไม่ redirect อัตโนมัติ
- [ ] เงินเก็บเป็นสตางค์ หาร 100 เฉพาะตอนแสดง
- [ ] ไม่มีการคำนวณเงินในหน้าเว็บ
- [ ] วันที่แปลงเป็น `Asia/Bangkok` ก่อนแสดงทุกจุด
- [ ] ค่าที่อยู่ใน `unavailable` แสดงว่า "ยังไม่มีข้อมูล" ไม่ใช่ ฿0
- [ ] การ์ดแผนทุกใบมีป้าย `confidence`
- [ ] หน้าที่มีเนื้อหาเชิงวางแผนมีข้อความ "ไม่ใช่คำแนะนำทางการเงิน"
- [ ] escape ข้อความที่ผู้ใช้พิมพ์ก่อนใส่ `innerHTML`
- [ ] หน้าจอว่าง (ยังไม่มีข้อมูล) มีข้อความบอก ไม่ใช่ปล่อยว่างเปล่า
