// ไฟล์นี้ทำหน้าที่อะไร: อ่านอีเมลแจ้งเตือนของ K PLUS / ธนาคารกสิกรไทย
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 / ตัวอย่างอีเมลจริงใน tests/fixtures/kplus/
// ⚖️ กฎเหล็ก G1, G3 — ดึงเลขที่อีเมลเขียนไว้เท่านั้น ไม่คำนวณ ไม่เดา
//
// ✅ pattern ชุดนี้เขียนจากอีเมล K PLUS ของจริง 3 ฉบับ (ชำระค่าสินค้า, โอนพร้อมเพย์ไปเบอร์,
//    โอนพร้อมเพย์ไป Wallet) ไม่ใช่การเดารูปแบบอีกต่อไป
//
// รูปแบบจริงที่ต้องระวังเป็นพิเศษ:
//
// 1) ชื่อฟิลด์มีวงเล็บหน่วยคั่นก่อน colon เสมอ → "จำนวนเงิน (บาท): 125.50"
//    ไม่ใช่ "จำนวนเงิน: 125.50" — pattern เดิมที่ไม่รองรับวงเล็บอ่านไม่ออกทั้ง 3 ฉบับ
//
// 2) ในอีเมลฉบับเดียวมีตัวเลขหน่วยบาทถึง 3 ตัว วางติดกัน:
//        จำนวนเงิน (บาท): 125.50      ← อันนี้เท่านั้นที่เป็นยอดรายการ
//        ค่าธรรมเนียม (บาท): 0.00      ← ค่าธรรมเนียม
//        ยอดถอนได้ (บาท): 1,234.56     ← ยอดคงเหลือในบัญชี
//    ห้ามใช้ regex กว้างๆ ที่จับ "ตัวเลขตามหลังคำว่าบาท" เด็ดขาด เพราะจะคว้ายอดคงเหลือ
//    มาบันทึกเป็นรายจ่ายได้ ทุก pattern จึงผูกกับชื่อฟิลด์ตรงๆ
//
// 3) เนื้ออีเมลมีทั้งภาษาไทยและอังกฤษที่ข้อมูลซ้ำกัน อ่านไทยก่อน ถ้าไม่เจอค่อยลองอังกฤษ
//
// 4) วันที่เป็น ค.ศ. 4 หลัก ("14/09/2026") ไม่ใช่ พ.ศ. — และมีเว้นวรรค 2 ตัวก่อนเวลา
//
// 5) ต้องเช็ค "(สำเร็จ)" ก่อนสร้างรายการ ไม่งั้นวันที่ธนาคารส่งอีเมลแจ้งรายการที่ล้มเหลว
//    ระบบจะบันทึกเงินที่ไม่เคยออกจากบัญชีจริง — และต้องเช็ค "ไม่สำเร็จ" ก่อน เพราะคำนั้น
//    มีคำว่า "สำเร็จ" อยู่ข้างใน
//
// ข้อตกลงที่ทีมเคาะแล้ว (อย่าเปลี่ยนโดยไม่คุยกันก่อน):
//   - โอนพร้อมเพย์ให้คนอื่น = expense ไม่ใช่ transfer
//     (transfer ตาม G7 สงวนไว้สำหรับการย้ายเงินภายในของผู้ใช้เอง เช่นเข้าแผนออม
//      ซึ่งจากอีเมลแยกไม่ออกอยู่แล้วว่าปลายทางเป็นบัญชีตัวเองหรือคนอื่น)
//   - ค่าธรรมเนียม (ค่าธรรมเนียม (บาท)) จงใจไม่บันทึกเป็นรายการแยก ตามที่ทีมตัดสินใจ
//     ตัวอย่างที่มีทั้งหมดเป็น 0.00 — ถ้าวันหนึ่งอยากเก็บ ให้เพิ่ม field ใน
//     BankEmailParseResult แล้วให้ email.service สร้างรายการที่สองต่างหาก
//   - คำที่ใช้ตอนรายการล้มเหลว ยังไม่มีใครเคยเห็นอีเมลจริง คำใน FAILURE_WORDS
//     จึงยังเป็นการเผื่อไว้ ไม่ใช่สิ่งที่ยืนยันแล้ว

import { toSatang } from '../../../utils/money';
import type { BankEmailParseResult, BankEmailParser } from './types';

/** ตัวเลขเงิน: มี comma คั่นหลักพันได้ มีทศนิยมได้ */
const MONEY = '([\\d,]+(?:\\.\\d{1,2})?)';

/** สร้าง pattern ของฟิลด์ที่มีวงเล็บหน่วยคั่น เช่น "จำนวนเงิน (บาท): 125.50" */
const moneyField = (label: string, unit: string) =>
  new RegExp(`${label}\\s*\\(${unit}\\)\\s*[:：]\\s*${MONEY}`);

/** ยอดรายการ — ผูกกับชื่อฟิลด์ตรงๆ ห้ามจับ "ค่าธรรมเนียม" หรือ "ยอดถอนได้" มาแทน */
const AMOUNT_TH = moneyField('จำนวนเงิน', 'บาท');
const AMOUNT_EN = moneyField('Amount', 'THB');

