# JOD tang — สรุปสถานะ Frontend (v2) ส่งต่อให้ทำต่อ

> **อัปเดตล่าสุด 2026-09-19** — redesign v2 ครบทั้ง 5 หน้า และทำต่อยอดเพิ่มหลายส่วน (ดูหัวข้อ 4–5)
> เอกสารนี้เขียนใหม่ให้ตรงกับโค้ดปัจจุบัน ส่วนที่ต่างจากฉบับ 2026-09-17 อยู่ในหัวข้อ 2 (ตารางการตัดสินใจ) และหัวข้อ 7
>
> **UI ชุดนี้ถูกย้ายจาก `liff/` มาวางบน main ที่ `web/` แล้ว** — main เลิกใช้ LIFF เปลี่ยนเป็นเว็บโดเมนเดียวกับ
> backend (`express.static` เสิร์ฟ `web/`) ยังไม่ได้ต่อ API จริง ดู `docs/UI_CONTRACT.md` ประกอบ

บริบท: รื้อ UI ทั้ง 5 หน้าจากธีมเดิม (ม่วง-ชมพู, glassmorphism, dark/light toggle)
ไปเป็นธีมใหม่ (เขียวอ่อน, การ์ดขาว/ดำ/มะนาว, light mode เดียว, ไม่มี blur)
**ฟีเจอร์เดิมต้องคงไว้ครบ แค่เปลี่ยนหน้าตา** — ห้ามตัดฟังก์ชันโดยไม่ได้คุยกันก่อน

สแตก: Vanilla HTML/CSS/JS ล้วน (ห้าม framework) ตอนนี้ยังอ่าน mock data ในหน่วยความจำ ยังไม่เรียก API
โค้ดอยู่ใน `web/` — `css/style.css` (~3.7k บรรทัด), `js/app.js` (~3.9k), `js/mock-data.js`

---

## 1. สถานะสรุป

| ส่วน | สถานะ |
|---|---|
| 5 หน้า (`index`, `transactions`, `categories`, `analyze`, `settings`) | ✅ เขียนใหม่ครบ ใช้งานได้ ทดสอบบนมือถือ/แท็บเล็ต/เดสก์ท็อป ไม่มี console error |
| `css/style.css`, `js/app.js`, `js/mock-data.js` | ✅ ใช้งานได้ (mock เป็น persona นักศึกษา "แพรวา ศรีสุข") |
| `js/api.js` | ✅ ของจริงจาก main (เรียก `/api/*` ด้วย session cookie) **แต่ HTML ยังไม่โหลด** เพราะยังไม่ได้ต่อ |
| `js/charts.js` | 🔴 scaffold เปล่า ไม่มีหน้าไหนโหลด |
| ต่อ API จริง | 🔴 ยังไม่ได้ทำ — ดูรายการงานในหัวข้อ 7 |
| ข้อมูล | 🟡 mock ในหน่วยความจำ รีเฟรชแล้วรีเซ็ต (เก็บถาวรใน localStorage เฉพาะ `jodtang.settings` และ `jodtang.emergencyTileHidden`) |

## 2. การตัดสินใจด้านดีไซน์

