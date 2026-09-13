// ไฟล์นี้ทำหน้าที่อะไร: สร้าง client สำหรับเข้าถึง Supabase แบบ service role และแยก logic ของ query
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W1
// TODO: ตั้งค่า retry, timeout และ RLS-safe queries ต่อเมื่อโครงสร้างจริงพร้อมใช้งาน
// ⚖️ กฎเหล็ก G6

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
