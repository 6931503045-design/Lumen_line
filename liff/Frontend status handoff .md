# JOD tang — สรุปสถานะ Frontend Redesign (v2) ส่งต่อให้ทำต่อ

> **อัปเดต 2026-09-17:** งานที่เหลือทั้งหมดในหัวข้อ 6 ทำเสร็จแล้ว — ดูหมายเหตุท้ายไฟล์

บริบท: กำลังรื้อ UI ของ LIFF ทั้ง 5 หน้าใหม่ทั้งหมด จากธีมเดิม (ม่วง-ชมพู, glassmorphism, dark/light toggle)
ไปเป็นธีมใหม่ (เขียวอ่อน, การ์ดขาวเรียบ+ดำ accent, light mode เดียว, ไม่มี blur เลย)
**ฟีเจอร์เดิมทั้งหมดต้องคงไว้ครบ แค่เปลี่ยนหน้าตา** — ห้ามตัดฟังก์ชันโดยไม่ได้คุยกันก่อน

---

## 1. การตัดสินใจด้านดีไซน์ที่ "ปิดจ็อบแล้ว" (ห้ามเปลี่ยนโดยไม่ถามผู้ใช้ก่อน)

| หัวข้อ | คำตัดสินสุดท้าย |
|---|---|
| Theme | **Light mode อย่างเดียว** ยกเลิก dark mode ไปแล้ว (ห้ามใส่ toggle กลับมา) |
| โทนสี | เขียวอ่อน — พื้นหลัง `#f3f9ec`, การ์ดขาว `#ffffff`, accent เขียวมะนาวจัดจ้าน `#c6ff3d` |
| การ์ดเข้ม | การ์ดดำสนิท `#14170f` ใช้เฉพาะจุดสำคัญ (hero, ปุ่มลอย, nav) — ไม่ใช่การ์ดหลักทั่วไป |
| Blur/glass | **ห้ามใช้ `backdrop-filter` เลย** (ตัดสินใจเรื่อง performance บนมือถือ Android รุ่นกลาง-ล่างที่รันใน LINE webview) |
| ฟอนต์ | `Noto Sans` (ละติน/ตัวเลข) + `Noto Sans Thai` (ข้อความไทย) — ต้องโหลดคู่กันเสมอ คนละไฟล์ font |
| Bottom nav | เปลี่ยนจากแถบเต็มความกว้างมีข้อความ → **แคปซูลดำลอยกลางล่างจอ ไอคอนล้วน** ไม่มี label ข้อความ (ต้องมี `aria-label` แทน) |
| ปุ่ม + | วงกลมลอย พื้นดำ ไอคอนเขียว (เปลี่ยนจากม่วง-ชมพู) |
| AI Insight badge | **เปลี่ยนคำ ไม่ใช่ตัดทิ้ง** — เดิมเขียนว่า "AI Insight" ให้เปลี่ยนเป็น "สรุปสถานะ" (เพราะ `AI_ENABLED` ยังไม่เปิดใช้งานจริงใน backend ตอนนี้ ยังไม่ต่อ Gemini) เก็บ component/gradient ไว้ พอ Gemini เปิดใช้จริงค่อยเปลี่ยนคำกลับ |
| Mock data | ต้องเปลี่ยนจาก persona "ผู้บริหาร Alexander Sims" เป็น **นักศึกษาไทย** (ชื่อสมมติ, หมวดรายจ่าย/รายรับแบบนักศึกษา, ตัวเลขสเกลนักศึกษาไม่ใช่ผู้บริหาร) — **ยังไม่ได้ทำ** ดู TODO ด้านล่าง |
| Responsive | มือถือเป็นหลัก, desktop (≥768px) ต้องสวยและใช้งานได้จริงด้วย ไม่ใช่แค่ขยายกว้าง |
| Reference images | ใช้ 2 ชุดหลัก: (1) "TaskLab" (เขียวมะนาว-ดำ-ขาว, การ์ดเรียบ) เป็นแม่แบบสีหลัก (2) แอปธนาคารมี hero card ดำ+ปุ่มวงกลม 4 ปุ่ม และ floating pill nav — เอามาผสมกัน |

