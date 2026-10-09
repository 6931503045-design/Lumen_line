# งานที่เหลือ — ใครทำอะไร ทำยังไง

**ทีม Lumen · โปรเจกต์ JOD tang (จดตัง)**
สถานะ ณ 5 ตุลาคม 2026 — ตรวจจากโค้ดจริงบน `origin/main` (`2300d24`)

---

## 🔴 อ่านตรงนี้ก่อน

ตรวจ GitHub แล้วพบว่า **ไม่มี commit ใหม่เลยตั้งแต่ 24 กันยายน (11 วัน)** และมีแค่ 2 จาก 5 คนที่เคย commit

| ชื่อ | บทบาท | GitHub | commits |
|---|---|---|---|
| Aitthiphat Kanyathuean | Full-stack | `88coder-1` | 21 |
| Teerat Wongpanti | Backend | `6931503045-design` + `BeginPython01` | 18 |
| **Thapanapat Pumulna** | Project Manager | — | **0** 🔴 |
| **Teerapat Palee** | Frontend | — | **0** 🔴 |
| **Sorrawis Chumpheng** | Technical Writer | — | **0** 🔴 |
| *(AI)* | — | `Claude` | 39 |

เกณฑ์วิชา (M4 §04 "คะแนนส่วนร่วมรายคน") ระบุว่า:

> คะแนนโปรเจกต์รายคน = คะแนนทีม × Factor
> **1.00** = มีร่องรอยงานตามบทบาทใน Charter
> **0.70** = งานใน GitHub บางเบา/กระจุกท้าย
> **0.40** = ไม่มีร่องรอยงานที่ตรวจสอบได้ตลอดโปรเจกต์

และวัดจาก **GitHub contribution อย่างเดียว ไม่มีแบบประเมินเพื่อน**

**3 คนที่ยังไม่มี commit เสี่ยงโดน ×0.40** ซึ่งหักหนักกว่าคะแนนโค้ดที่ขาดทั้งหมดรวมกัน

> ข่าวดี: งานจริงยังเหลือเยอะ ไม่ต้องสร้างงานปลอม ทุกอย่างในเอกสารนี้คือของที่ต้องทำอยู่แล้ว

---

## ⚙️ กติกาสำหรับทุกคน — ตั้งค่าก่อนเริ่ม

### 1. ตั้งชื่อผู้ commit (ทำครั้งเดียว · สำคัญที่สุด)

```bash
git config --global user.name "ชื่อบัญชี GitHub ของตัวเอง"
git config --global user.email "อีเมลที่ผูกกับบัญชี GitHub"
```

เช็คว่าตั้งถูก:
```bash
git config user.name && git config user.email
```

> ⚠️ **ถ้าอีเมลไม่ตรงกับที่ผูกไว้ใน GitHub → commit จะไม่ขึ้นใน Contributors graph = เท่ากับไม่ได้ทำ**
> ดูอีเมลที่ผูกไว้ที่ GitHub → Settings → Emails

### 2. ขั้นตอน commit (ใช้เหมือนกันทุกคน)

```bash
git checkout main
git pull origin main          # ดึงของใหม่ก่อนเสมอ กันชนกัน

# ...แก้ไฟล์ของตัวเอง...

git add <ไฟล์ที่แก้>
git commit -m "ข้อความบอกว่าทำอะไร"
git push origin main
```

ถ้า push โดนปฏิเสธ (`non-fast-forward`):
```bash
git pull origin main
git push origin main
```
**ห้ามใช้ `git push --force` เด็ดขาด** — จะลบงานคนอื่น

### 3. เขียนข้อความ commit

ใช้ภาษาอังกฤษ บอกว่า "ทำอะไร" ไม่ใช่ "แก้ไฟล์ไหน"

| ✅ ดี | ❌ ไม่ดี |
|---|---|
| `Build the summary Flex card for the LINE chat` | `update file` |
| `Add the AI use statement for M3` | `fix` |
| `Move purchase simulation to the money engine` | `แก้โค้ด` |

---

# 1️⃣ Thapanapat Pumulna — Project Manager

> เริ่มได้ทันที ไม่ต้องเขียนโค้ดสักบรรทัด

## งาน A — เปิด GitHub Issues (ทำวันนี้ · ~30 นาที)

**ทำไม:** เกณฑ์หน้า 7 ระบุว่า Issues และ PR นับเป็น contribution — PM ที่เปิด issue แล้วตามงาน มีร่องรอยชัดกว่าคน commit โค้ด 2 บรรทัด

