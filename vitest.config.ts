// ไฟล์นี้ทำหน้าที่อะไร: ตั้งค่า Vitest สำหรับรัน unit test เฉพาะฟังก์ชันคำนวณเงินและข้อความ
// ใครรับผิดชอบ: ⑤ Integration / ② Database / ③ AI
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม test pattern ตามผังกำหนดจริง และจัดโครงสร้าง coverage ให้ครบทุก service
// ⚖️ กฎเหล็ก G1, G3, G5
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