## 2. โครงสร้างหน้าที่ตกลงกันแล้ว (สรุปย่อ — อยากได้เต็มดูหัวข้อ 6)

- **`index.html` (ภาพรวม)**: Hero card ดำ (safe-to-spend ตัวใหญ่ + confidence badge + ปุ่มวงกลม 4 ปุ่มลัด) → งบประมาณรายเดือน → รายการล่าสุด 3-4 รายการ **เท่านั้น** — **ตัดกราฟ (donut/แนวโน้ม) และ goal cards เต็มรูปแบบออกจากหน้านี้แล้ว** ย้ายไป `analyze.html` แทน เพื่อไม่ให้ซ้ำซ้อนกัน 2 หน้า
- **`transactions.html`**: เหมือนเดิมทุกฟีเจอร์ (ค้นหา, แท็บกรอง, เลือกวันที่หลายวันไม่ต่อเนื่อง, multi-select แก้หลายรายการ, ปุ่ม + เพิ่มรายการ) แค่เปลี่ยนสี/ฟอนต์
- **`categories.html`**: เหมือนเดิมทุกฟีเจอร์ (ตั้งงบต่อหมวด, drag-drop จัดเรียง, กดดูกราฟย้อนหลัง+เส้นประงบ) แค่เปลี่ยนสี/ฟอนต์
- **`analyze.html`**: **รับกราฟ+goal cards เต็มรูปแบบที่ตัดมาจากหน้าสรุป** + ของเดิมที่มีอยู่แล้ว (สรุปสถานะ, safe-to-spend badge, แผนออม 3 ขั้นตอน, ปุ่มแก้ไขแผน, ปุ่มโอนเข้าแผน, จำลองซื้อของ)
- **`settings.html`**: เหมือนเดิม **ลบ dark mode toggle ทิ้ง**, ลบ "แผนพรีเมียม" (ข้อความปลอมที่ไม่มีระบบสมาชิกจริง)

## 3. สถานะไฟล์ ณ ตอนนี้

| ไฟล์ | สถานะ | รายละเอียด |
|---|---|---|
| `css/style.css` | ✅ **เสร็จสมบูรณ์** | รื้อใหม่ทั้งหมด, เก็บชื่อ class เดิมไว้เกือบทั้งหมดเพื่อให้ `app.js` ทำงานต่อได้โดยแก้น้อยที่สุด (ดูหัวข้อ 5 รายชื่อ class สำคัญ) |
| `js/app.js` | 🟡 **แก้บางส่วนแล้ว ยังไม่จบ** | ดูหัวข้อ 4 ว่าทำอะไรไปแล้วบ้าง + เหลืออะไร |
| `js/mock-data.js` | 🔴 **ยังไม่ได้แตะเลย** | ยังเป็น persona เดิม (Alexander Sims, ตัวเลขผู้บริหาร) ต้องเปลี่ยนเป็นนักศึกษาไทย |
| `js/api.js`, `js/charts.js`, `js/liff-init.js` | 🔴 ยังไม่ได้ดู/แตะ | เป็น scaffold เปล่าอยู่ (ของ W2-W4) ยังไม่เกี่ยวกับรอบนี้ |
| `index.html` | 🔴 **ยังไม่ได้แก้เลย** | ยังเป็น HTML เดิมทั้งหมด (มีปุ่ม `.theme-toggle`, โครง `.hero` เดิม, มี `#spendingDonut`/`#cashTrend`/`#goalCards` ที่ควรลบออกแล้วตาม decision ข้อ 2) |
| `transactions.html`, `categories.html`, `analyze.html`, `settings.html` | 🔴 **ยังไม่ได้แก้เลย** | ยังเป็น HTML เดิมทั้งหมด (มีปุ่ม `.theme-toggle` ที่ต้องลบ, class เดิมใช้ได้เพราะ CSS เก็บชื่อไว้ให้แล้ว) |

## 4. สิ่งที่แก้ใน `app.js` ไปแล้ว (chunk 2 — ทำไปครึ่งเดียว)

