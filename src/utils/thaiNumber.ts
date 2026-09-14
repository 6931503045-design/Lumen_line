// ไฟล์นี้ทำหน้าที่อะไร: แปลงข้อความจำนวนเงินรูปแบบต่างๆ (เลขอารบิก, มีคอมมา, มีหน่วย k, มีสกุลเงิน, เลขไทยเป็นคำ)
//                        ให้เป็นจำนวนสตางค์ (integer) — เป็นฟันเฟืองตัวแรกสุดของ L1 ใน S4 Text Parser
// ใครรับผิดชอบ: ③ AI (ตาม SPEC.md §S4 — แม้ไฟล์นี้ไม่มี AI เลยก็ตาม เป็นแค่ regex/string ล้วนๆ)
// เขียนในสัปดาห์: W1
// อ้างอิง: SPEC.md §S4 "thaiNumber ต้องรองรับ: 50, 1,500, 1.2k, 50บ, 50฿, 50บาท, ห้าสิบ, สองร้อยห้าสิบ, หนึ่งพันสอง"
//
// หลักการสำคัญ (เหมือน thaiDate ตาม SPEC): "ไม่เข้าใจคืน null ห้ามเดา"
//   ฟังก์ชันนี้คืนค่า null ทุกครั้งที่ไม่มั่นใจ 100% ว่าตีความถูก แทนที่จะเดาแล้วบันทึกเงินผิดจำนวน
//   ผู้เรียก (regexParser.ts) มีหน้าที่ส่งต่อไป L4 (Gemini) เมื่อได้ null ไม่ใช่หน้าที่ของไฟล์นี้
//
// ข้อสมมติสำคัญ: ฟังก์ชันนี้รับ "ข้อความที่แยกเป็นก้อนตัวเลขล้วนๆ แล้ว" (เช่น regexParser ตัดคำว่า
//   "กาแฟ" ออกไปก่อนแล้วส่งมาแค่ "80") ไม่ใช่ประโยคเต็มปนคำอื่น — ถ้าส่งประโยคเต็มมาจะได้ null เสมอ
//   เพราะเจอคำที่ไม่รู้จักปนอยู่ (เป็นไปตามหลัก "ห้ามเดา" เช่นกัน)
//
// ⚠️ กฎเหล็ก G3: ทุกค่าที่คืนจากไฟล์นี้ผ่าน utils/money.ts (toSatang) เสมอ ไม่มีจุดไหนคูณ/หารเงิน
//    ด้วย float ตรงๆ เลย — การคูณด้วย 1,000 (หน่วย k) ก็ทำกับ "สตางค์ที่เป็นจำนวนเต็มแล้ว" เท่านั้น

import { toSatang } from './money';
import { MAX_AMOUNT_SATANG } from '../config/constants';

// ========================================================================
// ส่วนที่ 1: รูปแบบตัวเลขอารบิก — 50, 1,500, 1.2k, 50บ, 50฿, 50บาท
// ========================================================================

/**
 * regex ตัวเดียวจับได้ครบทุกรูปแบบตัวเลขอารบิกที่ SPEC ต้องการ:
 *   group 1 = ตัวเลข (มีจุดทศนิยมได้ ไม่มีคอมมาแล้วเพราะตัดออกก่อนแล้ว)
 *   group 2 = "k" หรือ "K" (แปลว่า x1,000) — ไม่บังคับ
 *   group 3 = หน่วยเงิน "บาท" | "บ" | "฿" — ไม่บังคับ
 */
const NUMERIC_PATTERN = /^([0-9]+(?:\.[0-9]+)?)\s*(k|K)?\s*(บาท|บ|฿)?$/;

