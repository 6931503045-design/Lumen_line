// ไฟล์นี้ทำหน้าที่อะไร: ตัวแปลงข้อความทางด่วน (L1) สำหรับคำสั่งทั่วไป เช่น "กาแฟ 80"
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W1
// อ้างอิง: SPEC.md §3 S1 ตาราง "คำสั่งในแชท", README.md แผนภาพ Router 4 ชั้น (L1)
// ⚖️ กฎเหล็ก G1, G2, G3 — ไฟล์นี้ดึงได้แค่ตัวเลขที่ผู้ใช้พิมพ์ตรงๆ ห้ามคำนวณ/ประมาณเอง
//
// 🆕 เสียบ utils/thaiNumber.ts เข้ามาเป็นตัวอ่านจำนวนเงินแทน parseAmount() ที่เขียนเองเดิม
//   เดิม thaiNumber.ts เขียนเสร็จแล้ว (มี 30 tests ผ่าน) แต่ไม่มีใคร import เลย ทำให้รูปแบบที่
//   SPEC §S4 สั่งไว้ใช้ในแชทไม่ได้จริง:
//     "กาแฟ ห้าสิบ"  เดิม none -> ตอนนี้ 50 บาท
//     "กาแฟ 80 บาท"  เดิม none -> ตอนนี้ 80 บาท
//     "ค่าเน็ต 1.2k"  เดิม none -> ตอนนี้ 1,200 บาท
//
// ⚠️ เปลี่ยน contract: ฟิลด์ผลลัพธ์เป็น `amountSatang` (สตางค์) ไม่ใช่ `amount` (บาท) แล้ว
//   เพราะ thaiNumber.ts คืนสตางค์อยู่แล้ว การแปลงกลับไปเป็นบาทเพื่อให้ผู้เรียกแปลงเป็นสตางค์อีกที
//   คือการแตะเลขเงินเกินจำเป็น ซึ่งขัดเจตนา G3 — ผู้เรียก (textHandler.ts) จึงไม่ต้องเรียก
//   money.toSatang() เองอีกต่อไป (จุดแปลงหน่วยยังอยู่ใน money.ts ที่เดียวเหมือนเดิม
//   เพราะ thaiNumber.ts เรียก toSatang ข้างในให้แล้ว)
//
// รูปแบบที่รองรับ:
//   1. "กาแฟ 80"         ชื่อ + เว้นวรรค + จำนวนเงิน
//   2. "ข้าว60"           ชื่อติดตัวเลขไม่มีเว้นวรรค
//   3. "+เงินเดือน 35000" ขึ้นต้นด้วย + = รายรับ
//      "ได้เงินค่าขนม 500"  ขึ้นต้นด้วยคำที่บอกว่าเงินเข้า = รายรับ (ดู INCOME_PREFIXES)
//      นอกนั้นเป็นรายจ่าย
//   4. "1,250 ซื้อของ"    จำนวนเงินขึ้นก่อน
//   และทุกแบบรับหน่วยท้ายจำนวนเงินได้ ("80 บาท", "80บ", "1.2k") กับคำอ่านไทย ("ห้าสิบ")
//
// ข้อจำกัดที่รู้อยู่: คำอ่านไทยที่เขียนติดชื่อหมวดโดยไม่เว้นวรรค ("ข้าวห้าสิบ") ยังไม่รองรับ
//   เพราะแยกไม่ออกว่าชื่อหมวดจบตรงไหน — เป็นเคสที่ต้องส่งต่อให้ L4 ตัดสิน ไม่ใช่เดาเอง

import { parseThaiNumber } from './thaiNumber';

/** ตัวเลขอารบิกที่เขียนติดชื่อหมวด เช่น "ข้าว60", "ข้าว60บาท", "ค่าเน็ต1.2k" */
const TRAILING_AMOUNT = /^(.+?)\s*([\d,]+(?:\.\d+)?\s*[kK]?\s*(?:บาท|บ|฿)?)$/;

/** จำนวนเงินยาวได้ไม่เกินกี่คำ — เผื่อหน่วยแยกคำ เช่น "80 บาท" หรือ "หนึ่งพันสอง บาท" */
const MAX_AMOUNT_TOKENS = 2;

/**
 * คำขึ้นต้นที่บอกว่าเป็น "เงินเข้า" — ใช้คู่กับเครื่องหมาย + ที่ SPEC กำหนดไว้เดิม
 *
 * ทำไมต้องมี: คนไทยไม่พิมพ์ + กัน พิมพ์ "ได้เงินค่าขนม 500" หรือ "เงินเดือนออก 15000"
 * ตามปกติ แล้วถูกบันทึกเป็นรายจ่ายทั้งหมด ซึ่งทำให้ยอดคงเหลือผิดไปสองเท่าของจำนวนนั้น
 * (ควรบวกแต่กลับลบ) เป็นความผิดพลาดที่ผู้ใช้สังเกตยากเพราะตัวเลขถูก แค่ทิศทางผิด
 *
 * 🔴 เทียบแบบ "ขึ้นต้นด้วย" เท่านั้น ไม่ใช่ includes() — ไม่งั้น "จ่ายค่าได้เสีย 200"
 * จะกลายเป็นรายรับ ความเสียหายของการเดาผิดฝั่งนี้สูงกว่าการไม่เดาเลย
 * คำที่กำกวมปล่อยให้ L4 (AI) ตัดสินดีกว่า เพราะมันเห็นประโยคเต็ม
 */