1. ลบฟังก์ชัน `setupThemeToggle()` ทั้งหมด + ลบการเรียกใช้ใน `initializePage()`
2. เขียน `renderDashboard()` ใหม่:
   - เปลี่ยน element target จาก `#confidenceBadgeWrap`/`#netBalance` (แสดงยอดคงเหลือใหญ่) → `#heroConfidenceBadge`/`#heroSafeToSpend` (แสดง safe-to-spend ใหญ่แทน ตามที่ตกลงว่าอยากรู้ "ใช้ได้วันนี้อีกเท่าไหร่" มากกว่ายอดคงเหลือ)
   - ลบการ render กราฟ `spendingDonut`/`cashTrend` และ `goalCards` เต็มรูปแบบออกจากฟังก์ชันนี้ (ย้ายไป analyze แล้ว — `renderAnalyzePage()` มีกราฟและ `renderPlanCards()` อยู่แล้วครบ ไม่ต้องเพิ่ม)
   - ลบ `confidenceScore` (ตัวเลข % แยกที่เคยอยู่ข้างป้ายความมั่นใจ — ไม่ใช้แล้ว ใช้แค่ badge สีเดียวพอ)
3. เปลี่ยนสีกราฟทั้งหมดจากม่วง-ชมพูเป็นธีมใหม่ (เขียว/ดำ/ส้มสำหรับเส้นงบประมาณ) ใน `renderAnalyzePage()` (กราฟแท่ง `reportChart`) และในกราฟ category detail (`categoryDetailChart`, `categoryHistoryChart`)
4. เปลี่ยนสี grid line ของทุกกราฟจาก `rgba(255,255,255,0.05)` (สำหรับพื้นหลังมืด) เป็น `rgba(16,20,11,0.06)` (สำหรับพื้นหลังสว่าง)
5. **บั๊กเล็กที่เจอและแก้ไปด้วยระหว่างทาง**: กราฟ `categoryHistoryChart` เดิมใส่ `borderDash` ผิดเส้น (เส้น "ยอดใช้" เป็นเส้นประ, เส้น "งบประมาณ" เป็นเส้นทึบ — สลับกับธรรมเนียมกราฟงบทั่วไป) แก้ให้ถูกแล้ว (ยอดใช้ = ทึบ, งบประมาณ = ประ)

**ยืนยันแล้วว่า `app.js` ไม่มีสีม่วง/ชมพูเก่าหรือโค้ด dark mode ตกค้างอีกเลย** (เช็คด้วย grep ก่อนส่งไฟล์)

**ยังไม่ได้ทำใน `app.js`:**
- ยังไม่ได้เพิ่ม event listener ให้ปุ่มวงกลม 4 ปุ่มใน hero card ใหม่ (`.hero-action`) — ตอนนี้ปุ่มพวกนี้ยังไม่มีอยู่จริงเพราะ HTML ยังไม่ได้แก้
- ยังไม่ได้ตรวจว่ามีจุดอื่นใน `app.js` ที่ reference id/class ที่จะหายไปตอนแก้ HTML (เช่นต้องเช็ค `renderMonthlyBudgetSummary()`, `bindTransactionControls()`, `bindSettingsActions()` ว่า id ที่ query ตรงกับ HTML ใหม่ที่จะเขียนไหม)

## 5. Class เดิมที่ `style.css` เก็บชื่อไว้ให้ (ห้ามเปลี่ยนชื่อตอนเขียน HTML ใหม่ ไม่งั้น `app.js` พัง)

```
.transaction-item, .transaction-row, .transaction-list, .transaction-table, .transaction-summary
.goal-card, .goal-stack, .goal-header
.category-item-box, .category-list-wrap, .category-top, .category-name, .category-badge, .essential-toggle
.modal-card, .global-modal, .modal-head, .modal-actions
.keypad, .keypad-key, .keypad-display
.settings-row, .setting-item
.tab, .tab-group
.segmented, .segmented-control
.strategy-card, .strategy-grid
.wizard-step, .wizard-step-indicator
.plan-summary-card, .summary-row, .plan-menu-wrap, .plan-actions-row
.calendar-day, .calendar-grid, .date-chip, .date-chip-list
.batch-action-bar, .batch-actions
.confidence-badge (+ .low/.medium/.high), .pill (+ .success/.warning)
.chip-button, .fab, .search-input
```