**วิธีทำ:** GitHub → repo → แท็บ **Issues** → **New issue** → กรอก → **Assignees** เลือกคนรับผิดชอบ → **Submit**

**เปิดตามนี้ 12 อัน** — 3 อันเสร็จไปแล้ว เหลือต้องเปิดจริง **9 อัน**:

| # | ชื่อ issue | เจ้าของ | สถานะ |
|---|---|---|---|
| 1 | `[Frontend] Build the summary Flex card` | Teerapat | |
| 2 | `[Frontend] Build the saving plan Flex card` | Teerapat | |
| 3 | `[Frontend] Build the error and pending Flex cards` | Teerapat | |
| 4 | `[Frontend] Create the LINE rich menu` | Teerapat | |
| 5 | `[Docs] Write the AI use statement` | Sorrawis | |
| 6 | `[Docs] Replace the SRS PDF with the corrected team name` | Sorrawis | |
| 7 | `[Docs] Fill in team members and contributions in the final report` | Sorrawis | |
| 8 | `[Docs] Align SPEC.md priorities with the SRS` | Sorrawis | |
| 9 | `[Full-stack] Move purchase simulation into the money engine` | Aitthiphat | ✅ เสร็จ (`5b3ad3c`) |
| 10 | `[Full-stack] Export the use case and sequence diagrams as images` | Aitthiphat | |
| 11 | `[PM] Write the M1 team charter` | Thapanapat | ✅ เสร็จ (`31071f3`) |
| 12 | `[PM] Prepare the demo slides` | Thapanapat | ✅ เสร็จ (`ead1c1a`) |

> ~~`[Backend] Rotate the Supabase database password`~~ — **ถอนออกจากลิสต์แล้ว ไม่ต้องทำ**
> เหตุผลอยู่ในหัวข้อของ Teerat ด้านล่าง ถ้าเปิด issue นี้ไปแล้วให้ปิดได้เลย

**เนื้อใน issue** เขียน 3 บรรทัดพอ:
```
ทำอะไร: <ก๊อปจากหัวข้อของคนนั้นในเอกสารนี้>
ไฟล์:   <path>
เสร็จเมื่อ: <เงื่อนไข>
```

**เสร็จเมื่อ:** มี issue 13 อัน แต่ละอันมีคน assign

---

## งาน B — M1 Team Charter

**ไฟล์:** `docs/M1-Charter_Lumen.md` → แปลงเป็น `docs/M1-Charter_Lumen.pdf`

เกณฑ์ M1 ให้คะแนน 3 ข้อ (ข้อละ 0/1/2):
1. ปัญหาจริง + เฉพาะเจาะจง (ใคร เจ็บปวดอะไร)
2. ผู้ใช้ + ขอบเขต in/out
3. ตัววัดความสำเร็จ (ต้องวัดได้)

**ไม่ต้องคิดใหม่ — ดึงจากที่มีอยู่แล้ว:**

| หัวข้อใน Charter | ดึงจาก |
|---|---|
| ปัญหา | `SPEC.md` §1.1 · `docs/SRS.md` §1.1 |
| ผู้ใช้เป้าหมาย | `docs/SRS.md` §1.2 |
| ขอบเขต in/out | `SPEC.md` §1.3 · `docs/SRS.md` §2.1 และ §6 |
| ตัววัดความสำเร็จ | `SPEC.md` §10 (มี 9 ข้อ วัดได้อยู่แล้ว) |
| SDLC + เหตุผล | Incremental — เหตุผลอยู่ในตารางหัว `docs/SRS.md` |
| **บทบาทสมาชิก 5 คน** | ⬜ ต้องเขียนใหม่ (ใช้ตารางหน้าแรกของเอกสารนี้) |

**ยังขาด:** รหัสนักศึกษาของ Thapanapat · Teerapat · Sorrawis

**เสร็จเมื่อ:** มีไฟล์ PDF ครบ 6 หัวข้อ และ commit เข้า repo แล้ว

---

## งาน C — Demo Slides

**ไฟล์:** `docs/slides/` (PDF หรือลิงก์ Google Slides ใน README ก็ได้)

เกณฑ์ M3 ให้ **3% (6 คะแนน)** กับ *"เล่าเรื่อง Problem→Solution + ตอบคำถาม 'ทำไม' ได้"*

**โครง 6 สไลด์:**

