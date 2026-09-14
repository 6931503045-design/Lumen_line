// ไฟล์นี้ทำหน้าที่อะไร: โหลดค่า environment แล้ว validate ด้วย Zod ก่อนให้ส่วนอื่นเอาไปใช้
// ใครรับผิดชอบ: ① Bot Core / ② Database
// เขียนในสัปดาห์: W1
// ⚖️ กฎเหล็ก G4, G5, G6
//
// ทำไมต้อง validate ตรงนี้: ก่อนหน้านี้ทุกค่าใช้ `|| ''` ทำให้ env ที่หายไป "เงียบ" แล้วไปโผล่เป็น
// error ของ library ตอน import แทน (เช่น `Error: supabaseUrl is required.` จาก @supabase/supabase-js)
// ซึ่งตอน deploy จริงจะไล่หาสาเหตุยากมาก — ตอนนี้ถ้า env ไม่ครบจะตายตั้งแต่ boot พร้อมบอกชื่อ env ที่ขาด
//
// หมายเหตุ: โปรเจกต์เลิกใช้ LIFF แล้ว เปลี่ยนเป็นเว็บธรรมดาที่ backend เสิร์ฟเอง
// LIFF_ID และ LIFF_ORIGIN จึงถูกถอดออก — ไม่มีโค้ดไหนอ่านสองค่านั้นแล้ว
//
// หมายเหตุ PUSH_LIMIT: เป็น "ค่าคงที่" ตาม SPEC §7 อยู่ใน config/constants.ts ไม่ใช่ env
// (เดิม .env.example ประกาศ PUSH_LIMIT=100 ไว้ด้วยแต่ไม่มีโค้ดไหนอ่าน และขัดกับ constants.ts ที่เป็น 280)

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/** แปลง string จาก env เป็น boolean แบบชัดเจน ('true'/'false' เท่านั้น ไม่เดาจากค่าอื่น) */
const booleanFromString = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value.toLowerCase() === 'true'));

/** แปลง string จาก env เป็นจำนวนเต็มบวก พร้อมค่า default ถ้าไม่ได้ตั้ง */
const intFromString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? defaultValue : Number(value)))
    .pipe(z.number().int().nonnegative());

const envSchema = z.object({
  PORT: intFromString(3000),
  NODE_ENV: z.string().default('development'),
  TZ: z.string().default('Asia/Bangkok'),

  // ── LINE (จำเป็น: ไม่มีก็รับ webhook / ตอบข้อความไม่ได้เลย) ────────────────
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1, 'ต้องมีค่า (เอาจาก LINE Developers > Messaging API)'),
  LINE_CHANNEL_SECRET: z.string().min(1, 'ต้องมีค่า (ใช้ตรวจลายเซ็น webhook)'),
  // LINE Login — ใช้ทั้งตอน redirect ไปหน้าล็อกอินและตอนแลก code เป็น id_token
  // channel secret จำเป็นเฉพาะเว็บ: สมัย LIFF ไม่ต้องใช้เพราะ SDK ส่ง id_token มาให้เลย
  LINE_LOGIN_CHANNEL_ID: z.string().optional().default(''),
  LINE_LOGIN_CHANNEL_SECRET: z.string().optional().default(''),

  // ── Supabase (จำเป็น: ไม่มีก็เขียน/อ่าน DB ไม่ได้เลย) ──────────────────────
  SUPABASE_URL: z.string().url('ต้องเป็น URL เต็ม เช่น https://xxxx.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'ต้องมีค่า (service_role key เท่านั้น ไม่ใช่ anon key)'),

  // ── AI (ไม่จำเป็น: G4 บอกว่าปิด AI แล้วแอปต้องยังใช้ได้) ───────────────────
  AI_PROVIDER: z.string().default('gemini'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  AI_ENABLED: booleanFromString(true),
  AI_DAILY_LIMIT_PER_USER: intFromString(30),
  AI_DAILY_LIMIT_GLOBAL: intFromString(0),
  AI_TIMEOUT_MS: intFromString(8000),

  // ── งานที่ยังไม่ได้ทำ แต่ .env.example ประกาศไว้แล้ว ───────────────────────
  // URL ที่ผู้ใช้เปิดเว็บนี้ ใช้ประกอบ redirect_uri ตอน OAuth และเช็ค Origin กัน CSRF
  // เช่น "https://jodtang.onrender.com" (ไม่ต้องมี / ปิดท้าย)
  APP_BASE_URL: z.string().optional().default(''),

  // กุญแจเซ็น session cookie — สุ่มเองด้วย `openssl rand -hex 32`
  // เปลี่ยนค่านี้เมื่อไหร่ = ทุกคนหลุดล็อกอินทันที (ซึ่งเป็นสิ่งที่ต้องการเวลาสงสัยว่ากุญแจรั่ว)
  SESSION_SECRET: z.string().optional().default(''),
  CRON_SECRET: z.string().optional().default(''),
  GMAIL_USER: z.string().optional().default(''),
  GMAIL_APP_PASSWORD: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `ตั้งค่า environment ไม่ครบหรือไม่ถูกต้อง ${parsed.error.issues.length} รายการ:\n${problems}\n` +
      'ดูรายการทั้งหมดได้ที่ .env.example'
  );
}

const raw = parsed.data;

export const env = {
  port: raw.PORT,
  nodeEnv: raw.NODE_ENV,
  tz: raw.TZ,
  lineChannelAccessToken: raw.LINE_CHANNEL_ACCESS_TOKEN,
  lineChannelSecret: raw.LINE_CHANNEL_SECRET,
  lineLoginChannelId: raw.LINE_LOGIN_CHANNEL_ID,
  lineLoginChannelSecret: raw.LINE_LOGIN_CHANNEL_SECRET,
  supabaseUrl: raw.SUPABASE_URL,
  supabaseServiceRoleKey: raw.SUPABASE_SERVICE_ROLE_KEY,
  aiProvider: raw.AI_PROVIDER,
  geminiApiKey: raw.GEMINI_API_KEY,
  geminiModel: raw.GEMINI_MODEL,
  aiEnabled: raw.AI_ENABLED,
  aiDailyLimitPerUser: raw.AI_DAILY_LIMIT_PER_USER,
  aiDailyLimitGlobal: raw.AI_DAILY_LIMIT_GLOBAL,
  aiTimeoutMs: raw.AI_TIMEOUT_MS,
  appBaseUrl: raw.APP_BASE_URL.replace(/\/$/, ''),
  sessionSecret: raw.SESSION_SECRET,
  cronSecret: raw.CRON_SECRET,
  gmailUser: raw.GMAIL_USER,
  gmailAppPassword: raw.GMAIL_APP_PASSWORD,
} as const;