| หัวข้อ | คำตัดสิน | หมายเหตุ |
|---|---|---|
| Theme | **Light mode อย่างเดียว** ห้ามใส่ toggle ธีมกลับมา | ปุ่มสวิตช์ในหน้าตั้งค่าเป็นของ "ผู้ช่วย AI/สรุปรายวัน" ไม่เกี่ยวกับธีม |
| โทนสี | พื้น `#f3f9ec`, การ์ดขาว `#ffffff`, การ์ดดำ `#14170f`, accent มะนาว `#c6ff3d` (ตัวแปรอยู่บนสุดของ `style.css`) | |
| **การ์ดดำ** | ~~ใช้เฉพาะ hero/ปุ่มลอย/nav~~ → **ปัจจุบัน:** ทุกหน้ามีการ์ดดำเป็นหัว (`.hero-dark`) และหน้าวิเคราะห์ใช้การ์ดดำเพิ่ม (แนวโน้ม, จำลองซื้อ) การ์ดมะนาว (แผนเก็บเงิน) | เปลี่ยนตามที่ผู้ใช้สั่งให้ทุกหน้าคล้ายหน้าวิเคราะห์ (2026-09-19) — ถ้าจะกลับไปใช้ดำเฉพาะจุด ต้องคุยกันก่อน |
| Blur/glass | **ห้ามใช้ `backdrop-filter` เลย** | performance บน Android รุ่นกลาง-ล่างใน LINE webview |
| ฟอนต์ | Noto Sans + Noto Sans Thai โหลดคู่กันเสมอ | |
| **Bottom nav** | แคปซูลดำลอยกลางล่าง (เดสก์ท็อป ≥768px สูง ≥600px = แถบข้างซ้าย) ไอคอนล้วน **ยกเว้นแท็บที่เลือกอยู่แสดงข้อความ** ทุกตัวมี `aria-label` | ~~ไม่มี label เลย~~ เปลี่ยนตามภาพอ้างอิงแบบ pill ที่ผู้ใช้ส่งมา |
| ไอคอน | Lucide inline SVG ทั้งหมด **ไม่ใช้อีโมจิ** (ไลบรารีใน `UI_ICON_LIBRARY` / `CATEGORY_ICON_LIBRARY` ที่ต้นไฟล์ `app.js`) | เพิ่มไอคอนใหม่: ดึง path จาก `lucide-static` แล้วเพิ่มเป็น key |
| ปุ่ม + | วงกลมลอย พื้นดำ ไอคอนมะนาว | |
| ป้าย AI | ใช้คำว่า "สรุปสถานะ" (AI/Gemini ยังไม่เปิด) — พอเปิดจริงค่อยเปลี่ยนคำ | ตอนนี้หน้าวิเคราะห์ใช้การ์ดดำ "สรุปสถานะเดือนนี้" (`#analyzeStatus`) แทน `.status-insight` |
| Responsive | มือถือเป็นหลัก เดสก์ท็อปจัด bento (grid) ตามหน้า: `body[data-page="dashboard"|"transactions"|"categories"|"settings"]` และ `.analyze-grid` | |
| **เลือกวันที่ในหน้ารายการ** | ~~หลายวันไม่ต่อเนื่อง~~ → **ช่วงวันที่แบบคลิก 2 ครั้ง** (ค่าเริ่มต้น = เดือนนี้) | เปลี่ยนตามที่ผู้ใช้สั่ง |
| **ปุ่มกดตัวเลข (keypad)** | ตัดออก ใช้ช่อง input ธรรมดาเป็นบาท (`openAmountInputModal`) | คลาส `.keypad*` ใน CSS เป็นโค้ดตกค้างไม่ได้ใช้ |
| **ปุ่มจัดเรียงหมวดหมู่** | โหมดจัดเรียง (ลากหรือปุ่มขึ้น/ลง) + ปุ่มยืนยัน/ยกเลิก | เดิมลากแล้วบันทึกทันที |
| หน้าสรุป | hero + งบรายเดือน + **แผนเก็บเงินแบบย่อ (สูงสุด 3 แผน)** + รายการล่าสุด 4 รายการ | ~~ไม่มี goal cards~~ เพิ่มการ์ดย่อตามที่ผู้ใช้ขอ ตัวเต็มยังอยู่หน้าวิเคราะห์ |
| กองทุนฉุกเฉิน | **ไม่บังคับ ผู้ใช้เลือกเอง** ติ๊ก "ตั้งเป็นกองทุนฉุกเฉิน" ตอนสร้าง/แก้แผน (`plan.type === 'emergency'` ตั้งได้แผนเดียว) | ไทล์ในหน้าวิเคราะห์ถ้ายังไม่มีจะเป็นการ์ดชวนสร้างและซ่อนได้ |

## 3. โครงสร้างแต่ละหน้า (ฟีเจอร์ที่มีอยู่จริง)