| # | สไลด์ | เนื้อหา |
|---|---|---|
| 1 | ปัญหา | จดแล้วเลิกใน 2–3 สัปดาห์ · ไม่รู้ว่าวันนี้ใช้ได้อีกเท่าไหร่ |
| 2 | ผู้ใช้ | นักศึกษา 18–24 เงินจำกัดต่อเดือน ใช้ LINE ทุกวัน |
| 3 | ทางแก้ | จดใน LINE 1 ข้อความ + อีเมลธนาคารเข้าเอง |
| 4 | **Demo สด** | พิมพ์ `กาแฟ 80` ใน LINE ให้ดู → เปิดเว็บโชว์ |
| 5 | Golden Thread | ปัญหา → FR → หน้าจอ → เทสต์ (ลอกจาก `docs/SRS.md` §7) |
| 6 | สิ่งที่เรียนรู้ | ยกจาก `docs/FINAL_REPORT.md` §7 |

**เสร็จเมื่อ:** ซ้อมเล่าได้ภายในเวลาที่กำหนด และตอบ "ทำไมถึงเลือกทำแบบนี้" ได้

---

# 2️⃣ Teerapat Palee — Frontend

> **Flex card 4 ใน 5 ใบยังว่างเปล่า** มีแต่ header comment กับ `export {};`

```
4992 bytes  src/line/flex/confirmCard.ts   ← เขียนเสร็จแล้ว ใช้เป็นแบบลอกได้
 451 bytes  src/line/flex/errorCard.ts     ← ว่าง
 420 bytes  src/line/flex/pendingCard.ts   ← ว่าง
 414 bytes  src/line/flex/summaryCard.ts   ← ว่าง
 390 bytes  src/line/flex/planCard.ts      ← ว่าง
 373 bytes  src/line/richmenu.ts           ← ว่าง
```

**อ่าน `confirmCard.ts` ก่อนเริ่มทุกงาน** — มันแสดงโครง Flex ที่โปรเจกต์นี้ใช้ ลอกแล้วเปลี่ยนเนื้อได้เลย

---

## งาน A — `summaryCard.ts` (สำคัญสุด ทำก่อน)

**ไฟล์:** `src/line/flex/summaryCard.ts`

**ตอนนี้:** พิมพ์ `สรุป` ใน LINE แล้วตอบเป็น **ข้อความธรรมดา**
**ต้องเป็น:** การ์ด Flex

**โครงที่ต้องเขียน:**

```ts
export type SummaryCardInput = {
  monthLabel: string;        // "กันยายน 2569"
  formattedIncome: string;   // "฿15,000.00"  ← format มาแล้ว
  formattedExpense: string;  // "฿8,200.00"
  formattedBalance: string;  // "฿6,800.00"
  topCategories: {
    name: string;            // "อาหาร"
    formattedAmount: string; // "฿3,200.00"
    percent: number;         // 39
  }[];
};

export function buildSummaryCard(input: SummaryCardInput) {
  // คืน object ตาม Flex Message JSON schema ของ LINE
  // ดูตัวอย่างโครงใน confirmCard.ts
}
```

**กฎที่ห้ามพลาด:**
- ⚖️ **G1** — ห้ามคำนวณเงินในไฟล์นี้เด็ดขาด รับค่าที่ format มาแล้วอย่างเดียว
- ⚖️ **G7** — ไม่นับรายการ `transfer` (service กรองมาให้แล้ว ไม่ต้องทำอะไร)
- แสดง **top 3 หมวด** — `command.service.ts` บรรทัด 71 เตรียมข้อมูลไว้แล้ว

**ต่อเข้าระบบ:** แก้ `src/services/command.service.ts` ให้คำสั่ง `สรุป` คืน Flex แทนข้อความ

**เสร็จเมื่อ:** พิมพ์ `สรุป` ใน LINE แล้วได้การ์ด ไม่ใช่ข้อความ

---

## งาน B — `planCard.ts`

**ไฟล์:** `src/line/flex/planCard.ts`

TODO ในไฟล์ระบุว่าต้องมี: **รอบแผน · เป้าหมาย · monthly save**

```ts
export type PlanCardInput = {
  title: string;               // "โน้ตบุ๊ก"
  formattedTarget: string;     // "฿25,000.00"
  formattedSaved: string;      // "฿5,000.00"
  formattedMonthly: string;    // "฿2,000.00"
  percentComplete: number;     // 20
  confidence: 'low' | 'medium' | 'high';
  dueMonth: string;            // "มิ.ย. 2570"
};
```

**ต้องมี:**
- แถบความคืบหน้า (ใช้ box ซ้อนกัน กว้างตาม `percentComplete`)
- **ป้ายระดับความมั่นใจ** 🔴 ต่ำ / 🟡 กลาง / 🟢 สูง — อันนี้สำคัญ เพราะ SRS §3.6 กำหนดไว้
- ⚖️ **G3** ยอดเป็นสตางค์ · ⚖️ **G7** transfer ไม่นับเป็นรายจ่าย

