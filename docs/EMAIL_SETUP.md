# ตั้งค่าระบบอ่านอีเมลธนาคาร (SPEC §S8)

เอกสารนี้ไล่ทีละขั้นจนอีเมลจาก K PLUS กลายเป็นรายการเงินในแอปได้จริง

> โค้ดฝั่ง backend เขียนเสร็จแล้วทั้งหมด เอกสารนี้คือ **การตั้งค่า** ล้วนๆ
> เช็คว่าพร้อมหรือยังได้ที่ `GET /health` → `features.emailIngest`

---

## ภาพรวม: อีเมลเดินทางยังไง

```
K PLUS ส่งอีเมล
      ↓
Gmail ส่วนตัวของผู้ใช้        (personal@gmail.com)
      ↓  filter: forward อัตโนมัติ
Gmail ของบอท + token         (jodtang.bot+a1b2c3@gmail.com)
      ↓  emailPoll ดึงทาง IMAP ทุก 5 นาที
backend → ตรวจ token → ตรวจ DKIM → กันซ้ำ → redact → regex → transaction
```

**ต้องใช้ Gmail สองบัญชี** — บัญชีส่วนตัวของผู้ใช้ กับบัญชีกลางของบอท
Gmail ไม่ยอมให้ตั้ง forward ไปหาบัญชีตัวเอง (รวมถึงแบบ `+alias` ด้วย)

---

## ⚠️ ลำดับสำคัญ — อ่านก่อนเริ่ม

ตั้ง `GMAIL_USER` **ก่อน** แล้วค่อยตั้ง `GMAIL_APP_PASSWORD` ทีหลัง เพราะ:

- หน้า `/settings` แสดงที่อยู่ `+token` ได้ทันทีที่มี `GMAIL_USER` (ดู `buildIngestAddress`)
- แต่ `emailPoll` จะเริ่มทำงานต่อเมื่อมี **ทั้งสองตัว** (`Boolean(gmailUser && gmailAppPassword)`)

ถ้าตั้งพร้อมกันตั้งแต่แรก บอทจะเข้าไปอ่านแล้ว mark อีเมลยืนยันของ Gmail
ว่า "อ่านแล้ว" ภายใน 5 นาที (อีเมลไม่หาย แต่หายาก เพราะไม่เด่นในกล่องแล้ว)

---

## ขั้นที่ 1 — เตรียม Gmail ของบอท

1. สร้าง/เลือกบัญชี Gmail สำหรับบอท เช่น `jodtang.bot@gmail.com`
2. เปิด **2-Step Verification** ที่ <https://myaccount.google.com/security>
   (ถ้าไม่เปิด เมนู App passwords จะไม่ขึ้นเลย)
3. เปิด **IMAP**: Gmail → ⚙️ See all settings → **Forwarding and POP/IMAP**
   → Enable IMAP → Save Changes
   (บัญชีใหม่มักเปิดไว้อยู่แล้ว แต่ต้องยืนยันด้วยตา — ถ้าปิดอยู่ จะ login ไม่ผ่านแบบ
   ไม่บอกสาเหตุตรงๆ)

## ขั้นที่ 2 — สร้าง App Password

1. ไปที่ <https://myaccount.google.com/apppasswords>
2. ตั้งชื่อ เช่น `JOD tang backend` → Create
3. ได้รหัส **16 ตัวอักษร** แสดงเป็น 4 กลุ่ม เช่น `abcd efgh ijkl mnop`
4. **คัดลอกเก็บทันที** ปิดหน้าต่างแล้วดูซ้ำไม่ได้
5. เวลาเอาไปใส่ env → **ลบช่องว่างออก** เหลือ `abcdefghijklmnop`

> 🔒 รหัสนี้เท่ากับกุญแจเข้ากล่องอีเมลทั้งใบ ห้าม commit ลง repo
> ห้ามใส่ใน `.env.example` และห้ามส่งในแชท

## ขั้นที่ 3 — ใส่ `GMAIL_USER` ที่ Render (ตัวเดียวก่อน)

1. Render Dashboard → เลือก service `lumen-line`
2. แท็บ **Environment** → **Add Environment Variable**
3. `GMAIL_USER` = `jodtang.bot@gmail.com` (ที่อยู่เต็ม รวม `@gmail.com`)
4. **Save Changes** → Render deploy ใหม่อัตโนมัติ รอ ~2 นาที

เช็ค: `curl https://lumen-line.onrender.com/health`
→ `emailIngest` ยังเป็น `false` (ถูกต้อง เพราะยังไม่มี app password)

## ขั้นที่ 4 — เอาที่อยู่ `+token` ของผู้ใช้

1. เปิดเว็บแอป → เข้าสู่ระบบด้วย LINE → หน้า **ตั้งค่า**
2. จะเห็นที่อยู่แบบ `jodtang.bot+a1b2c3d4@gmail.com`
3. คัดลอกไว้

