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

/** soft delete — ตั้ง deleted_at = now() เท่านั้น ห้ามลบแถวจริง */
export async function softDeleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', transactionId);

  if (error) {
    throw error;
  }
}

/** restore — ล้าง deleted_at กลับเป็น null (postback action=restore หลังกด undo ผิด) */
export async function restoreTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: null })
    .eq('id', transactionId);

  if (error) {
    throw error;
  }
}