**ต่อเข้าระบบ:** คำสั่ง `แผน` ใน `command.service.ts`

---

## งาน C — `errorCard.ts` + `pendingCard.ts`

| ไฟล์ | ใช้ตอนไหน | ต้องมี |
|---|---|---|
| `errorCard.ts` | อ่านข้อความไม่ออก · ยอดเกินเพดาน · บันทึกไม่สำเร็จ | ข้อความบอกสาเหตุ + ตัวอย่างวิธีพิมพ์ที่ถูก |
| `pendingCard.ts` | AI ตีความแล้วรอคนยืนยัน (⚖️ **G2**) | ปุ่ม **✅ ยืนยัน** / **❌ ยกเลิก** |

> `pendingCard` ยังไม่มีใครเรียกใช้จนกว่าจะทำ FR-13 (AI) — แต่เขียนไว้ก่อนได้ และนับเป็นงานจริง

---

## งาน D — `richmenu.ts` + รูปเมนู

**ไฟล์:** `src/line/richmenu.ts`

เมนู 6 ช่องที่อยู่ด้านล่างหน้าแชท LINE

```
┌─────────┬─────────┬─────────┐
│  สรุป    │  เหลือ   │   งบ    │
├─────────┼─────────┼─────────┤
│  แผน    │ เปิดเว็บ  │ ช่วยเหลือ │
└─────────┴─────────┴─────────┘
```

- 5 ช่อง = `message` action ส่งข้อความคำสั่งที่มีอยู่แล้ว (`สรุป`, `เหลือ`, `งบ`, `แผน`, `ช่วยเหลือ`)
- "เปิดเว็บ" = `uri` action ไป `https://lumen-line.onrender.com`

**ต้องทำรูปด้วย:** ขนาด **2500 × 1686 px** (Canva หรือ Figma ก็ได้) แล้วอัปผ่าน LINE Developers Console

**เสร็จเมื่อ:** เปิดแชทบอทแล้วเห็นเมนู กดแล้วได้คำตอบ

---

# 3️⃣ Sorrawis Chumpheng — Technical Writer

## งาน A — สลับไฟล์ PDF (ด่วนสุด · 10 นาที)

🔴 **ตอนนี้บน `main` เป็น `M2-SRS_LumenLine.pdf` ซึ่งชื่อทีมผิด** (เขียน "Lumen Line" 10 จุดในเอกสาร)

ไฟล์ที่ถูกคือ `M2-SRS_Lumen.pdf`

```bash
cd /workspaces/Lumen_line
git checkout main && git pull origin main

git rm docs/M2-SRS_LumenLine.pdf

# อัปโหลด M2-SRS_Lumen.pdf เข้าโฟลเดอร์ docs/
# (ใน VS Code: คลิกขวาที่ docs → Upload...)

ls -la docs/M2-SRS_Lumen.pdf     # ต้องเห็นขนาด ~210K ก่อน commit

git add docs/M2-SRS_Lumen.pdf
git commit -m "Replace the SRS PDF with the corrected team name"
git push origin main
```

**เสร็จเมื่อ:** บน GitHub มีแค่ `M2-SRS_Lumen.pdf` ไม่มี `M2-SRS_LumenLine.pdf`

---

## งาน B — `docs/AI_USE_STATEMENT.md`

เกณฑ์ M4 ข้อ 8 บังคับส่ง · **ยกเนื้อจากที่เขียนไว้แล้ว** ไม่ต้องคิดใหม่

**แหล่ง:** `docs/FINAL_REPORT.md` §7 และ `docs/SRS.md` §8

**โครง 4 หัวข้อ:**