token นี้ผูกกับผู้ใช้คนนั้นคนเดียว (คอลัมน์ `users.email_ingest_token`)
เป็นตัวบอกว่าอีเมลที่เข้ามาเป็นของใคร (⚖️ G6) — ถ้าสงสัยว่าหลุด กดปุ่มสร้างใหม่ได้
ที่อยู่เดิมจะใช้ไม่ได้ทันที

## ขั้นที่ 5 — ตั้ง forward ที่ Gmail ส่วนตัวของผู้ใช้

1. Gmail ส่วนตัว → ⚙️ See all settings → **Forwarding and POP/IMAP**
2. **Add a forwarding address** → วางที่อยู่จากขั้นที่ 4 → Next → Proceed
3. Gmail ส่งอีเมลยืนยันไปที่กล่องของบอท
4. เปิด Gmail ของบอท → หาอีเมล **"Gmail Forwarding Confirmation"** → กดลิงก์ยืนยัน
5. กลับมาที่ Gmail ส่วนตัว → แท็บ **Filters and Blocked Addresses**
   → **Create a new filter**
   - ช่อง **From**: `kasikornbank.com OR kbank.co.th OR kasikornbankgroup.com`
   - Create filter → ติ๊ก **Forward it to:** แล้วเลือกที่อยู่ `+token`
   - Create filter

> อย่าตั้ง "Forward a copy of incoming mail" แบบทั้งกล่อง — จะส่งอีเมลส่วนตัวทุกฉบับ
> เข้ากล่องบอทโดยไม่จำเป็น ใช้ filter เฉพาะโดเมนธนาคารเท่านั้น

## ขั้นที่ 6 — เปิดแจ้งเตือนอีเมลในแอป K PLUS

เปิดการแจ้งเตือนทางอีเมลสำหรับรายการเงินเข้า-ออก
(ถ้ายังไม่เปิด จะไม่มีอีเมลให้ forward เลย)

## ขั้นที่ 7 — ใส่ `GMAIL_APP_PASSWORD` แล้วเปิดระบบ

1. Render → Environment → `GMAIL_APP_PASSWORD` = รหัส 16 ตัว (ไม่มีช่องว่าง)
2. Save Changes → รอ deploy
3. เช็ค: `curl https://lumen-line.onrender.com/health`
   → ต้องได้ `"emailIngest": true` และ `notConfigured` ไม่มี `emailIngest` แล้ว

---

## ขั้นที่ 8 — ยิงจริง

**วิธีที่ง่ายที่สุด** (ไม่ต้องรู้ค่า `CRON_SECRET`):

GitHub → แท็บ **Actions** → workflow **Cron** → **Run workflow** → เลือก branch `main` → Run

เปิด log ของ step "เรียก emailPoll" จะเห็น JSON แบบนี้:

```json
{"ok":true,"job":"emailPoll","durationMs":3200,
 "result":{"fetched":2,"created":1,"duplicates":0,"unparsed":0,"skipped":1}}
```

**หรือยิงเอง** (ต้องมีค่า `CRON_SECRET` จาก Render):

```bash
curl -X POST "https://lumen-line.onrender.com/jobs/run?job=emailPoll" \
  -H "x-cron-secret: <CRON_SECRET>"
```

### อ่านผลยังไง

| ตัวเลข | หมายความว่า |
|---|---|
| `fetched` | อ่านอีเมลที่ยังไม่ถูกอ่าน (unseen) มากี่ฉบับ — **0 = ไม่มีอีเมลเข้ากล่องบอทเลย** |
| `created` | สร้างรายการเงินสำเร็จกี่ฉบับ ✅ |
| `duplicates` | ตรวจเจอว่าซ้ำกับรายการเดิม (S10) — ถูกต้องแล้ว ไม่ใช่ error |
| `unparsed` | เก็บ body ไว้แล้วแต่อ่านตัวเลขไม่ออก / ไม่ใช่ธนาคารที่รองรับ |
| `skipped` | ไม่มี token / DKIM ไม่ผ่าน / เคยอ่านฉบับนี้แล้ว |

`unparsed` ไม่ได้หายไปไหน — `body_redacted` ถูกเก็บไว้ กลับมา parse ใหม่ได้เมื่อแก้ pattern
จำนวนที่ค้างอยู่ดูได้ที่ `/api/settings` → `emailIngest.unparsedCount`

---

## แก้ปัญหา

หลังยิงแล้ว ดู log ที่ Render → แท็บ **Logs** ข้อความขึ้นต้นด้วย `[email]`