function parseNumericForm(text: string): number | null {
  // คอมมาในเลขไทยใช้คั่นหลักพันเท่านั้น (เช่น "1,500") ตัดออกได้อย่างปลอดภัยก่อนเช็ค pattern
  const withoutComma = text.replace(/,/g, '');
  const match = NUMERIC_PATTERN.exec(withoutComma);
  if (!match) return null;

  const numberText = match[1];
  const hasThousandUnit = match[2] !== undefined; // มี k/K
  if (!numberText) return null; // กันไว้เฉยๆ (regex บังคับให้มีอยู่แล้ว)

  let satang: number;
  try {
    satang = toSatang(numberText);
  } catch {
    // ตัวเลขผิดรูปแบบในมุมของ money.ts (เช่น เกิน MAX_AMOUNT_SATANG) — ถือว่า "ไม่เข้าใจ" เช่นกัน
    return null;
  }

  // "1.2k" = 1.2 * 1000 = 1,200 บาท — คูณกับ "สตางค์ที่เป็นจำนวนเต็มแล้ว" ด้วยจำนวนเต็ม 1000
  // จึงไม่มีปัญหา float ใดๆ เข้ามาเกี่ยวข้องเลย (ต่างจากการเอา 1.2 * 1000 คูณตรงๆ แบบ float)
  //
  // 🔴 แก้บั๊ก: เดิม return ผลคูณออกไปเลยโดยไม่ตรวจเพดานซ้ำ ทำให้ "50000k" (50 ล้านบาท)
  // ทะลุ MAX_AMOUNT_SATANG ออกไปได้ เพราะ toSatang() ตรวจเพดานตอนที่ยังเป็น 50000 อยู่
  // ต้องตรวจ "หลังคูณ" ด้วย แล้วคืน null ตามหลักของไฟล์นี้ ("ไม่เข้าใจคืน null ห้ามเดา")
  if (!hasThousandUnit) return satang;

  const multiplied = satang * 1000;
  return multiplied > MAX_AMOUNT_SATANG ? null : multiplied;
}

// ========================================================================
// ส่วนที่ 2: เลขไทยเป็นคำ — ห้าสิบ, สองร้อยห้าสิบ, หนึ่งพันสอง
// ========================================================================

/** คำเลขหลักหน่วย 0-9 (รวม "เอ็ด" และ "ยี่" ที่เป็นคำพิเศษของหลักสิบ) */
const DIGIT_WORDS: Record<string, number> = {
  ศูนย์: 0,
  หนึ่ง: 1,
  เอ็ด: 1, // ใช้แทน "หนึ่ง" เฉพาะหลักหน่วยที่ตามหลัง "สิบ" เท่านั้น เช่น "สิบเอ็ด" = 11
  สอง: 2,
  ยี่: 2, // ใช้แทน "สอง" เฉพาะตอนอยู่หน้า "สิบ" เท่านั้น เช่น "ยี่สิบ" = 20 (ไม่ใช่ "สองสิบ")
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
};

/** คำหลัก (ตัวคูณ) ของระบบเลขไทย */
const UNIT_WORDS: Record<string, number> = {
  สิบ: 10,
  ร้อย: 100,
  พัน: 1_000,
  หมื่น: 10_000,
  แสน: 100_000,
  ล้าน: 1_000_000,
};

// เรียงคำจากยาวไปสั้น กันปัญหาจับคำย่อยผิด (ไม่มีคำไหนยาวกว่า/สั้นกว่าซ้อนกันในชุดนี้จริงๆ
// แต่เผื่ออนาคตเพิ่มคำใหม่ที่ยาวไม่เท่ากัน จึงเรียงไว้ให้ถูกหลักการตั้งแต่ต้น)
const ALL_WORDS = [...Object.keys(DIGIT_WORDS), ...Object.keys(UNIT_WORDS)].sort(
  (a, b) => b.length - a.length
);

type ThaiToken =
  | { type: 'digit'; value: number }
  | { type: 'unit'; value: number };

/**
 * ตัดข้อความเลขไทยล้วนๆ ออกเป็น token ทีละคำ ด้วยวิธี greedy longest-match
 * คืน null ทันทีถ้าเจอตัวอักษรที่ไม่ใช่คำเลขไทยที่รู้จัก (เช่น มีคำอื่นปนมา)
 */
function tokenizeThaiWords(text: string): ThaiToken[] | null {
  const tokens: ThaiToken[] = [];
  let position = 0;

  while (position < text.length) {
    const matchedWord = ALL_WORDS.find((word) => text.startsWith(word, position));
    if (!matchedWord) return null;

    if (matchedWord in DIGIT_WORDS) {
      tokens.push({ type: 'digit', value: DIGIT_WORDS[matchedWord]! });
    } else {
      tokens.push({ type: 'unit', value: UNIT_WORDS[matchedWord]! });
    }
    position += matchedWord.length;
  }

  return tokens.length > 0 ? tokens : null;
}