```markdown
# AI Use Statement — ทีม Lumen

## 1. ใช้ AI ตรงไหนบ้าง
- เขียนโค้ด: Claude Code ภายใต้กติกาใน AIDO.md
- ในตัวผลิตภัณฑ์: Gemini ตีความข้อความ (FR-13 — ยังไม่ได้ทำ)
- เอกสาร: ช่วยเรียบเรียง SRS และรายงานจากวัตถุดิบที่ทีมเขียนไว้

## 2. อะไรเวิร์ค
- งานที่มีแบบแผนชัด (query ที่ต้องกรอง user_id, แปลงรูปแบบข้อมูล, เขียนเทสต์)
- จับ edge case ที่คนมองข้าม (31 ม.ค. → 28 ก.พ., หารด้วย 0 วันสุดท้ายของเดือน)
- งานซ้ำ ๆ ที่พลาดง่าย (ไล่แก้ Number(id) เป็น String(id) ทั้งไฟล์)

## 3. อะไรไม่เวิร์ค — ต้องแก้เอง
- AI เขียนเกณฑ์เตือนงบจาก % ที่ปัดแล้ว → 79.99966% กลายเป็น 80% ยิงเตือนผิด
- เทสต์ขึ้นเขียวแต่ไฟล์ไม่ได้ถูกรันจริง (เกิด 2 ครั้ง) ต้องเพิ่ม tests/setup.ts
- AI เดาสาเหตุบั๊กผิดแล้วพูดอย่างมั่นใจ
- AI ไม่รู้ว่า Gmail ตัด +token ตอน forward — ต้องยิงอีเมลจริงถึงเจอ

## 4. บทเรียน
- กฎต้องเขียนเป็นเอกสารก่อน ไม่ใช่เตือนเป็นครั้ง ๆ (AIDO.md + กฎเหล็ก 7 ข้อ)
- AI เร่งการเขียนโค้ดได้ แต่ไม่ได้เร่งการ "รู้ว่าถูก" — เทสต์ 433 ข้อคือสิ่งที่ทำให้กล้าแก้โค้ด
- แยกส่วนที่ AI ห้ามแตะออกเป็นโมดูลจริง ทำให้กฎบังคับใช้เองโดยไม่ต้องอาศัยวินัย
- ทดสอบกับของจริงเสมอ
```

**เสร็จเมื่อ:** มีไฟล์ครบ 4 หัวข้อ commit แล้ว

---

## งาน C — กรอก Final Report ให้ครบ

**ไฟล์:** `docs/FINAL_REPORT.md` — มีช่อง ⬜ รอกรอกอยู่

| หัวข้อ | กรอกอะไร |
|---|---|
| **§1 หน้าปก** | ชื่อ-นามสกุล + รหัสนักศึกษา ครบทั้ง 5 คน |
| **§8.1** | GitHub account ของแต่ละคน + งานที่ทำ |
| **§8.2** 🔴 | **ใครกำกับ 39 commit ที่ขึ้นชื่อ AI** ← ห้ามเว้นข้อนี้ |

**§8.2 เขียนประมาณนี้:**

> commit ช่วง 14–18 ก.ย. (39 commit: Money Engine, Email Ingestion, Scheduler, Push & Quota และเทสต์ 433 ข้อ) เขียนด้วย Claude Code ภายใต้กติกาใน `AIDO.md` โดย **Teerat Wongpanti** เป็นผู้กำหนดโจทย์ ตรวจรับผลลัพธ์ และรับผิดชอบอธิบายในการสอบปากเปล่า

**ทำไมสำคัญ:** ถ้าปล่อยว่าง งานก้อนใหญ่ที่สุดของโปรเจกต์จะไม่มีชื่อใครติดอยู่ อาจารย์เปิด Insights แล้วเห็นแต่ชื่อ AI

---

## งาน D — เก็บ `SPEC.md` ให้ตรงกับ SRS

`SPEC.md` §4 ยังจัดลำดับเป็น **P0 / P1 / P2** แต่ SRS เปลี่ยนเป็น **Must / Should / Could** แล้ว

**วิธีแก้:** เพิ่มตารางเทียบท้าย §4 — **ลอกจาก `docs/SRS.md` ผนวก ค ได้ทั้งตาราง**

**ทำไมสำคัญ:** เกณฑ์ให้คะแนน coherence — เอกสาร 2 ฉบับที่ขัดกันเองเป็นจุดที่อาจารย์จับได้ง่าย

---

# 4️⃣ Aitthiphat Kanyathuean — Full-stack

## งาน A — ย้ายการจำลองซื้อไป backend 🔴 *(กระทบคะแนนโดยตรง)*

**ปัญหา:** FR-15 ขัดกับกฎเหล็ก **G1** ที่เขียนไว้ใน SRS เอง

```
SRS §2.2 Constraint:   "ตัวเลขเงินทุกตัวต้องมาจาก Money Engine"
SRS §7 Golden Thread:  "Money engine isolated from the AI module"

ความจริง:  getPurchaseSimulation() คำนวณอยู่ใน web/js/app.js (บรรทัด ~2495)
           ไม่มี src/services/simulate.service.ts เลย
```

ถ้าอาจารย์เปิดโค้ดเทียบกับ SRS จะเจอ — **เป็นช่องโหว่ coherence ซึ่งเป็นหัวใจที่เกณฑ์ให้คะแนน**

