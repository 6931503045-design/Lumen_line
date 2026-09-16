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

/**
 * วันแรกของเดือนปัจจุบันตามเวลาไทย รูปแบบ ISO `YYYY-MM-01`
 * ใช้เป็นขอบล่างตอน query ยอดรวม "เดือนนี้"
 */
export function getMonthStartIso(date: Date = new Date()): string {
  return `${getTodayIso(date).slice(0, 7)}-01`;
}

/**
 * วันแรกของเดือนที่ย้อนหลังไป n เดือนตามเวลาไทย รูปแบบ ISO `YYYY-MM-01`
 * getMonthStartIso() คือกรณี n = 0 — ใช้ทำกราฟย้อนหลัง 6 เดือน
 *
 * คำนวณด้วยเลขปี/เดือนตรงๆ ไม่ใช่ลบวัน เพราะเดือนยาวไม่เท่ากัน
 */
export function getMonthStartIsoAgo(monthsAgo: number, date: Date = new Date()): string {
  const [yearText, monthText] = getTodayIso(date).split('-') as [string, string, string];
  const zeroBasedMonth = Number(yearText) * 12 + (Number(monthText) - 1) - monthsAgo;
  const year = Math.floor(zeroBasedMonth / 12);
  const month = (zeroBasedMonth % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** ป้ายเดือนแบบสั้นภาษาไทยสำหรับแกนกราฟ เช่น "2026-09" -> "ก.ย." */
export function formatThaiMonthLabel(isoMonth: string): string {
  const [yearText, monthText] = isoMonth.split('-') as [string, string];
  // ใช้วันที่ 15 เพื่อเลี่ยงปัญหาขอบเดือนตอนแปลง timezone
  const date = new Date(`${yearText}-${monthText}-15T00:00:00Z`);
  return new Intl.DateTimeFormat('th-TH', { timeZone: TIMEZONE, month: 'short' }).format(date);
}

/**
 * แปลงวันที่ ISO (`YYYY-MM-DD`) เป็นเวลาเริ่มต้นของวันนั้น "ตามเวลาไทย" ในรูป timestamptz
 * เช่น "2026-09-01" -> "2026-09-01T00:00:00+07:00"
 *
 * จำเป็นเพราะคอลัมน์ occurred_at เป็น timestamptz ถ้าส่งแค่ "2026-09-01" เข้าไปเทียบ
 * Postgres จะตีความเป็นเที่ยงคืน UTC ซึ่งเร็วกว่าเที่ยงคืนกรุงเทพ 7 ชั่วโมง
 * ทำให้รายการช่วงหัวค่ำของวันสิ้นเดือนก่อนหน้าหลุดเข้ามาปนในเดือนนี้
 */
export function toBangkokDayStart(isoDate: string): string {
  return `${isoDate}T00:00:00+07:00`;
}

/**
 * เลื่อนเดือนจาก "วันแรกของเดือน" ที่ให้มา ไปข้างหน้า/ข้างหลัง n เดือน
 * รับ `YYYY-MM-DD` หรือ `YYYY-MM` ก็ได้ คืน `YYYY-MM-01` เสมอ
 *
 * ต่างจาก getMonthStartIsoAgo ตรงที่อันนั้นนับจาก "วันนี้" ส่วนอันนี้นับจากเดือนที่ระบุ
 * ใช้หาขอบบนของช่วง query รายเดือน (เดือนถัดไป) โดยไม่ต้องสร้าง Date ให้เสี่ยง timezone
 */
export function shiftMonthStartIso(monthIso: string, months: number): string {
  const [yearText, monthText] = monthIso.split('-') as [string, string];
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`shiftMonthStartIso: รูปแบบเดือนไม่ถูกต้อง "${monthIso}"`);
  }
  const zeroBasedMonth = year * 12 + (month - 1) + months;
  const shiftedYear = Math.floor(zeroBasedMonth / 12);
  const shiftedMonth = (zeroBasedMonth % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, '0')}-01`;
}

/** ทำให้ค่าที่รับมาจากภายนอกเป็น `YYYY-MM-01` ที่เชื่อถือได้ คืน null ถ้าไม่ใช่เดือนที่ถูกต้อง */
export function normalizeMonthIso(value: string): string | null {
  const matched = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value.trim());
  if (!matched) return null;
  const month = Number(matched[2]);
  if (month < 1 || month > 12) return null;
  return `${matched[1]}-${matched[2]}-01`;
}