**Class ใหม่ที่เพิ่มเข้ามาใน `style.css` (ยังไม่ได้ใช้ใน HTML เพราะ HTML ยังไม่แก้):**
```
.hero-dark, .hero-top, .hero-figure, .hero-actions, .hero-action, .hero-action-icon
.icon-btn, .header-actions
.status-insight (การ์ด "สรุปสถานะ")
.form-grid, .form-field
.primary-btn, .secondary-btn
```

## 6. งานที่เหลือทั้งหมด (เรียงลำดับแนะนำ)

1. **แก้ `mock-data.js`** — เปลี่ยน persona เป็นนักศึกษาไทย (ชื่อ, หมวดรายจ่าย/รายรับ, ตัวเลขสเกลนักศึกษา, ชื่อแผนออม)
2. **เขียน `index.html` ใหม่** — ใช้ class ใหม่จากหัวข้อ 5 (`.hero-dark`, `.hero-actions` 4 ปุ่ม, `#heroConfidenceBadge`, `#heroSafeToSpend`), ลบ `#spendingDonut`/`#cashTrend`/`#goalCards`/`.theme-toggle` ทิ้ง, ใส่ `.status-insight` ถ้าต้องการ
3. **เขียน `transactions.html`, `categories.html`, `analyze.html`, `settings.html` ใหม่** — โครง section เดิมทั้งหมด (ดูหัวข้อ 2) แค่เปลี่ยน class เก่าเป็นใหม่ตามหัวข้อ 5, ลบ `.theme-toggle` ทุกหน้า, เปลี่ยน bottom-nav เป็น icon-only ทุกหน้า, เพิ่ม `.status-insight` ใน `analyze.html` (เปลี่ยนคำจาก AI Insight → สรุปสถานะ), ย้ายกราฟ+goal cards มาไว้ที่นี่
4. **เพิ่ม event listener ปุ่ม hero-action 4 ปุ่มใน `app.js`** (เชื่อมไปหน้า/โมดัลที่ถูกต้อง)
5. **ทดสอบ cross-check ทุก id/class ระหว่าง HTML ใหม่กับ `app.js`** ก่อนถือว่าจบงาน — โดยเฉพาะจุดที่ query ด้วย `document.getElementById`/`querySelector` ทั้งหมด

## 7. ไฟล์แนบมาด้วย

- `css/style.css` (v2 สมบูรณ์)
- `js/app.js` (v2 แก้บางส่วน — ดูหัวข้อ 4 ว่าจุดไหนเสร็จ จุดไหนค้าง)
- HTML 5 ไฟล์ + `mock-data.js` เดิม (ยังไม่แก้ — แนบมาให้ดู reference โครงสร้าง section เดิมเท่านั้น)

## 8. บริบทโปรเจกต์กว้างๆ (เผื่อ AI อีกเครื่องไม่มีบริบทเลย)

โปรเจกต์ "JOD tang" — บอทจดรายรับ-รายจ่ายบน LINE ภาษาไทย ใช้ Vanilla HTML/CSS/JS + Chart.js เท่านั้น (ห้าม framework), ฟอนต์ Noto Sans + Noto Sans Thai, ยังทำงานกับ mock data ล้วนๆ (ยังไม่ต่อ backend จริง — backend แยกทำอยู่คนละส่วน กำลังพัฒนาคู่ขนานกัน), LIFF (LINE Front-end Framework) คือกรอบที่ใช้เปิดหน้าเว็บนี้ข้างในแอป LINE โดยตรง

## 9. หมายเหตุอัปเดต 2026-09-17 — งานหัวข้อ 6 เสร็จหมดแล้ว

ทำครบทั้ง 5 ข้อในหัวข้อ 6:

