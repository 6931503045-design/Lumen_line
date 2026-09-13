// ไฟล์นี้ทำหน้าที่อะไร: พจนานุกรมกลาง (L2) สำหรับแปลงข้อความเป็นหมวดค่าใช้จ่ายหรือรายรับ
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W1
// TODO: เพิ่มคำศัพท์ภาษาไทยและรูปแบบข้อความให้ครบตามการใช้งานจริง
// ⚖️ กฎเหล็ก G1, G3, G5

export type KeywordEntry = {
  category: string;
  type: 'income' | 'expense';
  confidence: number;
};

export const GLOBAL_KEYWORDS: Record<string, KeywordEntry> = {
  'กาแฟ': { category: 'อาหาร', type: 'expense', confidence: 0.9 },
  'ข้าว': { category: 'อาหาร', type: 'expense', confidence: 0.9 },
  'อาหาร': { category: 'อาหาร', type: 'expense', confidence: 0.85 },
  'เงินเดือน': { category: 'เงินเดือน', type: 'income', confidence: 0.95 },
  'ค่าน้ำ': { category: 'ค่าใช้จ่ายประจำ', type: 'expense', confidence: 0.8 },
  'ค่าไฟ': { category: 'ค่าใช้จ่ายประจำ', type: 'expense', confidence: 0.8 },
  'ค่าเดินทาง': { category: 'เดินทาง', type: 'expense', confidence: 0.8 },
  'โอน': { category: 'โอน', type: 'income', confidence: 0.7 },
};
