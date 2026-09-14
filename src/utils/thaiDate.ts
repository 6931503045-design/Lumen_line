// ไฟล์นี้ทำหน้าที่อะไร: helper สำหรับจัดการวันที่แบบไทยและ timezone Asia/Bangkok
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W2
// TODO: เพิ่ม parser สำหรับข้อความภาษาไทย เช่น "วันนี้", "เมื่อวาน", "2 วันก่อน"
// ⚖️ กฎเหล็ก G5
//
// 🔴 แก้บั๊ก: getThaiToday() เดิมคืน "14/9/2569" (พ.ศ. + รูปแบบ d/m/yyyy) ซึ่งเอาไปใส่
//   คอลัมน์ date/timestamptz ของ Postgres ไม่ได้ ถ้ามีใครเผลอเอาไปใช้กับ occurred_at
//   หรือ budgets.month จะพังหรือได้ปีผิดไป 543 ปี
//
// ตอนนี้แยกหน้าที่ให้ชัด: ค่าที่ใช้กับ DB เป็น ISO (ค.ศ.) ส่วนค่าที่โชว์ให้คนอ่านเป็นไทย (พ.ศ.)
// ห้ามเอา formatThaiDate() ไปเขียนลง DB เด็ดขาด

import { TIMEZONE } from '../config/constants';

/** en-CA ให้รูปแบบ YYYY-MM-DD พอดี ซึ่งเป็นรูปแบบเดียวที่ Postgres รับเป็น date ตรงๆ */
const ISO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const THAI_DISPLAY = new Intl.DateTimeFormat('th-TH', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/**
 * วันที่ "วันนี้" ตามเวลาไทย ในรูปแบบ ISO `YYYY-MM-DD` (ค.ศ.)
 * ใช้ตัวนี้เสมอเมื่อจะเขียนลง DB หรือเทียบช่วงวัน — ห้ามใช้ new Date() ตรงๆ เพราะเซิร์ฟเวอร์เป็น UTC
 */
export function getTodayIso(date: Date = new Date()): string {
  return ISO_DATE.format(date);
}

/**
 * วันที่สำหรับ "แสดงให้คนอ่าน" เป็นภาษาไทย พ.ศ. เช่น "14 ก.ย. 2569"
 * ใช้ได้เฉพาะในข้อความตอบกลับ LINE / Flex card เท่านั้น ห้ามเขียนลง DB
 */
export function formatThaiDate(date: Date = new Date()): string {
  return THAI_DISPLAY.format(date);
}