- **`index.html` ภาพรวม:** hero ดำ (ใช้ได้วันนี้ ↔ เงินที่เหลือเดือนนี้ สลับได้) + ปุ่มลัด 4 ปุ่ม (`[data-hero-action="add"]` เปิดฟอร์มเพิ่มรายการ ที่เหลือเป็นลิงก์) → งบประมาณรายเดือน (`#monthlyBudgetSummary`: แท็บรายจ่าย/รายรับ, เลือกเดือน, แท่งสัดส่วนหมวดพร้อม popover, ขยายดูรายหมวด, แถวหมวดกดแล้วเปิดรายละเอียด พร้อมปุ่มไปหน้าประวัติที่กรองหมวด+เดือนไว้) → `#dashboardPlans` → รายการล่าสุด
- **`transactions.html` ประวัติ:** การ์ดดำสรุปรายรับ/รายจ่ายของช่วงที่เลือก, ค้นหา, แท็บทั้งหมด/รายรับ/รายจ่าย, ชิปหมวดหมู่, ช่วงวันที่, เลือกหลายรายการ (แก้หมวด+ประเภทพร้อมกัน, ลบ), เพิ่ม/แก้/ลบรายการ, รับ deep link `?category=ID&month=YYYY-MM`
- **`categories.html` หมวดหมู่:** การ์ดดำรวมงบ (เฉพาะรายจ่าย/รายรับตามแท็บ) พร้อม popover แท่งสัดส่วน, แท็บกรอง+ค้นหา, เพิ่ม/ลบ/ตั้งงบ/สวิตช์ "หมวดจำเป็น", โหมดจัดเรียง, รายละเอียดหมวด (แท็บภาพรวม = โดนัท, แท็บประวัติ = แท่ง 6 เดือน + เส้นประงบ + ลิงก์ไปหน้าประวัติ)
- **`analyze.html` วิเคราะห์:** แท็บ ภาพรวม / รายหมวด
  - ภาพรวม: สรุปสถานะ, แนวโน้ม 6 เดือน (แท่งคู่ + แถวรายรับ/รายจ่ายกดดูรายละเอียด), ไทล์ "ใช้อย่างปลอดภัยได้" (อัตราใช้จ่าย, การคาดการณ์, กองทุนฉุกเฉิน — กดดูคำอธิบาย) + ป้ายความมั่นใจ (กดดูความหมาย), โดนัทสัดส่วนหมวดพร้อม popover, แผนเก็บเงิน (กดการ์ด = รายละเอียด, ⋮ = ดูรายละเอียด/ประวัติการเงิน/โอนเข้า/แก้ไข/ลบ, สร้างแผน 3 ขั้นตอน), จำลองผลกระทบก่อนซื้อ (+ หน้าอธิบายวิธีคิด)
  - รายหมวด: เลื่อนเดือน, ชิปเลือกหมวด, กราฟแท่งย้อนหลัง, ไทล์สถิติ 4 อัน (กดดูรายละเอียด), รายการแยกหมวด
- **`settings.html` ตั้งค่า:** โปรไฟล์, สวิตช์ ผู้ช่วย AI/สรุปรายวัน (จำค่าใน localStorage ยังไม่มีผลกับระบบจริง), อีเมลสำหรับ forward + สร้าง token ใหม่ (สุ่มค่าใหม่แสดงบนหน้า)

## 4. Pattern/ตัวช่วยที่ใช้ซ้ำใน `app.js` (ใช้ตัวเดิมก่อนเขียนใหม่)

- **Modal:** `openModal(html)` / `closeModal()` / `showSuccessModal(text)`; ปุ่มปิดใช้ `data-close-modal`
- **Modal อธิบายรายละเอียด:** `openInsightModal({title, value, pill, progress, lead, rows, extra, tip, action, footer})` — ใช้กับไทล์, ผลจำลอง, รายละเอียดแผน, รายละเอียดแนวโน้ม ฯลฯ
- **Modal กรอกเงิน:** `openAmountInputModal(satang, onComplete, title)` (ช่องกรอกเป็นบาท คืนค่าเป็นสตางค์)
- **Popover แท่ง/โดนัท:** `showBarTip` / `hideBarTip` / `bindBarTip(ctx)` โดย ctx = `categoryOverviewTip`, `dashboardBudgetTip`, `analyzeDonutTip` (ส่วนต้องมี `data-overview-seg`; มือถือแตะเพื่อเปิด)
- **ฟอร์ม:** `renderCustomSelect`, `renderCustomDateField`, `renderCustomTimeField` + `bind…` (dropdown/ปฏิทิน/เวลา แบบ custom แทน native)
- **แผนเก็บเงิน:** `recalcPlanProgress`, `openPlanTransfer`, `openPlanDetail`, `openPlanMenu`, `openPlanHistory` (แก้ไข/ลบรายการโอนได้), `getEmergencyPlan`, `applyEmergencyType`
- **การเรนเดอร์หน้าวิเคราะห์:** `renderAnalyzePage()` เรนเดอร์อย่างเดียว เรียกซ้ำได้; ผูก event ครั้งเดียวที่ `bindAnalyzePage()` (ของที่วาดใหม่ใช้ event delegation) — ระวังผูก listener ซ้ำเวลาเพิ่มปุ่มใหม่

