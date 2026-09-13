// ไฟล์นี้ทำหน้าที่อะไร: ตัวแปลงข้อความทางด่วนแบบ regex สำหรับคำสั่งทั่วไป เช่น "กาแฟ 80"
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W1
// TODO: เพิ่มชุด regex สำหรับประเภทรายรับ/รายจ่ายและประโยคที่ซับซ้อนมากขึ้น
// ⚖️ กฎเหล็ก G1, G2

export type ParseResult = {
  amount?: number;
  category?: string;
  type?: 'income' | 'expense';
  rawText?: string;
};

export function parseQuickExpenseText(input: string): ParseResult {
  const match = input.match(/([\w\s]+)\s+(\d+(?:\.\d+)?)/i);
  if (!match) return {};
  return {
    category: match[1].trim(),
    amount: Number(match[2]),
    type: 'expense',
    rawText: input,
  };
}
