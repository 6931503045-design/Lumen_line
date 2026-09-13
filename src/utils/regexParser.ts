/**
 * ไฟล์นี้ทำหน้าที่อะไร: ตัวแปลงข้อความทางด่วนแบบ regex (L1) สำหรับคำสั่งทั่วไป เช่น "กาแฟ 80"
 * ใครรับผิดชอบ: ③ AI
 * เขียนในสัปดาห์: W1
 * อ้างอิง: SPEC.md §3 S1 ตาราง "คำสั่งในแชท"
 * ⚖️ กฎเหล็ก G1, G2 — ไฟล์นี้ดึงได้แค่ตัวเลขที่ผู้ใช้พิมพ์ตรงๆ ห้ามคำนวณ/ประมาณเอง
 *
 * รองรับ 4 รูปแบบตาม SPEC:
 *   1. "กาแฟ 80"
 *   2. "ข้าว60"
 *   3. "+เงินเดือน 35000"
 *   4. "1,250 ซื้อของ"
 */

const NUMBER_PATTERN = '[\\d,]+(?:\\.\\d+)?';

export type ParseConfidence = 'high' | 'none';

export type ParseResult = {
  amount?: number;
  category?: string;
  type?: 'income' | 'expense';
  rawText: string;
  confidence: ParseConfidence;
};

export function parseQuickExpenseText(input: string): ParseResult {
  const rawText = input;
  let text = input.trim();

  if (!text) {
    return { rawText, confidence: 'none' };
  }

  let type: 'income' | 'expense' = 'expense';
  if (text.startsWith('+')) {
    type = 'income';
    text = text.slice(1).trim();
    if (!text) {
      return { rawText, confidence: 'none' };
    }
  }

  const amountFirstMatch = new RegExp(`^(${NUMBER_PATTERN})\\s+(.+)$`).exec(text);
  if (amountFirstMatch) {
    const amount = parseAmount(amountFirstMatch[1]);
    const category = amountFirstMatch[2].trim();
    if (amount !== null && category) {
      return { amount, category, type, rawText, confidence: 'high' };
    }
  }

  const amountLastMatch = new RegExp(`^(.+?)\\s*(${NUMBER_PATTERN})$`).exec(text);
  if (amountLastMatch) {
    const amount = parseAmount(amountLastMatch[2]);
    const category = amountLastMatch[1].trim();
    if (amount !== null && category) {
      return { amount, category, type, rawText, confidence: 'high' };
    }
  }

  return { rawText, confidence: 'none' };
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
