// ไฟล์นี้ทำหน้าที่อะไร: ตัวแปลงข้อความทางด่วนแบบ regex (L1) สำหรับคำสั่งทั่วไป เช่น "กาแฟ 80"
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W1
// อ้างอิง: SPEC.md §3 S1 ตาราง "คำสั่งในแชท", README.md แผนภาพ Router 4 ชั้น (L1)
// ⚖️ กฎเหล็ก G1, G2 — ไฟล์นี้ดึงได้แค่ตัวเลขที่ผู้ใช้พิมพ์ตรงๆ ห้ามคำนวณ/ประมาณเอง
//
// รองรับ 4 รูปแบบตาม SPEC (เดิมรองรับแค่แบบแรก):
//   1. "กาแฟ 80"        — ชื่อ + เว้นวรรค + ตัวเลข
//   2. "ข้าว60"          — ชื่อติดตัวเลขไม่มีเว้นวรรค
//   3. "+เงินเดือน 35000" — ขึ้นต้นด้วย + = รายรับ (ไม่มี + = รายจ่ายเสมอ)
//   4. "1,250 ซื้อของ"    — ตัวเลขขึ้นก่อน (รองรับ comma คั่นหลักพัน)
//
// หมายเหตุ: ไฟล์นี้จับได้แค่ "ชื่อหมวดดิบ" (raw text) ที่ผู้ใช้พิมพ์ ยังไม่ map เป็นหมวดจริงในระบบ
// (การ map เป็นหมวดจริงเป็นหน้าที่ของ L2 config/keywords.ts + L3 keyword.service — ยังไม่ทำใน W1)

/** ตัวเลขที่ยอมรับ: มี comma คั่นหลักพันได้ + มีจุดทศนิยมได้ */
const NUMBER_PATTERN = '[\\d,]+(?:\\.\\d+)?';

export type ParseConfidence = 'high' | 'none';

export type ParseResult = {
  amount?: number;
  category?: string;
  type?: 'income' | 'expense';
  rawText: string;
  confidence: ParseConfidence;
};

/**
 * จับข้อความทางด่วน (L1) ให้ได้ตัวเลข + ชื่อหมวดดิบ + ประเภท
 * คืน confidence: 'none' ถ้าจับไม่ได้เลย — ตัว router (ที่จะเขียนใน W2) จะรู้ว่าต้องส่งต่อ L2/L3/L4 ต่อ
 */
export function parseQuickExpenseText(input: string): ParseResult {
  const rawText = input;
  let text = input.trim();

  if (!text) {
    return { rawText, confidence: 'none' };
  }

  // "+" นำหน้า = รายรับ ตาม SPEC (ไม่มี + = รายจ่ายเสมอ สำหรับทางด่วน L1)
  let type: 'income' | 'expense' = 'expense';
  if (text.startsWith('+')) {
    type = 'income';
    text = text.slice(1).trim();
    if (!text) {
      return { rawText, confidence: 'none' };
    }
  }

  // แบบที่ 4: ตัวเลขขึ้นก่อน เช่น "1,250 ซื้อของ" — ต้องมีเว้นวรรคคั่นตัวเลขกับชื่อหมวดเสมอ
  const amountFirstMatch = new RegExp(`^(${NUMBER_PATTERN})\\s+(.+)$`).exec(text);
  if (amountFirstMatch) {
    // groups ทั้งสองเป็น mandatory capture (ไม่มี ? ต่อท้าย) จึงรับประกันว่ามีค่าเสมอเมื่อ match สำเร็จ
    // ใช้ ! เพราะ tsconfig เปิด noUncheckedIndexedAccess ทำให้ TS มองว่าเป็น string | undefined เฉยๆ
    const amount = parseAmount(amountFirstMatch[1]!);
    const category = amountFirstMatch[2]!.trim();
    if (amount !== null && isValidCategoryName(category)) {
      return { amount, category, type, rawText, confidence: 'high' };
    }
  }

  // แบบที่ 1 และ 2: ชื่อขึ้นก่อน ตัวเลขปิดท้าย มีเว้นวรรคหรือไม่ก็ได้ เช่น "กาแฟ 80", "ข้าว60"
  const amountLastMatch = new RegExp(`^(.+?)\\s*(${NUMBER_PATTERN})$`).exec(text);
  if (amountLastMatch) {
    const amount = parseAmount(amountLastMatch[2]!);
    const category = amountLastMatch[1]!.trim();
    if (amount !== null && isValidCategoryName(category)) {
      return { amount, category, type, rawText, confidence: 'high' };
    }
  }

  return { rawText, confidence: 'none' };
}

/**
 * แปลง string ตัวเลขดิบ (อาจมี comma คั่นหลักพัน) เป็น number
 * คืน null ถ้าไม่ใช่ตัวเลขที่ใช้ได้ หรือ <= 0 (เงินติดลบ/ศูนย์ไม่ผ่านตาม G3)
 * หมายเหตุ: ค่าที่คืนยังเป็นหน่วย "บาท" ดิบๆ — การแปลงเป็นสตางค์ทำที่ utils/money.ts เท่านั้น (G3)
 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * ชื่อหมวดต้องไม่ว่างเปล่า และห้ามเป็นตัวเลข/comma/จุด/ช่องว่างล้วนๆ
 * (กันเคส "12345" ที่ไม่มีคำอธิบายเลย ไม่ให้ regex ไปตัดเป็น หมวด "1" + จำนวนเงิน "2345" โดยไม่ตั้งใจ)
 */
function isValidCategoryName(category: string): boolean {
  return category.length > 0 && !/^[\d,.\s]+$/.test(category);
}