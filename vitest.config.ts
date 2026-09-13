import { defineConfig } from 'vitest/config';

// ไฟล์นี้ทำหน้าที่อะไร: ตั้งค่า vitest ให้รู้จักโฟลเดอร์ tests/ และรันแบบ Node environment
// อ้างอิง: SPEC.md §7 "Test (vitest)" — ห้ามเรียก Gemini จริงใน test ต้อง mock เสมอ (ตั้งไว้เป็นข้อบังคับ ไม่ใช่ config ตรงนี้)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});