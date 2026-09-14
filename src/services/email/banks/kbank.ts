// ไฟล์นี้ทำหน้าที่อะไร: อ่านอีเมลแจ้งเตือนของ K PLUS / กสิกรไทย
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 (ธนาคารแรกที่ต้องรองรับคือ K PLUS)
// ⚖️ กฎเหล็ก G1, G3 — ดึงเลขที่อีเมลเขียนไว้เท่านั้น ไม่คำนวณ ไม่เดา
//
// 🔴 สิ่งที่ทีมต้องทำก่อนใช้จริง: pattern ด้านล่างเขียนจากรูปแบบข้อความแจ้งเตือนภาษาไทย
// แบบทั่วไป ยังไม่ได้ตรวจกับอีเมล K PLUS ของจริง เพราะ repo ไม่มีตัวอย่างอีเมลเก็บไว้เลย
// ให้เอาอีเมลจริง 1 ฉบับมาลบเลขบัญชี/ชื่อ/ยอดเงินออก (SPEC §S8 บังคับ) แล้วเพิ่มเป็น fixture
// ใน tests/fixtures/ แล้วปรับ pattern ให้ตรง — ออกแบบให้แก้ไฟล์นี้ไฟล์เดียวจบ
//
// ระหว่างที่ยังไม่ได้ตรวจ parser จะคืน null เมื่ออ่านไม่ครบ ซึ่งทำให้อีเมลถูกบันทึกไว้
// ใน user_emails แบบ parsed=false โดยไม่สร้างรายการผิดๆ — ปลอดภัยกว่าเดา

import { toSatang } from '../../../utils/money';
import type { BankEmailParseResult, BankEmailParser } from './types';

/** จำนวนเงิน: "250.00 บาท", "1,250 บาท", "THB 250.00" */
const AMOUNT_PATTERN = /(?:จำนวนเงิน|จำนวน|ยอดเงิน|THB|บาท)\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:บาท|THB)?/;

/** เลขที่รายการ / เลขอ้างอิง */
const REF_PATTERN = /(?:เลขที่รายการ|เลขอ้างอิง|รหัสอ้างอิง|Ref(?:erence)?(?:\s*No\.?)?)\s*[:：]?\s*([A-Za-z0-9]{6,30})/;

/** วันเวลา: "14/09/26 10:30", "14/09/2569 10:30:15", "14-09-2026 10:30" */
const DATETIME_PATTERN = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;

/** คำที่บอกว่าเงิน "เข้า" — ตรวจก่อนคำเงินออกเสมอ */
const INCOME_WORDS = ['เงินเข้า', 'รับโอน', 'โอนเข้า', 'ฝากเงิน', 'เงินโอนเข้า'];

/** คำที่บอกว่าเงิน "ออก" */
const EXPENSE_WORDS = ['เงินออก', 'ถอนเงิน', 'โอนออก', 'ชำระเงิน', 'ใช้จ่ายผ่านบัตร', 'หักบัญชี', 'ซื้อสินค้า'];

function detectDirection(text: string): 'income' | 'expense' | null {
  if (INCOME_WORDS.some((word) => text.includes(word))) return 'income';
  if (EXPENSE_WORDS.some((word) => text.includes(word))) return 'expense';
  return null;
}

/**
 * แปลงวันเวลาไทยเป็น Date โดยถือว่าเวลาในอีเมลเป็นเวลาไทย (+07:00)
 * รองรับทั้งปี พ.ศ. 4 หลัก (2569), ค.ศ. 4 หลัก (2026) และ 2 หลัก (26)
 */
function parseThaiDateTime(text: string): Date | null {
  const match = DATETIME_PATTERN.exec(text);
  if (!match) return null;

  const [, dayText, monthText, yearText, hourText, minuteText, secondText] = match as unknown as string[];
  let year = Number(yearText);

  if (year < 100) {
    // 2 หลัก: ธนาคารไทยมักใช้ปี พ.ศ. ท้ายสองหลัก เช่น 69 = 2569 = ค.ศ. 2026
    year += year >= 50 ? 2500 : 2000;
  }
  // ปี พ.ศ. อยู่ในช่วง 2400-2700 แปลงเป็น ค.ศ.
  if (year >= 2400) year -= 543;

  const iso =
    `${String(year).padStart(4, '0')}-${monthText!.padStart(2, '0')}-${dayText!.padStart(2, '0')}` +
    `T${hourText!.padStart(2, '0')}:${minuteText}:${(secondText ?? '00').padStart(2, '0')}+07:00`;

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const kbankParser: BankEmailParser = {
  bank: 'kbank',

  dkimDomains: ['kasikornbank.com', 'kbank.co.th', 'kasikornbankgroup.com'],

  matches(fromAddress, subject, text) {
    const haystack = `${fromAddress} ${subject} ${text}`.toLowerCase();
    return (
      haystack.includes('kasikorn') ||
      haystack.includes('kbank') ||
      haystack.includes('k plus') ||
      haystack.includes('กสิกรไทย')
    );
  },

  parse(text): BankEmailParseResult | null {
    const type = detectDirection(text);
    if (!type) return null;

    const amountMatch = AMOUNT_PATTERN.exec(text);
    if (!amountMatch?.[1]) return null;

    let amountSatang: number;
    try {
      amountSatang = toSatang(amountMatch[1].replace(/,/g, ''));
    } catch {
      // เกินเพดาน หรือรูปแบบเพี้ยน — ถือว่าอ่านไม่ได้ ดีกว่าบันทึกยอดผิด
      return null;
    }
    if (amountSatang <= 0) return null;

    const refMatch = REF_PATTERN.exec(text);

    return {
      amountSatang,
      type,
      occurredAt: parseThaiDateTime(text),
      refNumber: refMatch?.[1] ?? null,
    };
  },
};