| อาการ | สาเหตุ | แก้ยังไง |
|---|---|---|
| `emailIngest: false` หลังตั้ง env แล้ว | Render ยัง deploy ไม่จบ หรือพิมพ์ชื่อตัวแปรผิด | รอ deploy จบ แล้วเทียบชื่อให้ตรงเป๊ะ (ตัวพิมพ์ใหญ่ทั้งหมด) |
| job ตอบ 401 | `x-cron-secret` ไม่ตรง | เทียบกับค่าใน Render (ต้องตรงทุกตัว) |
| job ตอบ 503 | ยังไม่ได้ตั้ง `CRON_SECRET` | ตั้งที่ Render |
| `Invalid credentials` / login ไม่ผ่าน | ใช้รหัสผ่าน Gmail ปกติ แทน App Password / ยังไม่เปิด IMAP / มีช่องว่างติดมา | ทำขั้นที่ 1–2 ใหม่ |
| `fetched: 0` ตลอด | ไม่มีอีเมลเข้ากล่องบอท | เข้า Gmail ของบอทดูตรงๆ ว่ามีอีเมลจากธนาคารไหม ถ้าไม่มี = filter ที่ Gmail ส่วนตัวไม่ทำงาน |
| `fetched: 0` ทั้งที่เห็นอีเมลในกล่อง | อีเมลถูก mark ว่าอ่านแล้ว (job หยิบเฉพาะ unseen) | mark unread แล้วยิงใหม่ |
| `[email] ข้าม: ไม่พบ +token ในที่อยู่ปลายทาง` | forward แบบไม่ได้ใช้ที่อยู่ `+token` หรือส่งเข้ากล่องบอทตรงๆ | ตรวจ filter ที่ Gmail ส่วนตัวให้ forward ไปที่อยู่ `+token` |
| `[email] ข้าม: token ไม่ตรงกับผู้ใช้ที่ใช้งานอยู่` | token เก่า (กด rotate ไปแล้ว) หรือผู้ใช้ `is_active = false` | เอาที่อยู่ใหม่จาก `/settings` มาตั้ง filter ใหม่ |
| `[email] ข้าม: DKIM ไม่ผ่านโดเมนธนาคาร (ลงนามโดย: ...)` | ⚠️ ดูหัวข้อถัดไป | |
| `[email] บันทึกไว้แต่ยังไม่รองรับธนาคารนี้` | ไม่ใช่อีเมล K PLUS | ต้องเขียน parser เพิ่มใน `src/services/email/banks/` |
| `[email] บันทึกไว้แต่ parse ไม่ออก (kbank)` | รูปแบบอีเมลต่างจาก fixture ที่ใช้เขียน pattern | เอา `body_redacted` จาก `user_emails` มาเทียบกับ `tests/fixtures/kplus/` |

### ⚠️ กรณี DKIM ไม่ผ่าน — จุดเสี่ยงที่สุด

เราตรวจ DKIM ไม่ตรวจ SPF โดยตั้งใจ เพราะการ forward ทำให้ SPF ไม่ผ่านเสมอ
แต่ลายเซ็น DKIM ของธนาคารยังติดมากับตัวอีเมล (ดูเหตุผลเต็มใน `src/services/email/dkim.ts`)

**ข้อจำกัดที่ต้องรู้:** fixture ที่ใช้เทสต์เป็นเนื้อความล้วน ไม่มี header จริง
เส้นทาง "ผ่าน Gmail forward จริง" จึงยังไม่เคยถูกทดสอบ

ถ้าเจอ log นี้ ให้ดูว่า `signedBy` มีโดเมนอะไร:

- **มีโดเมนธนาคารแต่สะกดต่างจาก whitelist** → เพิ่มโดเมนใน
  `src/services/email/banks/kbank.ts` → `dkimDomains`
  (ปัจจุบัน: `kasikornbank.com`, `kbank.co.th`, `kasikornbankgroup.com`)
- **ว่างเปล่า / ไม่มีโดเมนธนาคารเลย** → ลายเซ็นพังระหว่าง forward
  ตรวจดู header `Authentication-Results` ของอีเมลจริง (Gmail → ⋮ → Show original)

**ห้ามแก้ด้วยการปิดการตรวจ DKIM** — ที่อยู่ `+token` ไม่ใช่ความลับระดับรหัสผ่าน
ถ้าไม่ตรวจว่าอีเมลมาจากธนาคารจริง ใครที่รู้ที่อยู่นั้นก็ส่งอีเมลปลอมเข้ามา
สร้างรายการเงินในบัญชีคนอื่นได้ทันที

---

## หลังตั้งเสร็จ

- `emailPoll` ทำงานเองทุก 5 นาทีผ่าน GitHub Actions (`.github/workflows/cron.yml`)
- ⚠️ workflow ที่มี `schedule` ลงทะเบียนจาก **default branch** เท่านั้น
  แก้ `cron.yml` บน branch อื่นแล้วไม่เห็นผลคือเรื่องปกติ
- รายการจากอีเมล**ยังไม่มีหมวด** เพราะอีเมลธนาคารบอกแค่จำนวนเงินกับปลายทาง
  จึงยังไม่ไปกระตุ้นการเตือนงบรายหมวด (S5.8) จนกว่าจะมีตัวเดาหมวด (S4)