**ข้อควรระวังที่เคยเป็นบั๊ก**
- เงินใน mock เก็บเป็น **สตางค์ (×100)**; `formatMoney` หาร 100 ให้; ช่อง input เป็นบาทจริง ต้องคูณ 100 ก่อนเก็บ
- CSS ที่ตั้ง `display` ทับ attribute `hidden` — ต้องมีกฎ `X[hidden]{display:none}` เอง (เช่น `.overview-tip[hidden]`, `.analyze-grid[hidden]`)
- ลูก flex/grid ต้องมี `min-width:0` กันหน้าล้นแนวนอน; popover ใน modal ที่ scroll ได้ต้องใช้ `position:fixed`
- ไฟล์ CSS/JS ในทุก HTML มี **`?v=20260919k`** กันแคช — **แก้ CSS/JS แล้วให้เปลี่ยนเลขนี้ทุกหน้า** (`sed -i 's/?v=OLD/?v=NEW/g' *.html`) ไม่งั้นผู้ใช้อาจเห็นไฟล์เก่า
- ข้อมูลใน `mock-data.js`: `plans[].history = [{id, date:'YYYY-MM-DD', time:'HH:MM', amount}]` ผลรวมต้องเท่ากับ `saved`; `summary.forecastBalance` ต้องไม่เกินงบที่เหลือ

## 5. Class เดิมที่ `style.css` เก็บชื่อไว้ (อย่าเปลี่ยนชื่อ ไม่งั้น `app.js` พัง)

```
.transaction-item, .transaction-row, .transaction-list, .transaction-table, .transaction-summary
.goal-card, .goal-stack, .goal-header
.category-item-box, .category-list-wrap, .category-top, .category-name, .category-badge
.modal-card, .global-modal, .modal-head, .modal-actions
.settings-row, .setting-item, .tab, .tab-group, .segmented, .segmented-control
.strategy-card, .strategy-grid, .wizard-step, .wizard-step-indicator
.plan-summary-card, .summary-row, .plan-menu-wrap, .plan-actions-row
.calendar-day, .calendar-grid, .date-chip, .date-chip-list
.batch-action-bar, .batch-actions
.confidence-badge (+ .low/.medium/.high), .pill (+ .success/.warning/.danger)
.chip-button, .fab, .search-input, .switch, .stacked-bar(-seg), .overview-tip
```

คลาสสไตล์หน้าวิเคราะห์ (ใช้ซ้ำทุกหน้าแล้ว): `.an-card` (+ `.dark`/`.lime`), `.an-head`, `.an-tile`, `.an-tabs`, `.an-chip`, `.an-detail*`, `.an-action*`, `.an-setting-row`, `.hero-dark`
คลาสที่ตกค้างไม่ได้ใช้: `.keypad*`, `.status-insight`

## 6. วิธีทดสอบ (ที่ใช้มาตลอด)

- เสิร์ฟ `web/` ด้วย `python3 -m http.server 8123` แล้วขับด้วย Playwright (headless Chromium) — ติดตั้ง `playwright` ในโฟลเดอร์ชั่วคราวนอกโปรเจกต์ (browser cache อยู่ที่ `~/.cache/ms-playwright`) — วิธีนี้ทดสอบได้เฉพาะตอนยังใช้ mock พอต่อ API แล้วต้องรัน `npm run dev` แล้วเปิด `localhost:3000` แทน
- ตรวจอย่างน้อย: มือถือ 360/400px (แตะด้วย `hasTouch`), แท็บเล็ต 820px, เดสก์ท็อป 1280px, ไม่มี console error, ไม่มีหน้าล้นแนวนอน (`scrollWidth - innerWidth`)
- ระวัง `pkill -f` ที่ pattern ตรงกับคำสั่ง shell ตัวเอง (จบด้วย exit 144) — ปิด server ด้วยคำสั่งแยกต่างหาก

## 7. งานที่ยังเหลือ

### 7.1 ต่อ API จริง — งานก้อนใหญ่

พื้นฐานที่ต้องทำก่อน (ทุกหน้าใช้ร่วมกัน)