/** เลขที่รายการ เช่น "016257093615CPM09819" */
const REF_TH = /เลขที่รายการ\s*[:：]\s*([A-Za-z0-9]{6,40})/;
const REF_EN = /Transaction\s+Number\s*[:：]\s*([A-Za-z0-9]{6,40})/i;

/** วันเวลา "14/09/2026  09:36:15" (เว้นวรรคกี่ตัวก็ได้ วินาทีมีหรือไม่มีก็ได้) */
const DATETIME_TH = /วันที่ทำรายการ\s*[:：]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
const DATETIME_EN = /Transaction\s+Date\s*[:：]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/i;

/** คำที่บอกว่ารายการ "ล้มเหลว" — ต้องเช็คก่อนคำว่าสำเร็จเสมอ เพราะ "ไม่สำเร็จ" มี "สำเร็จ" อยู่ข้างใน */
const FAILURE_WORDS = ['ไม่สำเร็จ', 'ยกเลิก', 'unsuccessful', 'failed', 'failure'];

/** คำที่ยืนยันว่ารายการ "สำเร็จ" */
const SUCCESS_WORDS = ['(สำเร็จ)', 'สำเร็จ', '(success)', 'successful'];

/**
 * เงินออกจากบัญชีผู้ใช้ — ทั้งชำระค่าสินค้าและโอนออก
 * K PLUS ใช้คำว่า "จากบัญชี" กำกับบัญชีต้นทางเสมอ ซึ่งเป็นสัญญาณที่ชัดที่สุด
 */
const OUTGOING_MARKERS = [
  'ชำระเงินจากบัญชี',
  'โอนเงินจากบัญชี',
  'หักบัญชี',
  'paid from account',
  'from account',
];

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * อีเมลฉบับนี้เป็นรายการเงินออกไหม
 *
 * ทำไมมีแค่ขาออก: ทีมยืนยันแล้วว่า "ตอนนี้เงินเข้าไม่ได้แจ้งเตือนผ่าน Email" —
 * K PLUS ส่งอีเมลเฉพาะตอนเงินออกเท่านั้น เดิมไฟล์นี้มีรายการคำสำหรับจับ income ด้วย
 * แต่เป็นคำที่เดาเอาเองล้วนๆ ไม่เคยเห็นอีเมลจริงสักฉบับ จึงเอาออก — โค้ดที่ไม่เคยถูก
 * ตรวจกับของจริงและไม่มีวันได้ทำงาน เก็บไว้มีแต่จะหลอกคนอ่านว่าระบบรองรับแล้ว
 *
 * ถ้าวันหนึ่งธนาคารเริ่มส่งอีเมลเงินเข้า: อีเมลนั้นจะไม่ตรง marker ไหนเลย -> parse คืน null
 * -> เก็บไว้ใน user_emails แบบ parsed=false ให้เห็นว่ามีอีเมลที่อ่านไม่ออก ไม่ใช่เดาทิศทางผิด
 */
function isOutgoing(lowerText: string): boolean {
  return includesAny(lowerText, OUTGOING_MARKERS);
}

/** รายการนี้สำเร็จจริงไหม — ไม่แน่ใจถือว่าไม่สำเร็จ (fail closed) */
function isSuccessful(lowerText: string): boolean {
  if (includesAny(lowerText, FAILURE_WORDS)) return false;
  return includesAny(lowerText, SUCCESS_WORDS);
}

/** อ่านยอดเงินจาก pattern ไทยก่อน ถ้าไม่เจอลองอังกฤษ */
function readMoney(text: string, thai: RegExp, english: RegExp): number | null {
  const raw = thai.exec(text)?.[1] ?? english.exec(text)?.[1];
  if (!raw) return null;

  try {
    const satang = toSatang(raw.replace(/,/g, ''));
    return satang > 0 ? satang : null;
  } catch {
    // เกินเพดาน MAX_AMOUNT_SATANG หรือรูปแบบเพี้ยน — ถือว่าอ่านไม่ได้ ดีกว่าบันทึกยอดผิด
    return null;
  }
}

/** วันเวลาในอีเมลเป็นเวลาไทยเสมอ จึงต่อ +07:00 ตอนแปลง */
function readDateTime(text: string): Date | null {
  const match = DATETIME_TH.exec(text) ?? DATETIME_EN.exec(text);
  if (!match) return null;

  const [, day, month, year, hour, minute, second] = match as unknown as string[];
  const iso =
    `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}` +
    `T${hour!.padStart(2, '0')}:${minute}:${second ?? '00'}+07:00`;

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
    // toLowerCase ใช้กับการเทียบคำอังกฤษ ส่วนคำไทยไม่มีตัวพิมพ์เล็กใหญ่จึงไม่กระทบ
    const lower = text.toLowerCase();

    if (!isSuccessful(lower)) return null;
    if (!isOutgoing(lower)) return null;

    const amountSatang = readMoney(text, AMOUNT_TH, AMOUNT_EN);
    if (amountSatang === null) return null;

    const ref = REF_TH.exec(text)?.[1] ?? REF_EN.exec(text)?.[1] ?? null;

    return {
      amountSatang,
      // K PLUS ส่งอีเมลเฉพาะรายการเงินออก จึงเป็น expense เสมอ (ดู isOutgoing)
      type: 'expense',
      occurredAt: readDateTime(text),
      refNumber: ref,
    };
  },
};
