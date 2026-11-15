// ไฟล์นี้ทำหน้าที่อะไร: พจนานุกรมส่วนตัว (L3) — จำว่าผู้ใช้แต่ละคนเอาคำไหนไปไว้หมวดไหน
// ใครรับผิดชอบ: ③ AI
// อ้างอิง: SPEC.md §S4 L3, §S1 postback set_category ("เปลี่ยนหมวด + keyword.service.learn()")
// ⚖️ กฎเหล็ก G4, G5, G6
//
// ทำไมต้องมี: ผู้ใช้พิมพ์ "ร้านป้าแดง 50" → ตารางคำกลางไม่รู้จัก → ลง "อื่นๆ"
// ผู้ใช้เปลี่ยนเป็น "อาหาร" แล้ว ครั้งหน้าพิมพ์ "ร้านป้าแดง 40" ก็ยังลง "อื่นๆ" อีก
// ตอนนี้การเปลี่ยนหมวดทุกครั้ง (ปุ่มในแชท / แก้ในเว็บ) ถูกจำไว้ ครั้งหน้าได้หมวดที่ถูกเลย
//
// ⚖️ G4: ไม่มี AI เกี่ยวเลย — เป็นแค่การจำสิ่งที่ "คน" เลือกเอง ปิด AI แล้วยังเรียนรู้ได้ครบ
// ⚖️ G5: จำแค่ชื่อรายการสั้น ๆ ไม่จำข้อความทั้งประโยค ไม่จำตัวเลข

import { findLearnedKeyword, upsertLearnedKeyword } from '../db/queries/keywords';
import { logger } from '../utils/logger';

/** คำยาวกว่านี้ไม่ใช่ "ชื่อของ" แล้ว (มักเป็นโน้ตยาวจากหน้าเว็บ) จำไปก็ไม่มีวันพิมพ์ซ้ำตรง ๆ */
const MAX_KEYWORD_LENGTH = 40;

/**
 * ทำคำให้อยู่รูปเดียวกันก่อนจำและก่อนค้น — "  Coffee  " กับ "coffee" ต้องเป็นคำเดียวกัน
 * คืน null ถ้าไม่ควรจำ: ว่าง ยาวเกิน หรือมีตัวเลขปน (⚖️ G5: ไม่จำเลขบัญชี/เบอร์/ยอดเงิน)
 */
export function normalizeKeyword(text: string | null | undefined): string | null {
  if (!text) return null;
  const keyword = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”‘’.,!?]+|[\s"'“”‘’.,!?]+$/gu, '')
    .trim();

  if (!keyword || [...keyword].length > MAX_KEYWORD_LENGTH) return null;
  // มีตัวเลข = ไม่ใช่ชื่อของล้วน ๆ (เช่น "โอนให้ 0812345678") — ไม่จำ
  if (/[0-9๐-๙]/u.test(keyword)) return null;
  return keyword;
}

/**
 * จำว่าคำนี้อยู่หมวดนี้ — เรียกตอนผู้ใช้เปลี่ยนหมวดเอง
 *
 * 🔴 ห้าม throw: การจำเป็นของแถม รายการถูกย้ายหมวดสำเร็จไปแล้ว
 * ถ้าจำไม่ได้ (DB สะดุด) ผู้ใช้ต้องไม่เห็นว่า "เปลี่ยนหมวดไม่สำเร็จ"
 */
export async function learnCategory(
  userId: string,
  text: string | null | undefined,
  categoryId: string
): Promise<boolean> {
  const keyword = normalizeKeyword(text);
  if (!keyword) return false;
  try {
    await upsertLearnedKeyword(userId, keyword, categoryId);
    return true;
  } catch (err) {
    logger.error('[keyword] จำหมวดไม่สำเร็จ (รายการถูกย้ายหมวดแล้ว):', err);
    return false;
  }
}

/**
 * หมวดที่ผู้ใช้เคยสอนไว้สำหรับคำนี้ ชนิดต้องตรงกัน (คำเดียวกันฝั่งรายรับ ≠ ฝั่งรายจ่าย)
 * อ่านไม่ได้ = ถือว่าไม่เคยสอน แล้วให้ผู้เรียกไปใช้ตารางคำกลางต่อ (ไม่ทำให้การบันทึกพัง)
 */
export async function lookupLearnedCategory(
  userId: string,
  text: string | null | undefined,
  type: 'income' | 'expense'
): Promise<string | null> {
  const keyword = normalizeKeyword(text);
  if (!keyword) return null;
  try {
    const learned = await findLearnedKeyword(userId, keyword);
    return learned && learned.categoryType === type ? learned.categoryName : null;
  } catch (err) {
    logger.error('[keyword] อ่านพจนานุกรมส่วนตัวไม่สำเร็จ ใช้ตารางคำกลางแทน:', err);
    return null;
  }
}
