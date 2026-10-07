// ไฟล์นี้ทำหน้าที่อะไร: แปลงคำบอกวันที่ที่ผู้ใช้พิมพ์ ("เมื่อวาน", "1 ต.ค.") เป็นวันที่จริง
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.2 "date_text → thaiDate ได้ null → ถามกลับ"
// ⚖️ กฎเหล็ก G1 — AI ส่งมาแต่ "คำ" การแปลงเป็นวันที่จริงเป็นงานของโค้ดเท่านั้น
//
// ทำไมต้องแยกไฟล์จาก thaiDate.ts: thaiDate.ts เป็นเครื่องคิดเลขวันที่ที่แน่นอน
// (รับ ISO คืน ISO) ส่วนไฟล์นี้เดาใจจากภาษาคน ซึ่งผิดได้ จึงต้องแยกความรับผิดชอบ
// ให้ชัด — ของที่ผิดได้ต้องคืน null ให้ผู้เรียกไปถามผู้ใช้กลับ ห้ามเดาต่อ
//
// 🔴 หลักการสำคัญ: "ไม่รู้" ต้องคืน null ไม่ใช่คืนวันนี้
// ถ้าคืนวันนี้เวลาอ่านไม่ออก รายการจะไปลงผิดวันแบบเงียบ ๆ ผู้ใช้ไม่มีทางรู้เลย
// ว่ายอดของวันไหนเพี้ยน — ยอมถามกลับ 1 ครั้งดีกว่าข้อมูลผิดถาวร

import { addDaysIso, getTodayIso, isoDayOfWeek, parseIsoDate } from './thaiDate';

/** ย้อนหลังได้ไม่เกิน 1 ปี และล่วงหน้าได้ไม่เกินพรุ่งนี้ (SPEC §S11.2 sanity check) */
export const MAX_PAST_DAYS = 366;
export const MAX_FUTURE_DAYS = 1;

/** ชื่อเดือนไทยทั้งแบบเต็มและแบบย่อ → เลขเดือน 1-12 */
const THAI_MONTHS: Record<string, number> = {
  'มกราคม': 1, 'ม.ค.': 1, 'มค': 1,
  'กุมภาพันธ์': 2, 'ก.พ.': 2, 'กพ': 2,
  'มีนาคม': 3, 'มี.ค.': 3, 'มีค': 3,
  'เมษายน': 4, 'เม.ย.': 4, 'เมย': 4,
  'พฤษภาคม': 5, 'พ.ค.': 5, 'พค': 5,
  'มิถุนายน': 6, 'มิ.ย.': 6, 'มิย': 6,
  'กรกฎาคม': 7, 'ก.ค.': 7, 'กค': 7,
  'สิงหาคม': 8, 'ส.ค.': 8, 'สค': 8,
  'กันยายน': 9, 'ก.ย.': 9, 'กย': 9,
  'ตุลาคม': 10, 'ต.ค.': 10, 'ตค': 10,
  'พฤศจิกายน': 11, 'พ.ย.': 11, 'พย': 11,
  'ธันวาคม': 12, 'ธ.ค.': 12, 'ธค': 12,
};

/**
 * ชื่อวันในสัปดาห์ → เลขวันตามที่ thaiDate.isoDayOfWeek คืนมา
 * ⚠️ 0 = อาทิตย์ ถึง 6 = เสาร์ (ตรงกับ getUTCDay ไม่ใช่เลขวันแบบ ISO 1-7)
 */
const THAI_WEEKDAYS: Record<string, number> = {
  'อาทิตย์': 0, 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3,
  'พฤหัสบดี': 4, 'พฤหัส': 4, 'ศุกร์': 5, 'เสาร์': 6,
};

/** คำที่หมายถึงวันแบบตรงตัว → จำนวนวันที่ต้องขยับจากวันนี้ */
const RELATIVE_WORDS: Record<string, number> = {
  'วันนี้': 0,
  'เมื่อวาน': -1,
  'เมื่อวานนี้': -1,
  'วานนี้': -1,
  'เมื่อวานซืน': -2,
  'วานซืน': -2,
  'พรุ่งนี้': 1,
};

/**
 * ลบช่องว่างและอักขระประดับออก เพื่อให้เทียบคำได้ไม่ว่าผู้ใช้จะเว้นวรรคแบบไหน
 * เก็บ "." ไว้เพราะเดือนย่อภาษาไทยใช้จุด ("ต.ค.") และเก็บ "/" "-" ไว้สำหรับวันที่แบบตัวเลข
 */
