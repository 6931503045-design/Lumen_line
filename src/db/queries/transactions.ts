// ไฟล์นี้ทำหน้าที่อะไร: query สำหรับ transactions — insert (W1) + soft delete/restore สำหรับปุ่ม ↩️ ยกเลิก (S14)
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W1
// ⚖️ กฎเหล็ก G6, G7 — ทุก query กรอง user_id / ฟังก์ชันสรุปในอนาคตต้อง exclude type='transfer'
//
// รับ-คืนค่าเป็น "สตางค์" (จำนวนเต็ม) เสมอตาม G3 — แปลงเป็น numeric(12,2) ด้วย utils/money.ts::fromSatang
// ก่อน insert ทุกครั้ง ไม่แปลงเองตรงนี้
//
// 🆕 เพิ่ม getTransactionOwnedByUser / softDeleteTransaction / restoreTransaction สำหรับ postbackHandler.ts
// (ปุ่ม ↩️ ยกเลิก ใน confirmCard ตาม SPEC §S14 postback action=undo/restore)

import { supabase } from '../supabase';
import { fromSatang } from '../../utils/money';

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionSource = 'chat' | 'image' | 'email' | 'recurring' | 'liff';
export type TransactionParsedBy = 'regex' | 'dictionary' | 'learned' | 'ai' | 'manual';

export type InsertTransactionInput = {
  userId: string;
  categoryId: string | null;
  type: TransactionType;
  amountSatang: number;
  note?: string;
  occurredAt: string; // ISO string (timestamptz)
  source: TransactionSource;
  parsedBy: TransactionParsedBy;
  /** เลขอ้างอิงจากธนาคาร/สลิป ใช้กันรายการซ้ำตาม S10 — มีเฉพาะรายการที่มาจากอีเมลหรือสลิป */
  refNumber?: string | null;
};

export type InsertedTransaction = {
  id: string;
  amount: string; // numeric(12,2) จาก Supabase มักเป็น string
  type: TransactionType;
  occurred_at: string;
};

export async function insertTransaction(
  input: InsertTransactionInput
): Promise<InsertedTransaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: input.userId,
      category_id: input.categoryId,
      type: input.type,
      amount: fromSatang(input.amountSatang), // ⚖️ G3: แปลงเป็น numeric string ที่นี่ที่เดียว
      note: input.note ?? null,
      occurred_at: input.occurredAt,
      source: input.source,
      parsed_by: input.parsedBy,
      ref_number: input.refNumber ?? null,
    })
    .select('id, amount, type, occurred_at')
    .single();

  if (error || !data) {
    throw error ?? new Error('insertTransaction: insert ไม่สำเร็จโดยไม่มี error object');
  }

  return data as InsertedTransaction;
}

export type OwnedTransaction = {
  id: string;
  user_id: string;
  deleted_at: string | null;
};

/**
 * ดึงรายการเพื่อเช็คว่าเป็นของ userId นี้จริงก่อนจะ undo/restore (⚖️ G6 บังคับทุก postback action)
 * คืน null ถ้าไม่เจอ หรือไม่ใช่ของ user คนนี้ — ผู้เรียกต้องเช็ค null แล้วปฏิเสธ postback นั้น
 */
export async function getTransactionOwnedByUser(
  transactionId: string,
  userId: string
): Promise<OwnedTransaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, user_id, deleted_at')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[db/queries/transactions] getTransactionOwnedByUser error:', error);
    return null;
  }
  return data;
}

/**
 * soft delete — ตั้ง deleted_at = now() เท่านั้น ห้ามลบแถวจริง
 *
 * ⚖️ G6: ต้องส่ง userId มาด้วยเสมอ แล้วกรองใน UPDATE ด้วย ไม่ใช่พึ่งแค่การเช็ค
 * getTransactionOwnedByUser() ของผู้เรียก — query ต้องป้องกันตัวเองได้ เผื่อมีคนเรียกจากจุดอื่น
 * ในอนาคตแล้วลืมเช็คก่อน จะได้ไม่กลายเป็นช่องแก้ข้อมูลข้ามผู้ใช้
 */