- โหลด `js/api.js` ในทุกหน้า แล้วเปลี่ยน `mock` ทั้งหมดให้มาจาก `window.moneyBotApi`
- จัดการ 401: ถ้า `GET /api/me` ตอบ 401 ให้แสดงปุ่มไป `/auth/login` **ห้าม redirect อัตโนมัติ** (contract บอกว่าจะวนลูป)
- `index.html` ต้องอ่าน query `?login=no-account` และ `?login=cancelled` มาแสดงข้อความ (contract ข้อ 2)
- ชื่อ/รูปโปรไฟล์ (ตอนนี้ hardcode `PS` / "แพรวา ศรีสุข") มาจาก `GET /api/me`
- หมวดหมู่จาก API มี `emoji` แต่ UI เราใช้ไอคอน Lucide + สีประจำหมวด ต้องทำตัวแมปชื่อหมวด → ไอคอน/สี หรือเปลี่ยนไปใช้ emoji ตาม API

| หน้า | endpoint ที่ต้องใช้ |
|---|---|
| `index` | `/api/summary` (safe-to-spend), `/api/budgets?month=`, `/api/plans`, `/api/transactions?limit=4` |
| `transactions` | `/api/transactions` (GET/POST/PATCH/DELETE + `/restore`), `/api/categories` |
| `categories` | `/api/categories`, `/api/budgets`, `PUT`/`DELETE /api/budgets/:categoryId` |
| `analyze` | `/api/summary`, `/api/plans`, `/api/plans/capacity`, `POST /api/plans` → `/confirm`, `/transfer`, `DELETE` |
| `settings` | `/api/settings`, `POST /api/settings/email-token/rotate` |

### 7.2 ต้องเลิกคำนวณเงินในหน้าเว็บ (กฎ G1)

`docs/UI_CONTRACT.md` ข้อ 5 ห้ามหน้าเว็บคำนวณเงินเอง ทุกตัวเลขต้องมาจาก API
(ยกเว้นคำนวณเพื่อแสดงผลล้วนๆ เช่นความกว้างแถบ progress) จุดที่ต้องรื้อ:

| จุดในโค้ด | ตอนนี้คำนวณเอง | ควรมาจาก |
|---|---|---|
| ตัวช่วยสร้างแผน `renderPlanWizardStep` | `amount * 0.18 / 0.12 / 0.08` เดายอดออม | `POST /api/plans` สร้าง 3 ทางเลือกให้แล้ว (contract ยกจุดนี้มาเป็นตัวอย่างสิ่งที่ห้ามทำโดยตรง) |
| `getPlanForecast` "ถ้าออมตามนี้จะครบราว N เดือน" | `left / monthly_save` | `targetDate`, `expectedSatang`, `percentComplete` จาก `/api/plans` |
| การ์ดแผน "หลุดเป้า" | ค่าที่กำหนดเองใน mock | `offTrack` จาก `/api/plans` |
| `getPurchaseSimulation` | เฉลี่ยต่อวัน, กี่เดือนถึงออมครบ, กำลังออมเฉลี่ย | `/api/plans/capacity` + `/api/summary` (ส่วนที่ยังไม่มีต้องขอ backend เพิ่ม) |
| `renderAnalyzeTrend`, `openTrendDetail` | ค่าเฉลี่ย 6 เดือน, % เทียบเดือนก่อน | `/api/summary` |
| `renderCategoryOverview`, `renderMonthlyBudgetSummary` | รวมงบ/ยอดใช้ทุกหมวดเอง | `/api/budgets` (มียอดใช้ต่อหมวดให้แล้ว) |
| ไทล์ "การคาดการณ์" | `summary.forecastBalance` ที่ใส่ไว้เอง | ยังไม่มี endpoint — ต้องขอ backend |

### 7.3 ฟีเจอร์ใน UI ที่ยังไม่มี endpoint รองรับ

ต้องคุยกับทีม backend ว่าจะเพิ่ม endpoint หรือจะตัดฟีเจอร์ออก

| ฟีเจอร์ | สถานะ |
|---|---|
| เพิ่ม / ลบ / จัดเรียงหมวดหมู่ | มีแต่ `GET /api/categories` ไม่มี POST/PATCH/DELETE |
| สวิตช์ "หมวดจำเป็น" | `isEssential` อ่านได้ แต่ไม่มี endpoint แก้ |
| ประวัติการเงินของแผน (แก้ไข/ลบรายการโอน) | มีแต่ `POST /plans/:id/transfer` ไม่มี GET ประวัติ และไม่มีทางแก้/ลบรายการโอน |
| แก้ไขแผน | มีแค่ confirm / transfer / cancel ไม่มี PATCH |
| กองทุนฉุกเฉิน (`plan.type === 'emergency'`) | ไม่มีฟิลด์นี้ใน API |
| สวิตช์ "ผู้ช่วย AI" / "สรุปรายวัน" | `/api/settings` คืน `aiEnabled` แบบอ่านอย่างเดียว (ค่าระดับระบบ) ไม่มีสวิตช์รายผู้ใช้ |
| รายการประจำ | `/api/recurring` มีให้แล้ว แต่ UI เรายังไม่มีหน้านี้เลย |
| `unparsedCount` (อีเมลที่อ่านยอดไม่ออก) | API ส่งมาให้ แต่หน้าตั้งค่ายังไม่แสดง |