**ไฟล์ใหม่:** `src/services/simulate.service.ts`

```ts
export type SimulateInput = {
  userId: string;
  priceSatang: number;      // ⚖️ G3 จำนวนเต็มบวก
};

export type SimulateResult = {
  hasBudget: boolean;       // false = ยังไม่เคยตั้งงบ → ไม่ตัดสิน
  priceSatang: number;
  budgetLeftSatang: number;
  afterBuySatang: number;
  perDayBeforeSatang: number;
  perDayAfterSatang: number;
  overBySatang: number;
  monthsToSave: number | null;
  tone: 'ok' | 'warn' | 'over' | 'unknown';
};

export async function simulatePurchase(input: SimulateInput): Promise<SimulateResult>
```

**สูตร (ลอกจาก `web/js/app.js` ที่ทำงานถูกอยู่แล้ว):**
```
budgetLeft    = งบรวมเดือนนี้ − ที่ใช้ไปแล้ว
afterBuy      = budgetLeft − price
perDayBefore  = budgetLeft > 0 ? budgetLeft ÷ วันที่เหลือ : 0
perDayAfter   = afterBuy > 0 ? afterBuy ÷ วันที่เหลือ : 0
overBy        = max(0, price − max(0, budgetLeft))
monthsToSave  = กำลังออมต่อเดือน > 0 ? ceil(price ÷ กำลังออม) : null

tone:  ไม่มีงบ → 'unknown'  ·  price > budgetLeft → 'over'
       price > budgetLeft × 0.5 → 'warn'  ·  อื่น ๆ → 'ok'
```

**ต้องทำเพิ่ม:**
1. route `POST /api/simulate` ใน `src/routes/api.ts`
2. method `simulatePurchase()` ใน `web/js/api.js`
3. แก้ `getPurchaseSimulation()` ใน `app.js` ให้เรียก API แทนคำนวณเอง
4. **เทสต์** `tests/simulate.service.test.ts` — ต้องมี **ทางที่ผิด** ด้วย:
   - ยังไม่ตั้งงบ → `hasBudget: false` ไม่ตัดสินอะไร
   - ราคา 0 หรือติดลบ → ปฏิเสธ
   - วันสุดท้ายของเดือน → หารด้วย 1 ไม่ใช่ 0
   - กำลังออมเป็น 0 → `monthsToSave: null` ไม่ใช่ Infinity

**เสร็จเมื่อ:** `npm test` ผ่าน และหน้า "วิเคราะห์" ยังทำงานเหมือนเดิมแต่ตัวเลขมาจาก API

---

## งาน B — วาด diagram เป็นไฟล์รูป

ตอนนี้ Use Case และ Sequence diagram อยู่ใน `docs/FINAL_REPORT.md` §4.2–4.3 เป็น **ASCII art**

อ่านได้ แต่ถ้าเป็นรูปจะดูเป็นมืออาชีพกว่าตอน present

**ทำ:** วาดด้วย draw.io / Figma / Excalidraw → export PNG → `docs/diagrams/`
- `usecase.png` — 3 actor (ผู้ใช้ · ธนาคาร · Scheduler) + 8 use case
- `sequence-fr1.png` — flow ของ FR-1 (จดจากแชท)

แล้วแทนที่ ASCII ใน `FINAL_REPORT.md` ด้วย `![](diagrams/usecase.png)`

---

# 5️⃣ Teerat Wongpanti — Backend

## ~~งาน A — เปลี่ยนรหัสผ่าน Supabase~~ ❌ ยกเลิก ไม่ต้องทำ

**งานนี้เกิดจากการแจ้งเตือนที่ผิดพลาด** ตอนเขียนเอกสารฉบับแรกมีการสรุปว่ารหัสผ่าน
ฐานข้อมูลหลุดอยู่ใน git history ซึ่ง **ไม่จริง**

ตรวจ history ทุก commit แล้ว สิ่งที่พบคือ:

| ที่คิดว่าเจอ | ของจริง |
|---|---|
| รหัสผ่าน Supabase ใน git history | `postgresql://postgres:postgres@localhost:5432/jod_tang` ใน `.env.example` เก่า |
| | = **ค่า placeholder ของ localhost** ไม่ใช่รหัสจริง ไม่ใช่โฮสต์ของ Supabase |
| | ไม่มี JWT · ไม่มี service role key · ไม่มี URL ของ project จริงในทุก blob ของทุก commit |
| | `.env` ไม่เคยถูก commit และ `.gitignore` คลุมไว้ตั้งแต่ commit แรก |

