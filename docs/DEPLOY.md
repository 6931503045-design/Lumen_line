# วิธี deploy JOD tang

ทำตามลำดับ ข้ามขั้นไม่ได้เพราะขั้นหลังต้องใช้ผลจากขั้นก่อน

backend ตัวเดียวทำทุกอย่าง — รับ webhook ของบอท, เสิร์ฟ API, เสิร์ฟหน้าเว็บ
จึง deploy ครั้งเดียวได้ domain เดียวไปใช้ทุกที่

---

## 1. เตรียม Supabase

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. เปิด SQL Editor แล้วรัน `supabase/migrations/001_init.sql` ตามด้วย `002_updated_at_trigger.sql`
3. เก็บค่าไว้จาก Settings → API
   - Project URL → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (ห้ามใช้ anon key เด็ดขาด)

> service_role key ข้าม RLS ได้ทั้งหมด ห้ามให้หลุดไปฝั่งเบราว์เซอร์

---

## 2. Deploy backend

### Render (ฟรี แต่หลับเมื่อไม่มีคนใช้)

| ช่อง | ค่า |
|---|---|
| Repository | repo นี้ |
| Branch | `backend` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |

### Railway (ไม่หลับ ใช้เครดิตฟรีรายเดือน)

ตรวจ build/start ให้เองจาก `package.json` ส่วนใหญ่ไม่ต้องตั้งอะไร

### ตั้ง env (ทั้งสองเจ้าเหมือนกัน)

รอบแรกใส่เท่าที่มีก่อนได้ ยังไม่ต้องมี `APP_BASE_URL` เพราะยังไม่รู้ domain

```
NODE_ENV=production
TZ=Asia/Bangkok
LINE_CHANNEL_ACCESS_TOKEN=...      # Messaging API channel
LINE_CHANNEL_SECRET=...            # Messaging API channel
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=...                 # สร้างด้วย: openssl rand -hex 32
CRON_SECRET=...                    # สร้างด้วย: openssl rand -hex 32
```

**ไม่ต้องตั้ง `PORT`** — host ตั้งให้เอง โค้ดอ่านจาก env อยู่แล้ว

deploy เสร็จแล้ว **ก๊อป domain ที่ได้มา** เช่น `https://jodtang.onrender.com`

---

## 3. เอา domain กลับไปใส่ 3 ที่

| ที่ | ค่า |
|---|---|
| env ของ host | `APP_BASE_URL=https://<domain>` |
| LINE Developers → **Messaging API channel** → Webhook URL | `https://<domain>/webhook` |
| LINE Developers → **LINE Login channel** → แท็บ LINE Login → Callback URL | `https://<domain>/auth/callback` |

แล้วเอาค่าจาก **LINE Login channel** → แท็บ Basic settings มาใส่ env เพิ่ม:

```
LINE_LOGIN_CHANNEL_ID=...
LINE_LOGIN_CHANNEL_SECRET=...
```

deploy ใหม่อีกรอบ

> ⚠️ **LINE Login channel ต้องอยู่ Provider เดียวกับ Messaging API channel**
> เอกสาร LINE ระบุว่า user ID ไม่ซ้ำกันเฉพาะภายใน provider เดียวกัน
> ถ้าคนละ provider คนเดียวกันจะได้ ID คนละตัว → ล็อกอินแล้วหาบัญชีไม่เจอตลอดกาล
> โดยไม่มี error บอกสาเหตุ

---

## 4. GitHub Actions

Settings → Secrets and variables → Actions → New repository secret

| ชื่อ | ค่า |
|---|---|
| `BACKEND_URL` | `https://<domain>` |
| `CRON_SECRET` | ค่าเดียวกับ env ของ backend |

- `cron.yml` ยิง `/jobs/run?job=emailPoll` ทุก 5 นาที
- `ping.yml` ปลุก `/health` ทุก 5 นาที — **ปิดได้ถ้าใช้ host ที่ไม่หลับ**

---

## 5. ระบบอ่านอีเมล (ทำทีหลังได้)

1. สร้าง [App Password](https://myaccount.google.com/apppasswords) ของ Gmail (ต้องเปิด 2FA ก่อน ไม่ใช่รหัสผ่านปกติ)
2. ใส่ env `GMAIL_USER` และ `GMAIL_APP_PASSWORD` แล้ว deploy ใหม่
3. เปิดหน้าเว็บ → ตั้งค่า → ก๊อปที่อยู่ `<gmail>+<token>@gmail.com`
4. ใน Gmail สร้าง filter: อีเมลจาก `kasikornbank.com` → Forward ไปที่อยู่นั้น (ต้องยืนยันอีเมลของ Gmail ก่อน)

---

## 6. ตรวจว่าใช้ได้จริง

### เปิด `https://<domain>/health`

บอกได้เลยว่าตั้งค่าอะไรครบแล้วบ้าง ตัวไหนที่อยู่ใน `notConfigured` คือยังขาด

```json
{ "ok": true, "features": { "bot": true, "webLogin": true, ... }, "notConfigured": [] }
```

### ไล่เช็คทีละอย่าง

| ทำอะไร | ต้องได้อะไร |
|---|---|
| เปิด `https://<domain>/` | เห็นหน้าเว็บพร้อมแถบ "เข้าสู่ระบบด้วย LINE" |
| แอดเพื่อนบอทใน LINE | มีแถวใหม่ในตาราง `users` + หมวดตั้งต้น 11 หมวด |
| พิมพ์ `กาแฟ 80` ในแชท | บอทตอบการ์ดยืนยัน |
| กดเข้าสู่ระบบบนเว็บ | เห็นหน้าขออนุญาตของ LINE แล้วกลับมาเห็นชื่อจริงกับรายการที่เพิ่งพิมพ์ |

### อาการที่เจอบ่อยกับสาเหตุ

| อาการ | สาเหตุ |
|---|---|
| กดล็อกอินแล้วขึ้น 503 พร้อมชื่อ env | env ตัวนั้นยังไม่ได้ตั้ง |
| LINE ขึ้น error เรื่อง `redirect_uri` | Callback URL ไม่ตรงเป๊ะกับ `APP_BASE_URL` + `/auth/callback` |
| ล็อกอินผ่านแต่เด้งไป `?login=no-account` | ยังไม่ได้แอดเพื่อนบอท **หรือ** สอง channel อยู่คนละ provider |
| บอทไม่ตอบข้อความแรกหลังเงียบนาน | instance หลับ — ตั้ง `BACKEND_URL` ให้ `ping.yml` |
| อีเมลไม่เข้าเลย | ดู log หาบรรทัด `[email] ข้าม:` จะบอกว่าตกด่านไหน (token/DKIM/ธนาคารไม่รองรับ) |