1. **`mock-data.js`** — เปลี่ยน persona เป็นนักศึกษาไทยแล้ว: "แพรวา ศรีสุข" (avatar `PS`) นักศึกษาชั้นปีที่ 3 ม.แม่ฟ้าหลวง ตัวเลขทุกอย่าง (รายรับ/รายจ่าย/หมวดหมู่/แผนออม/กราฟ) ปรับสเกลเป็นระดับนักศึกษาแล้ว
2. **`index.html`** — เขียนใหม่ครบ: `.hero-dark` + `.hero-actions` (4 ปุ่ม: เพิ่มรายการ/รายการ/หมวดหมู่/วิเคราะห์), `#heroConfidenceBadge`/`#heroSafeToSpend`, ไม่มีกราฟ/goal cards/`.theme-toggle` แล้ว ตามหน้าโครงสร้างในหัวข้อ 2 (เหลือแค่ hero → งบประมาณรายเดือน → รายการล่าสุด ไม่มี summary-grid รายรับ/รายจ่ายแยกแล้วเพราะโครงสร้างที่ตกลงกันไม่ได้รวมไว้)
3. **`transactions.html`, `categories.html`, `analyze.html`, `settings.html`** — เขียนใหม่ครบ ใช้ class จากหัวข้อ 5 ทั้งหมด, ลบ `.theme-toggle`/`darkModeToggle`/"แผนพรีเมียม" แล้ว, bottom-nav เป็น icon-only ทุกหน้า (🏠/🧾/🗂️/📊/⚙️ + `aria-label`), `analyze.html` มี `.status-insight` ("✨ สรุปสถานะ") แล้ว
4. **`app.js`** — เพิ่ม `bindHeroActions()` ผูกปุ่ม `[data-hero-action="add"]` เข้ากับ `openAddTransactionModal` แล้ว (อีก 3 ปุ่มใช้ `<a href>` ลิงก์ตรงไปหน้าอื่นเลย ไม่ต้องมี JS เพิ่ม)
5. **Cross-check id/class** — เช็คด้วยสคริปต์ grep/node ทุก `getElementById`/`querySelector` ใน `app.js` เทียบกับทุก HTML แล้ว ไม่มี id ขาดหาย, ไม่มี class เก่า (`glass-panel`/`card-glass`/`theme-toggle`/`darkModeToggle`) หลงเหลือ

**บั๊กที่เจอเพิ่มระหว่างทางและแก้ไปด้วย:**
- `categories.html` ไม่เคยโหลด Chart.js เลยตั้งแต่แรก แต่ `openCategoryDetail()` ต้องใช้ `Chart` สร้างกราฟ — เดิม fail เงียบ (guard `typeof Chart === 'undefined'` ใน `createChart()` แค่ return โดยไม่ error) ทำให้กดดูรายละเอียดหมวดหมู่แล้วไม่เห็นกราฟเลย ตอนนี้เพิ่ม `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>` ให้แล้ว
- `reportChart` เส้นงบประมาณ (`budgetLine`) เดิม hardcode ไว้ที่ `300000` ไม่อ้างอิง `mock.summary.monthlyBudgetLimit` เลย ทำให้เส้นงบในกราฟไม่ตรงกับงบที่ตั้งจริงถ้าเปลี่ยน mock data — แก้ให้ดึงจาก `mock.summary.monthlyBudgetLimit` แล้ว
- `renderDashboard()` มีโค้ดอ่านค่า `#netBalance`/`#incomeAmount`/`#expenseAmount` ที่ไม่มี element เหล่านี้ในหน้าใหม่แล้ว (โครงสร้างหน้าใหม่ตัด summary-grid ออก) — ลบโค้ด dead lookup ทิ้งแล้ว

**ทดสอบแล้ว:** เปิดทั้ง 5 หน้าด้วย headless Chromium (viewport 400px จำลองมือถือ) ผ่าน static server ในเครื่อง — ไม่มี console error บนหน้าไหนเลย รวมถึงตอนกดเปิด category detail modal ที่เพิ่ง fix เรื่อง Chart.js ไปด้วย

**ยังไม่ได้ทำ (อยู่นอกสโคปงานนี้ ไม่ได้แตะ):** `js/api.js`, `js/charts.js`, `js/liff-init.js` (scaffold เปล่าของ W2-W4), การต่อ backend จริง