function normalize(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** แปลงปีที่ผู้ใช้พิมพ์ให้เป็น ค.ศ. — รับทั้ง 2569 (พ.ศ.), 2026 (ค.ศ.), 69 และ 26 */
function toGregorianYear(raw: number): number | null {
  if (raw >= 2400 && raw <= 2600) return raw - 543; // พ.ศ. เต็ม
  if (raw >= 1900 && raw <= 2100) return raw; // ค.ศ. เต็ม
  if (raw >= 0 && raw <= 99) {
    // 2 หลัก: ลองทั้ง พ.ศ. ย่อ (69 → 2569 → 2026) และ ค.ศ. ย่อ (26 → 2026)
    // เลือกอันที่ใกล้ปีปัจจุบันกว่า เพราะคนพิมพ์ปีย่อหมายถึงปีใกล้ตัวเสมอ
    const current = Number(getTodayIso().slice(0, 4));
    const asBuddhist = 2500 + raw - 543;
    const asGregorian = 2000 + raw;
    return Math.abs(asBuddhist - current) <= Math.abs(asGregorian - current)
      ? asBuddhist
      : asGregorian;
  }
  return null;
}

/** ประกอบ ปี-เดือน-วัน เป็น ISO แล้วตรวจว่าเป็นวันที่ที่มีจริง (กัน 31 ก.พ.) */
function buildIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // parseIsoDate คืนค่าตามตัวเลขที่ใส่ไป ต้องเทียบกับ Date จริงเพื่อจับวันที่ไม่มีอยู่
  const probe = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(probe.getTime())) return null;
  if (probe.getUTCDate() !== day || probe.getUTCMonth() + 1 !== month) return null;
  return iso;
}

/**
 * เลือกปีให้วันที่ที่ผู้ใช้ไม่ได้บอกปีมา
 *
 * คนพูดถึงวันที่โดยไม่บอกปี มักหมายถึงอดีตที่ใกล้ที่สุด ("จ่ายไปวันที่ 1 ต.ค.")
 * ถ้าวัน-เดือนนั้นในปีนี้ยังไม่มาถึง (เลยพรุ่งนี้ไป) ให้ถอยไปปีก่อนหน้า
 */
function pickYearForMonthDay(month: number, day: number, todayIso: string): string | null {
  const thisYear = Number(todayIso.slice(0, 4));
  const limit = addDaysIso(todayIso, MAX_FUTURE_DAYS);

  for (const year of [thisYear, thisYear - 1]) {
    const iso = buildIso(year, month, day);
    if (iso && iso <= limit) return iso;
  }
  return null;
}

/** ย้อนไปหาวันในสัปดาห์ที่ผู้ใช้พูดถึงครั้งล่าสุด (รวมวันนี้ถ้าตรงกันพอดี) */
function lastWeekdayIso(targetDow: number, todayIso: string): string {
  const todayDow = isoDayOfWeek(todayIso);
  const back = (todayDow - targetDow + 7) % 7;
  return addDaysIso(todayIso, -back);
}

/**
 * แปลงคำบอกวันที่เป็น ISO date (YYYY-MM-DD) ตามเวลาไทย
 *
 * คืน null เมื่ออ่านไม่ออก หรืออ่านออกแต่อยู่นอกช่วงที่ยอมรับ
 * (ย้อนเกิน 1 ปี / ล่วงหน้าเกินพรุ่งนี้) — ผู้เรียกต้องถามผู้ใช้กลับ ห้ามเดาแทน
 *
 * @param raw คำที่ผู้ใช้พิมพ์ ส่งมาดิบ ๆ ตามที่ AI ดึงมาให้ (SPEC §S11.2)
 * @param todayIso วันนี้ตามเวลาไทย — รับเข้ามาเพื่อให้เทสต์กำหนดวันได้
 */
export function parseThaiDateText(raw: string, todayIso: string = getTodayIso()): string | null {
  if (typeof raw !== 'string') return null;

  const text = normalize(raw);
  if (!text) return null;

  const iso = matchAnyPattern(text, todayIso);
  if (!iso) return null;

  // ── sanity check (SPEC §S11.2): ไม่เกินพรุ่งนี้ และไม่ย้อนเกิน 1 ปี ──────────
  if (iso > addDaysIso(todayIso, MAX_FUTURE_DAYS)) return null;
  if (iso < addDaysIso(todayIso, -MAX_PAST_DAYS)) return null;

  return iso;
}