**สรุป: ไม่มีความลับรั่ว ไม่ต้องเปลี่ยนรหัส** ถ้าเปิด GitHub issue ไว้แล้วให้ปิดได้เลย

> บันทึกไว้เพื่อไม่ให้ใครอ่านเอกสารฉบับเก่าแล้วไปเปลี่ยนรหัสโดยไม่จำเป็น —
> การเปลี่ยนรหัสฐานข้อมูลโดยไม่อัปเดต Render ให้ครบจะทำให้เว็บล่มทันที

---

## งาน A (ใหม่) — FR-17 สรุปรายวันส่งเข้า LINE *(ถ้ามีเวลา)*

**ไฟล์:** `src/jobs/dailySummary.ts` (ยังว่าง) · `src/jobs/index.ts`

เป็น FR เดียวในฝั่ง backend ที่ยังเหลือ และของที่ต้องใช้มีพร้อมหมดแล้ว:

| ต้องใช้ | มีแล้วที่ |
|---|---|
| ตัวเลขสรุป | `summary.service.ts` — `getUserSummary` / `getSafeToSpend` |
| ส่งข้อความ | `line/push.ts` |
| กันโควตาเกิน 280/เดือน | `quota.service.ts` |
| รู้ว่าใครเปิดรับ | คอลัมน์ `users.daily_summary_enabled` |
| ตัวรันตามเวลา | GitHub Actions เรียก `POST /jobs/run?job=...` |

```
เสร็จเมื่อ:
1. runDailySummary() ส่งเฉพาะคนที่ daily_summary_enabled = true
2. เช็คโควตาก่อนส่งทุกครั้ง (quota.service) — เกินแล้วข้าม ไม่ throw
3. เพิ่ม 'dailySummary' เข้า JOBS registry ใน jobs/index.ts
4. งานต้อง idempotent — รันซ้ำวันเดียวกันต้องไม่ส่งซ้ำ
5. มีเทสต์ครอบ: ปิดรับ → ไม่ส่ง · โควตาเต็ม → ไม่ส่ง · รันซ้ำ → ส่งครั้งเดียว
```

> ⚖️ G4: งานนี้ไม่พึ่ง AI เลย ปิด AI แล้วต้องยังทำงานได้

---

## งาน B — ตรวจงานของทีมก่อน merge

ในฐานะเจ้าของ repo และคนที่เข้าใจ Money Engine ที่สุด:
- ดู PR / commit ของคนอื่นก่อนขึ้น `main`
- โดยเฉพาะงาน A ของ Aitthiphat (แตะสูตรเงิน — ⚖️ G1, G3)
- รัน `npm test` ทุกครั้งก่อน push

> การ review ก็นับเป็น contribution ตามเกณฑ์

---

# ➕ งานเพิ่มเติม — ถ้ามีเวลาเหลือ

เรียงจากคุ้มค่าที่สุดลงไป

## 🥇 คุ้มมาก — ทำเถอะ

### 1. ซ้อมสอบปากเปล่า *(ทุกคน)*

เกณฑ์เขียนไว้ตรง ๆ ว่า **"Work you cannot explain earns no credit"**

แต่ละคนต้องตอบได้อย่างน้อย:
- FR ที่ตัวเองทำ คืออะไร แก้ปัญหาอะไร
- ทำไมถึงเลือกทำแบบนี้ ไม่ทำแบบอื่น
- ถ้าโดนถาม "ทำไม budget alert ต้องใช้การคูณไขว้" ตอบได้มั้ย

**คำถามที่น่าจะโดนถาม:**
| คำถาม | ใครควรตอบได้ |
|---|---|
| ทำไมเก็บเงินเป็นสตางค์ ไม่ใช่ทศนิยม | ทุกคน (⚖️ G3) |
| ทำไม transfer ไม่นับเป็นรายจ่าย | ทุกคน (⚖️ G7) |
| safe-to-spend คำนวณยังไง | Teerat / Aitthiphat |
| ทำไม AI ห้ามคำนวณเงิน | ทุกคน (⚖️ G1) |
| Golden Thread ของ FR-3 เป็นยังไง | Thapanapat / Sorrawis |

### 2. ลบ branch ที่ไม่ใช้แล้ว *(Thapanapat)*

ตอนนี้มี branch รก ๆ อยู่หลายอัน: `V3.1` · `Frontend` · `claude/wizardly-goodall-pm2et8` · `frontend-v2-on-main` · `Draw-a-mascot-and-message` (ว่างเปล่า)

เกณฑ์ M3 ให้คะแนน **"repo สะอาด"** — GitHub → Branches → ลบอันที่ merge แล้ว

