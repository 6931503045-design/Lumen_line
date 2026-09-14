// ไฟล์นี้ทำหน้าที่อะไร: จัดการ log แบบรวมศูนย์ เพื่อช่วย debug รับส่งข้อมูล LINE และ AI
// ใครรับผิดชอบ: ① Bot Core / ⑤ Integration
// เขียนในสัปดาห์: W1
// TODO: เพิ่มระดับ log จริงและส่งไปยัง Supabase logs เมื่อ backend พร้อม
// ⚖️ กฎเหล็ก G5, G6

export const logger = {
  info: (...args: unknown[]) => console.info('[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
};
