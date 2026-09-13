// ไฟล์นี้ทำหน้าที่อะไร: รวมค่าคงที่ที่ใช้ทั่วทั้งโปรเจกต์ ไว้ที่เดียวกันกันแก้ไขกระจัดกระจาย
// ใครรับผิดชอบ: ② Database (เจ้าของ src/utils/money.ts และ services ที่ใช้ค่าพวกนี้)
// เขียนในสัปดาห์: W1
// อ้างอิง: SPEC.md §7 ตาราง "ค่าคงที่ (src/config/constants.ts)"
// ⚠️ ถ้าจะแก้ค่าพวกนี้ (โดยเฉพาะ PLAN_SAFETY_RATIO, EMERGENCY_BUFFER) ต้องแก้ SPEC.md คู่กันเสมอ (S5.3, S5.4)

/** เขตเวลาที่ใช้คำนวณ "วันนี้"/"เดือนนี้" ทั้งหมดในระบบ (ห้ามใช้ UTC ตรงๆ) */
export const TIMEZONE = 'Asia/Bangkok';

/** โควตาส่งข้อความ push ของ LINE ต่อเดือน (free tier) */
export const PUSH_LIMIT = 280;

/** จำนวนแผนออมที่เปิด active พร้อมกันได้สูงสุดต่อผู้ใช้ 1 คน (S5.3 กฎ 2) */
export const MAX_ACTIVE_PLANS = 3;

/** สัดส่วนเผื่อความคลาดเคลื่อนตอนคำนวณ capacity ของแผนออม (S5.3) */
export const PLAN_SAFETY_RATIO = 0.8;

/** สัดส่วนกันเงินฉุกเฉินจาก avgExpense ตอนคำนวณ disposable (S5.3) */
export const EMERGENCY_BUFFER = 0.15;

/** เพดานจำนวนเงินสูงสุดต่อ 1 รายการ หน่วยสตางค์ = 10,000,000 บาท (ตรงกับ CHECK ในตาราง transactions) */
export const MAX_AMOUNT_SATANG = 1_000_000_000;

/** pending_actions หมดอายุใน 24 ชั่วโมงถ้าไม่มีการกดยืนยัน (G2) */
export const PENDING_EXPIRE_HOURS = 24;

/** หน้าต่างเวลาที่ถือว่าเป็นรายการซ้ำ สำหรับ S10 Dedup */
export const DEDUP_WINDOW_MINUTES = 30;

/** ส่งประวัติแชทไปให้ Gemini ได้ไม่เกินกี่ turn ล่าสุด (กฎ G5) */
export const CHAT_HISTORY_TURNS = 3;

/** เกณฑ์ cold-start สำหรับผู้ใช้ใหม่ (S5.5) หน่วยเป็นจำนวนวันข้อมูลย้อนหลัง */
export const COLD_START = {
  LOW_UNDER_DAYS: 7,
  MEDIUM_UNDER_DAYS: 90,
} as const;

/** ข้อความ disclaimer บังคับที่ต้องแนบทุกครั้งที่แสดงเนื้อหาเชิงวางแผน/วิเคราะห์ */
export const AI_DISCLAIMER = 'ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน';

export type DefaultCategorySeed = {
  name: string;
  type: 'income' | 'expense';
  emoji: string;
  isEssential: boolean;
};

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'อาหาร', type: 'expense', emoji: '🍜', isEssential: true },
  { name: 'เดินทาง', type: 'expense', emoji: '🚗', isEssential: true },
  { name: 'ช้อปปิ้ง', type: 'expense', emoji: '🛍️', isEssential: false },
  { name: 'ที่พัก/บิล', type: 'expense', emoji: '🏠', isEssential: true },
  { name: 'บันเทิง', type: 'expense', emoji: '🎮', isEssential: false },
  { name: 'สุขภาพ', type: 'expense', emoji: '💊', isEssential: true },
  { name: 'การศึกษา', type: 'expense', emoji: '📚', isEssential: true },
  { name: 'อื่นๆ', type: 'expense', emoji: '📦', isEssential: false },
  { name: 'เงินเดือน', type: 'income', emoji: '💰', isEssential: false },
  { name: 'รายได้เสริม', type: 'income', emoji: '💵', isEssential: false },
  { name: 'เงินคืน/รับโอน', type: 'income', emoji: '↩️', isEssential: false },
];