### 3. ปรับ README ให้เป็นหน้าแรกที่ดี *(Sorrawis)*

อาจารย์เปิด repo มาเห็น README ก่อน ควรมี:
- ลิงก์ demo + ลิงก์ `prototype.html` อยู่บนสุด
- screenshot 1–2 รูป
- วิธีรันแบบ copy-paste ได้
- ลิงก์ไปเอกสารทุกฉบับใน `docs/`

### 4. ใส่ description + topics ใน repo *(Thapanapat)*

GitHub → repo → ⚙️ ข้าง About → ใส่คำอธิบาย + ลิงก์เว็บ + topics (`line-bot`, `typescript`, `expense-tracker`)

## 🥈 ดีถ้ามีเวลา

### 5. วิดีโอ demo 2–3 นาที *(Thapanapat)*

เกณฑ์ §10 บอกว่า *"ถ้ามี"* — ไม่บังคับ แต่ช่วยมากถ้า demo สดมีปัญหา

อัดหน้าจอ: พิมพ์ในแชท → ขึ้นในเว็บ → ตั้งงบ → สร้างแผน

### 6. job `dailySummary` *(Teerat)*

`src/jobs/dailySummary.ts` ยังว่าง (432 bytes) และ cron มีแค่ 4 ตัว

**ไม่อยู่ใน SRS** จึงไม่กระทบคะแนน FR — แต่ SPEC P1 ระบุไว้

### 7. FR-13 AI ตีความข้อความ *(Aitthiphat / Teerat)*

`src/services/ai/gemini.ts` ว่าง (350 bytes)

เป็น **Could** ใน SRS และ ⚖️ G4 บอกว่าปิด AI แล้วแอปต้องใช้ได้ — **ไม่ทำก็ไม่เสียคะแนน**

ถ้าทำต้องทำ `pending.service.ts` ด้วย (⚖️ G2 AI แตะข้อมูลต้องมีคนยืนยัน)

## 🥉 ไม่ต้องทำ

`FR-14` อ่านสลิป · `imageHandler.ts` — ต้องมี AI Vision ก่อน และเป็น Could

---

# 📅 ลำดับที่แนะนำ

| เมื่อไหร่ | ใคร | ทำอะไร |
|---|---|---|
| **วันนี้** | Thapanapat | เปิด Issues 13 อัน |
| **วันนี้** | Sorrawis | สลับ PDF (10 นาที) |
| **วันนี้** | Teerapat | ตั้ง git config + เริ่ม `summaryCard.ts` |
| **วันนี้** | Teerat | 🔴 เปลี่ยนรหัส Supabase |
| 1–2 วัน | Sorrawis | AI-Use Statement + กรอก Final Report |
| 1–2 วัน | Aitthiphat | `simulate.service.ts` + เทสต์ |
| 2–3 วัน | Teerapat | Flex card ที่เหลือ + rich menu |
| 2–3 วัน | Thapanapat | M1 Charter + Demo Slides |
| ก่อนส่ง | ทุกคน | ซ้อมสอบปากเปล่า |

---

# ✅ Checklist ก่อนส่ง

| # | สิ่งที่ต้องส่ง | สถานะ | ใคร |
|---|---|---|---|
| 1 | Team Charter (M1) | ❌ | Thapanapat |
| 2 | SRS (M2) | ✅ เสร็จ — รอสลับไฟล์ให้ชื่อถูก | Sorrawis |
| 3 | Design Doc + Diagrams | 🟡 มีแล้ว · ทำเป็นรูปจะดีกว่า | Aitthiphat |
| 4 | Clickable Prototype | ✅ เสร็จ · ขึ้นเว็บจริงแล้ว | — |
| 5 | Final Project Report | 🟡 เขียนเสร็จ · รอกรอกชื่อ | Sorrawis |
| 6 | GitHub Repo + README | 🟡 มีแล้ว · ควรปรับ README | Sorrawis |
| 7 | Demo Slides | ❌ | Thapanapat |
| 8 | AI-Use Statement | ❌ | Sorrawis |
| ★ | Golden Thread Table | ✅ อยู่ใน SRS §7 และ Report §9 | — |

**สถานะโค้ด:** Must FR **5/5** · Should FR **6/6** · Could FR **0/3** · เทสต์ **433 ข้อผ่าน**

---

*เอกสารนี้อัปเดตล่าสุด 5 ตุลาคม 2026 — ถ้าสถานะเปลี่ยน แก้ไฟล์นี้แล้ว commit ได้เลย*
