// ไฟล์นี้ทำหน้าที่อะไร: query สำหรับ pending action เพื่อให้ AI รอ confirmation ก่อนบันทึก
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S12 (วงจร waiting → confirmed / cancelled / expired)
// ⚖️ กฎเหล็ก G2, G6
//
// 🔴 หัวใจของไฟล์นี้คือ claimPendingAction() — การ "จอง" แถวแบบ atomic
// ปัญหาที่มันแก้: ผู้ใช้กดปุ่ม ✅ สองครั้งรวดเร็ว (LINE ส่ง postback ซ้ำได้ หรือเน็ตช้า
// แล้วผู้ใช้กดย้ำ) ถ้าโค้ดทำแบบ "อ่านก่อนว่า waiting ไหม แล้วค่อยเขียน" จังหวะระหว่าง
// อ่านกับเขียนจะมีช่องให้คำขอที่สองอ่านเจอ waiting เหมือนกัน → บันทึกรายการซ้ำ 2 ครั้ง
//
// วิธีแก้: ใส่เงื่อนไข status='waiting' ลงใน UPDATE เลย แล้วดูว่าได้แถวกลับมาไหม
// ฐานข้อมูลรับประกันว่า UPDATE แถวเดียวกันพร้อมกันจะสำเร็จได้แค่คำขอเดียว
// ไม่ได้แถวกลับมา = มีคนจองไปแล้ว หรือหมดอายุแล้ว → ตอบว่าดำเนินการไปแล้ว

import { supabase } from '../supabase';

/** ชนิดคำขอที่รอยืนยันได้ — ตรงกับ CHECK constraint ของคอลัมน์ action */
export type PendingActionKind =
  | 'create_transaction'
  | 'create_transaction_batch'
  | 'update_transaction'
  | 'delete_transaction'
  | 'create_recurring';

export type PendingActionSource = 'chat' | 'image';

export type PendingActionRow = {
  id: string;
  user_id: string;
  action: PendingActionKind;
  payload: Record<string, unknown>;
  source: PendingActionSource;
  status: 'waiting' | 'confirmed' | 'cancelled' | 'expired';
  expires_at: string;
  created_at: string;
};

export type InsertPendingActionInput = {
  userId: string;
  action: PendingActionKind;
  /** args ที่ผ่าน Zod และ "แปลงเป็นข้อมูลจริงแล้ว" (สตางค์, วันที่จริง) ตาม §S12 */
  payload: Record<string, unknown>;
  source: PendingActionSource;
  expiresAt: string;
};

export async function insertPendingAction(
  input: InsertPendingActionInput
): Promise<PendingActionRow> {
  const { data, error } = await supabase
    .from('pending_actions')
    .insert({
      user_id: input.userId,
      action: input.action,
      payload: input.payload,
      source: input.source,
      expires_at: input.expiresAt,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as PendingActionRow;
}

/** อ่านคำขอโดยเช็คเจ้าของไปพร้อมกัน (G6) — ไม่ใช่ของ user คนนี้ = เหมือนไม่มี */
export async function getPendingActionOwnedByUser(
  pendingId: string,
  userId: string
): Promise<PendingActionRow | null> {
  const { data, error } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('id', pendingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as PendingActionRow | null) ?? null;
}

/**
 * จองคำขอแบบ atomic: waiting -> confirmed เฉพาะที่ยังไม่หมดอายุ (S12)
 *
 * คืน null เมื่อไม่ได้แถวมา ซึ่งหมายถึงกรณีใดกรณีหนึ่งต่อไปนี้ และผู้เรียก
 * ไม่จำเป็นต้องแยกแยะ เพราะคำตอบต่อผู้ใช้เหมือนกันคือ "ดำเนินการไปแล้ว":
 *   - ไม่มีคำขอนี้ / ไม่ใช่ของผู้ใช้คนนี้
 *   - ถูกกดยืนยันหรือยกเลิกไปแล้ว
 *   - เลยเวลา expires_at
 */
export async function claimPendingAction(
  pendingId: string,
  userId: string,
  nowIso: string
): Promise<PendingActionRow | null> {
  const { data, error } = await supabase
    .from('pending_actions')
    .update({ status: 'confirmed' })
    .eq('id', pendingId)
    .eq('user_id', userId)
    .eq('status', 'waiting')
    .gt('expires_at', nowIso)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as PendingActionRow | null) ?? null;
}

/**
 * คืนสถานะที่จองไว้กลับเป็น waiting เมื่อบันทึกจริงล้มเหลวหลังจอง (S12)
 *
 * ทำไมต้องคืน: ถ้าปล่อยเป็น confirmed ค้างไว้ ผู้ใช้จะกดยืนยันอีกครั้งไม่ได้เลย
 * ทั้งที่รายการยังไม่ได้ถูกบันทึก - เงินหายไปจากระบบโดยที่ผู้ใช้คิดว่าจดแล้ว
 */
export async function releasePendingAction(pendingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('pending_actions')
    .update({ status: 'waiting' })
    .eq('id', pendingId)
    .eq('user_id', userId)
    .eq('status', 'confirmed');

  if (error) {
    // ไม่ throw ต่อ เพราะผู้เรียกกำลังจัดการ error อื่นอยู่แล้ว
    // แต่ต้องขึ้น log ให้เห็น เพราะแถวนี้จะค้างสถานะ confirmed ที่กดซ้ำไม่ได้
    console.error('[queries/pending] releasePendingAction error:', error.message);
  }
}

/** ยกเลิกคำขอ: waiting -> cancelled แบบ atomic (กดซ้ำแล้วไม่เกิดผลซ้ำ ตาม G2) */
export async function cancelPendingAction(
  pendingId: string,
  userId: string
): Promise<PendingActionRow | null> {
  const { data, error } = await supabase
    .from('pending_actions')
    .update({ status: 'cancelled' })
    .eq('id', pendingId)
    .eq('user_id', userId)
    .eq('status', 'waiting')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as PendingActionRow | null) ?? null;
}