/**
 * ตีความ token ที่ตัดแล้วให้เป็นจำนวนบาท (ไม่มีทศนิยม เพราะเลขไทยเป็นคำไม่มีหน่วยสตางค์)
 *
 * กรณีพิเศษที่ต้องจัดการ (นอกเหนือจากไวยากรณ์เลขไทยมาตรฐาน):
 *   "หนึ่งพันสอง" = 1,200 ไม่ใช่ 1,002 — ภาษาพูดไทยเรื่องเงิน เลขท้ายประโยคที่ตามหลัง
 *   หน่วยตั้งแต่ "พัน" ขึ้นไปโดยไม่มีหน่วยอื่นคั่น มักหมายถึง "อันดับถัดลงมาหนึ่งขั้น" ไม่ใช่หลักหน่วย
 *   (พัน -> ร้อย, หมื่น -> พัน, แสน -> หมื่น) เช่น "หมื่นสอง" = 12,000 ไม่ใช่ 10,002
 *   ⚠️ นี่คือจุดที่ทีมควรรีวิวร่วมกัน เพราะเป็นการตีความภาษาพูดที่ขึ้นกับบริบท ไม่ใช่ไวยากรณ์ตายตัว
 */
function interpretThaiTokens(tokens: ThaiToken[]): number {
  let total = 0;
  let current = 0;
  let lastUnitValue: number | null = null;

  for (const token of tokens) {
    if (token.type === 'digit') {
      current = token.value;
      continue;
    }

    // token.type === 'unit'
    // หน่วยเดี่ยวๆ (ไม่มีเลขนำหน้า) หมายถึง "หนึ่ง" หน่วยนั้นเสมอ เช่น "สิบบาท" = 10, "พันห้า" = 1,500
    // (นัย "หนึ่งพันห้า" ไม่ใช่ 500) — ครอบคลุมทุกหน่วยตั้งแต่ สิบ ถึง ล้าน ไม่ใช่แค่ "สิบ" เท่านั้น
    // ⚠️ ข้อจำกัดที่รู้อยู่: ถ้ามี "ศูนย์" นำหน้าหน่วย (เช่น "ศูนย์สิบ" ซึ่งไม่ใช่ไวยากรณ์ไทยจริงอยู่แล้ว)
    //    จะถูกตีความว่าไม่มีเลขนำหน้าไปด้วย เพราะแยกไม่ออกจากกรณี "ไม่มีเลขนำหน้าเลย" — ไม่กระทบเคสใช้งานจริง
    if (current === 0) {
      current = 1;
    }
    total += current * token.value;
    lastUnitValue = token.value;
    current = 0;
  }

  // เลขค้างท้ายที่ไม่มีหน่วยตามหลัง (เช่น "เอ็ด" ท้าย "สิบเอ็ด" หรือ "สอง" ท้าย "พันสอง")
  if (current !== 0) {
    if (lastUnitValue !== null && lastUnitValue >= UNIT_WORDS['พัน']!) {
      // ใช้กฎ shorthand ภาษาพูด: อันดับถัดลงมาหนึ่งขั้นจากหน่วยล่าสุด
      total += current * (lastUnitValue / 10);
    } else {
      total += current;
    }
  }

  return total;
}

function parseThaiWordForm(text: string): number | null {
  const tokens = tokenizeThaiWords(text);
  if (!tokens) return null;
  return interpretThaiTokens(tokens);
}

// ========================================================================
// ฟังก์ชันหลักที่ export ออกไปใช้
// ========================================================================

/**
 * แปลงข้อความจำนวนเงิน (รูปแบบใดก็ได้ตาม SPEC §S4) ให้เป็นจำนวนสตางค์
 * คืนค่า null ถ้าไม่เข้าใจ — ผู้เรียกต้องส่งต่อไป L4 (Gemini) แทนการเดา
 *
 * รองรับ: "50", "1,500", "1.2k", "50บ", "50฿", "50บาท", "ห้าสิบ", "สองร้อยห้าสิบ", "หนึ่งพันสอง"
 */
export function parseThaiNumber(rawText: string): number | null {
  const text = rawText.trim();
  if (text === '') return null;

  const numericResult = parseNumericForm(text);
  if (numericResult !== null) return numericResult;

  const wordBaht = parseThaiWordForm(text);
  if (wordBaht !== null) {
    try {
      return toSatang(String(wordBaht));
    } catch {
      return null;
    }
  }

  return null;
}