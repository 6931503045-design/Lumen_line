import { defineConfig } from 'vitest/config';

// ไฟล์นี้ทำหน้าที่อะไร: config ของการวัดผล AI กับ Gemini จริง (npm run eval:ai)
// แยกจาก vitest.config.ts เพราะ npm test / CI ต้องไม่เรียก AI จริงเด็ดขาด (SPEC §7)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['evals/**/*.eval.ts'],
    // env ปลอมของ LINE/Supabase ให้ config/env โหลดผ่าน — GEMINI_API_KEY ต้องมาจาก env จริงของคนรัน
    setupFiles: ['tests/setup.ts'],
    globals: false,
  },
});