/** ไล่รูปแบบทั้งหมดตามลำดับจากเจาะจงที่สุดไปหยาบที่สุด — เจอแบบไหนก่อนใช้แบบนั้น */
function matchAnyPattern(text: string, todayIso: string): string | null {
  // 1) คำตรงตัว: วันนี้ / เมื่อวาน / พรุ่งนี้
  const relativeDays = RELATIVE_WORDS[text.replace(/\s/g, '')];
  if (relativeDays !== undefined) return addDaysIso(todayIso, relativeDays);

  // 2) "N วันก่อน" / "N วันที่แล้ว" / "เมื่อ N วันก่อน"
  const daysAgo = text.match(/(\d{1,3})\s*วัน(?:ก่อน|ที่แล้ว)/);
  if (daysAgo) return addDaysIso(todayIso, -Number(daysAgo[1]));

  // 3) "N สัปดาห์ก่อน" / "N อาทิตย์ที่แล้ว"
  const weeksAgo = text.match(/(\d{1,2})\s*(?:สัปดาห์|อาทิตย์)(?:ก่อน|ที่แล้ว)/);
  if (weeksAgo) return addDaysIso(todayIso, -Number(weeksAgo[1]) * 7);

  // 4) "สัปดาห์ที่แล้ว" / "อาทิตย์ที่แล้ว" แบบไม่มีจำนวน — กำกวมเกินไป
  //    "อาทิตย์ที่แล้ว" คนไทยใช้ทั้งความหมาย "สัปดาห์ก่อน" และ "วันอาทิตย์ที่ผ่านมา"
  //    ซึ่งต่างกันได้ถึง 6 วัน จึงต้องถามกลับ ห้ามเลือกข้างให้เอง
  if (/(?:สัปดาห์|อาทิตย์)\s*(?:ก่อน|ที่แล้ว)/.test(text)) return null;

  // 5) "วันจันทร์" / "จันทร์ที่แล้ว" — ย้อนไปวันนั้นครั้งล่าสุด
  //    จงใจไม่รองรับ "จันทร์หน้า" เพราะรายการเงินในอนาคตคือ recurring ไม่ใช่การจด
  for (const [name, dow] of Object.entries(THAI_WEEKDAYS)) {
    if (text.includes(name)) {
      if (/หน้า|ถัดไป/.test(text)) return null; // อนาคต — ไม่รับ ให้ถามกลับ
      return lastWeekdayIso(dow, todayIso);
    }
  }

  // 6) "1 ต.ค." / "1 ตุลาคม 2569" / "1 ตุลาคม 2026"
  const thaiMonth = matchThaiMonthFormat(text, todayIso);
  if (thaiMonth) return thaiMonth;

  // 7) ตัวเลขล้วน: "1/10", "1/10/2569", "01-10-2026", "2026-10-01"
  const numeric = matchNumericFormat(text, todayIso);
  if (numeric) return numeric;

  return null;
}

/** รูปแบบ "<วัน> <ชื่อเดือนไทย> [<ปี>]" */
function matchThaiMonthFormat(text: string, todayIso: string): string | null {
  // เรียงชื่อเดือนจากยาวไปสั้น ไม่งั้น "มี.ค." จะถูก "มิ.ย." ... หรือ "มค" ชนกับ "มกราคม"
  const names = Object.keys(THAI_MONTHS).sort((a, b) => b.length - a.length);

  for (const name of names) {
    const at = text.indexOf(name);
    if (at === -1) continue;

    const month = THAI_MONTHS[name]!; // name มาจาก Object.keys ของตารางนี้ จึงมีค่าเสมอ
    const before = text.slice(0, at);
    const after = text.slice(at + name.length);

    const dayMatch = before.match(/(\d{1,2})\s*$/);
    if (!dayMatch?.[1]) return null; // เจอชื่อเดือนแต่ไม่มีวันนำหน้า → อ่านไม่ออก
    const day = Number(dayMatch[1]);

    const yearMatch = after.match(/^\s*(\d{2,4})/);
    if (yearMatch?.[1]) {
      const year = toGregorianYear(Number(yearMatch[1]));
      return year === null ? null : buildIso(year, month, day);
    }
    return pickYearForMonthDay(month, day, todayIso);
  }
  return null;
}

/** รูปแบบตัวเลขล้วน — รับทั้ง D/M, D/M/Y และ ISO (Y-M-D) */
function matchNumericFormat(text: string, todayIso: string): string | null {
  // ISO มาก่อน เพราะ "2026-10-01" ขึ้นต้นด้วยเลข 4 หลักซึ่ง D/M/Y ไม่มีทางเป็น
  const isoShape = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoShape) {
    return buildIso(Number(isoShape[1]), Number(isoShape[2]), Number(isoShape[3]));
  }


  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (!dmy) return null;

  const day = Number(dmy[1]);
  const month = Number(dmy[2]);

  if (dmy[3] === undefined) return pickYearForMonthDay(month, day, todayIso);

  const year = toGregorianYear(Number(dmy[3]));
  return year === null ? null : buildIso(year, month, day);
}

/**
 * แปลง ISO date เป็นเวลาเที่ยงวันตามเขตเวลาไทย เพื่อใช้เป็น occurred_at
 *
 * ทำไมเที่ยงวันไม่ใช่เที่ยงคืน: เที่ยงคืนไทย (00:00+07:00) = 17:00 UTC ของวันก่อนหน้า
 * ถ้ามีโค้ดไหนหลุดไปอ่านเป็น UTC รายการจะเลื่อนไปวันก่อนหน้าทั้งก้อน
 * เที่ยงวันห่างจากขอบวันทั้งสองข้าง 12 ชั่วโมง จึงไม่มีทางเลื่อนวันจากเรื่องเขตเวลา
 */
export function isoDateToBangkokNoon(isoDate: string): Date {
  const { year, month, day } = parseIsoDate(isoDate);
  return new Date(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+07:00`
  );
}
