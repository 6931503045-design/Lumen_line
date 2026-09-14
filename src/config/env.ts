// ไฟล์นี้ทำหน้าที่อะไร: โหลดค่า environment และทำ validation แบบเบื้องต้นก่อนใช้ใน app
// ใครรับผิดชอบ: ① Bot Core / ② Database
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม schema validation แบบ Zod เมื่อเริ่มเชื่อมจริงกับ LINE / Supabase / Gemini
// ⚖️ กฎเหล็ก G4, G5, G6

import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  tz: process.env.TZ || 'Asia/Bangkok',
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
  lineLoginChannelId: process.env.LINE_LOGIN_CHANNEL_ID || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  aiEnabled: (process.env.AI_ENABLED || 'true').toLowerCase() === 'true',
  aiDailyLimitPerUser: Number(process.env.AI_DAILY_LIMIT_PER_USER || 30),
  aiDailyLimitGlobal: Number(process.env.AI_DAILY_LIMIT_GLOBAL || 0),
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 8000),
  cronSecret: process.env.CRON_SECRET || '',
  liffId: process.env.LIFF_ID || '',
};