const INCOME_PREFIXES = [
  'ได้เงิน',
  'ได้ค่า',
  'รับเงิน',
  'เงินเดือน',
  'ได้โบนัส',
  'โบนัส',
  'เงินเข้า',
  'ขายได้',
  'ได้ทุน',
  'ทุนการศึกษา',
] as const;

/**
 * ข้อความนี้ขึ้นต้นด้วยคำที่บอกว่าเป็นรายรับไหม — คืนคำที่ตรง หรือ null
 * ตัดคำนั้นออกไม่ได้ เพราะมันเป็นส่วนหนึ่งของชื่อรายการ ("เงินเดือน", "ได้ค่าขนม")
 */
function matchIncomePrefix(text: string): boolean {
  return INCOME_PREFIXES.some((word) => text.startsWith(word));
}

export type ParseConfidence = 'high' | 'none';

export type ParseResult = {
  /** จำนวนเงินหน่วยสตางค์ (integer) พร้อมส่งเข้า transaction.service ได้เลย */
  amountSatang?: number;
  category?: string;
  type?: 'income' | 'expense';
  rawText: string;
  confidence: ParseConfidence;
};

type Extracted = { amountSatang: number; category: string };

/**
 * จับข้อความทางด่วน (L1) ให้ได้จำนวนเงิน + ชื่อหมวดดิบ + ประเภท
 * คืน confidence: 'none' ถ้าจับไม่ได้เลย — router (W2) จะรู้ว่าต้องส่งต่อ L2/L3/L4
 */
export function parseQuickExpenseText(input: string): ParseResult {
  const rawText = input;
  let text = input.trim();

  if (!text) {
    return { rawText, confidence: 'none' };
  }

  // "+" นำหน้า = รายรับ ตาม SPEC · หรือขึ้นต้นด้วยคำที่บอกว่าเงินเข้า
  let type: 'income' | 'expense' = 'expense';
  if (text.startsWith('+')) {
    type = 'income';
    text = text.slice(1).trim();
    if (!text) {
      return { rawText, confidence: 'none' };
    }
  } else if (matchIncomePrefix(text)) {
    type = 'income';
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  const found = matchAmountFirst(tokens) ?? matchAmountLast(tokens) ?? matchAttached(text);

  if (!found) {
    return { rawText, confidence: 'none' };
  }

  return {
    amountSatang: found.amountSatang,
    category: found.category,
    type,
    rawText,
    confidence: 'high',
  };
}

/** แบบที่ 4: จำนวนเงินอยู่คำแรก (หรือสองคำแรกถ้ามีหน่วยแยก) เช่น "1,250 ซื้อของ" */
function matchAmountFirst(tokens: string[]): Extracted | null {
  const maxTake = Math.min(MAX_AMOUNT_TOKENS, tokens.length - 1);
  for (let take = 1; take <= maxTake; take += 1) {
    const result = build(tokens.slice(0, take), tokens.slice(take));
    if (result) return result;
  }
  return null;
}

/** แบบที่ 1: จำนวนเงินอยู่คำท้าย (หรือสองคำท้ายถ้ามีหน่วยแยก) เช่น "กาแฟ 80", "กาแฟ 80 บาท" */
function matchAmountLast(tokens: string[]): Extracted | null {
  const maxTake = Math.min(MAX_AMOUNT_TOKENS, tokens.length - 1);
  for (let take = 1; take <= maxTake; take += 1) {
    const splitAt = tokens.length - take;
    const result = build(tokens.slice(splitAt), tokens.slice(0, splitAt));
    if (result) return result;
  }
  return null;
}

/** แบบที่ 2: ชื่อติดตัวเลขไม่มีเว้นวรรค เช่น "ข้าว60" */
function matchAttached(text: string): Extracted | null {
  const match = TRAILING_AMOUNT.exec(text);
  if (!match) return null;
  // ทั้งสอง group เป็น capture บังคับ จึงมีค่าเสมอเมื่อ match สำเร็จ
  return build([match[2]!], [match[1]!]);
}

/**
 * ประกอบผลลัพธ์จาก "คำที่เดาว่าเป็นจำนวนเงิน" กับ "คำที่เหลือเป็นชื่อหมวด"
 * คืน null ถ้าฝั่งใดฝั่งหนึ่งใช้ไม่ได้ — ให้ผู้เรียกลองรูปแบบถัดไป
 */
function build(amountTokens: string[], categoryTokens: string[]): Extracted | null {
  const category = categoryTokens.join(' ').trim();
  if (!isValidCategoryName(category)) return null;

  const amountSatang = parseThaiNumber(amountTokens.join(' '));
  // parseThaiNumber คืน 0 ได้ (เช่นข้อความ "0" หรือ "ศูนย์") ซึ่งผิดกฎ G3 ที่เงินต้องมากกว่า 0
  if (amountSatang === null || amountSatang <= 0) return null;

  return { amountSatang, category };
}

/**
 * ชื่อหมวดต้องไม่ว่างเปล่า และห้ามเป็นตัวเลข/comma/จุด/ช่องว่างล้วนๆ
 * (กันเคส "12345" ที่ไม่มีคำอธิบายเลย ไม่ให้ถูกตัดเป็น หมวด "1" + จำนวนเงิน "2345")
 */
function isValidCategoryName(category: string): boolean {
  return category.length > 0 && !/^[\d,.\s]+$/.test(category);
}
