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

// ────────────────────────────────────────────────────────────────────────────
// คำภาษาอังกฤษ → ชื่อหมวดเริ่มต้น (ภาษาไทย)
// ────────────────────────────────────────────────────────────────────────────
//
// ทำไมต้องมี: ทางด่วน (L1) จับคู่หมวดด้วยการเทียบ "ชื่อหมวดที่ผู้ใช้มีอยู่" ซึ่งเป็นภาษาไทย
// พิมพ์ "coffee 80" จึงตกไปที่ "อื่นๆ" ทุกครั้ง ทั้งที่ควรเป็น "อาหาร"
// ตารางนี้แค่ "แปลคำใบ้" เป็นชื่อหมวดไทย แล้วยังส่งต่อให้ resolveCategoryName
// ตรวจกับหมวดที่ผู้ใช้มีจริงเหมือนเดิม — ผู้ใช้ลบหมวดนั้นไปแล้วก็ไม่สร้างใหม่ให้
//
// ⚠️ ไม่แตะตัวเลขเงินเลย (⚖️ G1, G3) และไม่เรียก AI (⚖️ G4)
// ⚠️ คีย์เป็นตัวพิมพ์เล็กทั้งหมด — ผู้เรียกต้อง toLowerCase() ก่อน (englishCategoryHint ทำให้แล้ว)

export const ENGLISH_CATEGORY_HINTS: Record<string, string> = {
  // อาหาร
  food: 'อาหาร',
  coffee: 'อาหาร',
  tea: 'อาหาร',
  rice: 'อาหาร',
  lunch: 'อาหาร',
  dinner: 'อาหาร',
  breakfast: 'อาหาร',
  snack: 'อาหาร',
  snacks: 'อาหาร',
  drink: 'อาหาร',
  drinks: 'อาหาร',
  meal: 'อาหาร',
  noodle: 'อาหาร',
  noodles: 'อาหาร',
  grocery: 'อาหาร',
  groceries: 'อาหาร',
  // เดินทาง
  taxi: 'เดินทาง',
  grab: 'เดินทาง',
  bus: 'เดินทาง',
  bts: 'เดินทาง',
  mrt: 'เดินทาง',
  train: 'เดินทาง',
  gas: 'เดินทาง',
  fuel: 'เดินทาง',
  petrol: 'เดินทาง',
  transport: 'เดินทาง',
  parking: 'เดินทาง',
  // ช้อปปิ้ง
  shopping: 'ช้อปปิ้ง',
  clothes: 'ช้อปปิ้ง',
  shirt: 'ช้อปปิ้ง',
  shoes: 'ช้อปปิ้ง',
  // ที่พัก/บิล
  rent: 'ที่พัก/บิล',
  dorm: 'ที่พัก/บิล',
  electricity: 'ที่พัก/บิล',
  electric: 'ที่พัก/บิล',
  internet: 'ที่พัก/บิล',
  wifi: 'ที่พัก/บิล',
  bill: 'ที่พัก/บิล',
  bills: 'ที่พัก/บิล',
  // บันเทิง
  movie: 'บันเทิง',
  movies: 'บันเทิง',
  game: 'บันเทิง',
  games: 'บันเทิง',
  netflix: 'บันเทิง',
  spotify: 'บันเทิง',
  concert: 'บันเทิง',
  // สุขภาพ
  medicine: 'สุขภาพ',
  doctor: 'สุขภาพ',
  hospital: 'สุขภาพ',
  clinic: 'สุขภาพ',
  pharmacy: 'สุขภาพ',
  gym: 'สุขภาพ',
  // การศึกษา
  book: 'การศึกษา',
  books: 'การศึกษา',
  course: 'การศึกษา',
  tuition: 'การศึกษา',
  school: 'การศึกษา',
  stationery: 'การศึกษา',
  // รายรับ
  salary: 'เงินเดือน',
  bonus: 'รายได้เสริม',
  freelance: 'รายได้เสริม',
  refund: 'เงินคืน/รับโอน',
  cashback: 'เงินคืน/รับโอน',
};

/**
 * คำใบ้ชื่อหมวดไทยจากข้อความภาษาอังกฤษ — null ถ้าไม่มีคำไหนตรงตาราง
 *
 * ลองทั้งข้อความก่อน แล้วค่อยไล่ทีละคำ: "iced coffee" → "coffee" → อาหาร
 * ข้อความไทยล้วนจะไม่มีคำไหนตรง จึงคืน null และพฤติกรรมเดิมไม่เปลี่ยน
 */
export function englishCategoryHint(text: string): string | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;
  const whole = ENGLISH_CATEGORY_HINTS[lower];
  if (whole) return whole;
  for (const word of lower.split(/[^a-z]+/)) {
    const hit = word ? ENGLISH_CATEGORY_HINTS[word] : undefined;
    if (hit) return hit;
  }
  return null;
}