export async function softDeleteTransaction(
  transactionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', transactionId)
    .eq('user_id', userId)
    .is('deleted_at', null) // ลบซ้ำไม่ต้องขยับ deleted_at ให้เพี้ยนไปจากเวลาที่ลบจริง
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

/**
 * restore — ล้าง deleted_at กลับเป็น null (postback action=restore หลังกด undo ผิด)
 * ⚖️ G6: กรอง user_id ด้วยเหตุผลเดียวกับ softDeleteTransaction
 */
export async function restoreTransaction(
  transactionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

export type TransactionListRow = {
  id: string;
  type: TransactionType;
  /** numeric(12,2) มาเป็น string ต้องผ่าน money.toSatang ก่อนใช้ */
  amount: string;
  note: string | null;
  occurred_at: string;
  parsed_by: TransactionParsedBy | null;
  source: TransactionSource;
  categories: { name: string; emoji: string | null } | null;
};

/**
 * รายการล่าสุดของผู้ใช้ พร้อมชื่อหมวด (join ผ่าน foreign key ที่ Supabase รู้จักอยู่แล้ว)
 * ตัดรายการที่ถูก soft delete ออก และเรียงใหม่สุดขึ้นก่อน
 * ⚖️ G6: กรอง user_id เสมอ
 */
export async function listTransactionsByUser(
  userId: string,
  limit = 100
): Promise<TransactionListRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, amount, note, occurred_at, parsed_by, source, categories(name, emoji)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as TransactionListRow[];
}

// ────────────────────────────────────────────────────────────────────────────
// query สำหรับ S10 Dedup — ใช้โดย services/dedup.service.ts
// ────────────────────────────────────────────────────────────────────────────

export type DedupCandidate = {
  id: string;
  amount: string;
  type: TransactionType;
  occurred_at: string;
  ref_number: string | null;
};

/**
 * หารายการที่มี ref_number ตรงกันของผู้ใช้คนนี้ (S10 เงื่อนไขที่ 1 = ซ้ำแน่นอน)
 * นับเฉพาะรายการที่ยังไม่ถูกลบ ให้ตรงกับ partial unique index uq_tx_ref
 */
export async function findTransactionByRefNumber(
  userId: string,
  refNumber: string
): Promise<DedupCandidate | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, type, occurred_at, ref_number')
    .eq('user_id', userId)
    .eq('ref_number', refNumber)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * หารายการยอดเท่ากันเป๊ะ ประเภทเดียวกัน ในช่วงเวลา +/- window (S10 เงื่อนไขที่ 2 = น่าจะซ้ำ)
 * เทียบ amount เป็น string ของ numeric(12,2) ตรงๆ ได้ เพราะ fromSatang() คุมรูปแบบให้เป็น
 * ทศนิยม 2 ตำแหน่งเสมอ ("80.00") จึงไม่มีปัญหา "80" กับ "80.00" ไม่ตรงกัน
 */
export async function findSimilarTransaction(
  userId: string,
  type: TransactionType,
  amountNumeric: string,
  fromIso: string,
  toIso: string
): Promise<DedupCandidate | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, type, occurred_at, ref_number')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('amount', amountNumeric)
    .is('deleted_at', null)
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * เติม ref_number ให้รายการที่มีอยู่แล้ว (S10: กรณี "น่าจะซ้ำ" ที่มาจากอีเมล)
 * เขียนทับเฉพาะแถวที่ยังไม่มี ref_number เพื่อไม่ให้ไปทับเลขอ้างอิงเดิมที่ถูกต้องอยู่แล้ว
 * ⚖️ G6: กรอง user_id ด้วยเสมอ
 */
export async function backfillRefNumber(
  transactionId: string,
  userId: string,
  refNumber: string
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ ref_number: refNumber, updated_at: new Date().toISOString() })
    .eq('id', transactionId)
    .eq('user_id', userId)
    .is('ref_number', null);

  if (error) {
    throw error;
  }
}

export type UpdateTransactionPatch = {
  categoryId?: string | null;
  type?: TransactionType;
  amountSatang?: number;
  note?: string | null;
  occurredAt?: string;
};

/**
 * แก้รายการที่มีอยู่ — ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยน
 * คืน null ถ้าไม่เจอ ไม่ใช่ของผู้ใช้คนนี้ หรือถูกลบไปแล้ว
 *
 * ⚖️ G6: กรอง user_id ใน UPDATE เอง ไม่พึ่งการเช็คของผู้เรียก
 * ⚖️ G3: รับเป็นสตางค์ แปลงเป็น numeric ตอนเขียนที่นี่ที่เดียวเหมือน insert
 *
 * ตัด deleted_at ที่ถูกลบแล้วออกด้วย: รายการที่ผู้ใช้กดลบไปแล้วไม่ควรถูกแก้ยอดเงินเงียบๆ
 * ถ้าอยากแก้ต้องกู้คืนก่อน
 */
export async function updateTransaction(
  transactionId: string,
  userId: string,
  patch: UpdateTransactionPatch
): Promise<InsertedTransaction | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.amountSatang !== undefined) row.amount = fromSatang(patch.amountSatang);
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.occurredAt !== undefined) row.occurred_at = patch.occurredAt;

  const { data, error } = await supabase
    .from('transactions')
    .update(row)
    .eq('id', transactionId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id, amount, type, occurred_at')
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data ?? null) as InsertedTransaction | null;
}

/** อ่านรายการเต็มของผู้ใช้ ใช้ตอนต้องรู้ค่าเดิมก่อนแก้ (เช่น หมวดเดิมเพื่อเช็คงบ) */
export async function getTransactionDetail(
  transactionId: string,
  userId: string
): Promise<{ id: string; type: TransactionType; category_id: string | null; occurred_at: string } | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, category_id, occurred_at')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data ?? null) as { id: string; type: TransactionType; category_id: string | null; occurred_at: string } | null;
}