### 7.4 ข้อบังคับจาก SPEC ที่ UI ยังไม่ทำตาม

- ทุกหน้าที่แสดงเนื้อหาเชิงวางแผนต้องมีข้อความ **"ℹ️ ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน"** (SPEC §S5.5) — ตอนนี้ยังไม่มีในหน้าวิเคราะห์
- แผนสถานะ `draft` ต้องไม่ปนอยู่ในรายการแผนหลัก
- `confidence` ต้องแสดงบนการ์ดแผนทุกใบ (อันนี้ทำแล้ว)

### 7.5 อื่นๆ

1. **ข้อมูล mock ไม่ตรงกันเอง:** ยอดใช้ในสรุป (`monthlyBudgetUsed` ฿6,200) ≠ รวมรายหมวด (฿6,600) ≠ รายจ่ายในกราฟแนวโน้ม (฿7,150) — จะหายไปเองเมื่อต่อ API
2. หน้าต่างเพิ่ม/แก้ไขรายการและหมวดหมู่ กับตัวช่วยสร้างแผน ยังเป็นหน้าตาแบบเดิม (ยังไม่ปรับเป็นสไตล์ `.an-detail`)
3. ลบโค้ด CSS ตกค้าง (`.keypad*`, `.status-insight`) ได้เมื่อมั่นใจว่าไม่ใช้แล้ว
4. `web/js/boot.js` (ตัวต่อ API ของ UI ชุดเก่า) ถูกลบตอนย้าย UI — ถ้าอยากดูเป็นตัวอย่างการต่อ API ใช้ `git show origin/main:web/js/boot.js`

## 8. บริบทโปรเจกต์กว้างๆ

โปรเจกต์ "JOD tang" — บอทจดรายรับ-รายจ่ายบน LINE ภาษาไทย ใช้ Vanilla HTML/CSS/JS เท่านั้น (ห้าม framework)
หน้าเว็บนี้ backend เสิร์ฟเองที่โดเมนเดียวกัน (`express.static` ชี้มาที่ `web/`) ล็อกอินด้วย LINE Login
แล้วใช้ session cookie ไม่ใช่ LIFF SDK แล้ว — **ห้ามย้ายไป host ที่อื่น** ไม่งั้น cookie กลายเป็น
third-party cookie ที่ Safari บล็อก (contract ข้อ 1)

เอกสารที่ต้องอ่านคู่กัน: `docs/UI_CONTRACT.md` (สัญญาระหว่างหน้าเว็บกับ backend), `docs/RULES.md` (กฎเหล็ก 7 ข้อ), `SPEC.md`

## 9. ประวัติงาน

- **2026-09-17:** redesign v2 ครบ 5 หน้า, เปลี่ยน mock เป็นนักศึกษา, ผูกปุ่ม hero, แก้บั๊ก Chart.js ในหน้าหมวดหมู่ / เส้นงบตายตัว
- **2026-09-18/19:** ไอคอน Lucide ทั้งระบบ, dropdown/ปฏิทิน/เวลา custom, หน้าประวัติ (ช่วงวันที่, เลือกหลายรายการ), หน้าหมวดหมู่ใหม่ (โหมดจัดเรียง, รายละเอียด+กราฟย้อนหลัง), popover แท่งสัดส่วน/โดนัท, หน้าวิเคราะห์ใหม่ทั้งหน้า (ไทล์อธิบาย, แผนเก็บเงิน, ประวัติการเงิน, กองทุนฉุกเฉินแบบเลือกเอง, จำลองซื้อ), แผนเก็บเงินย่อบนหน้าสรุป, ปรับหน้าที่เหลือให้สไตล์เดียวกับหน้าวิเคราะห์, ตัวจำลองซื้อคำนวณจากข้อมูลจริง
