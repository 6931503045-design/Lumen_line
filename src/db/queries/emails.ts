// ไฟล์นี้ทำหน้าที่อะไร: query ตาราง user_emails — บันทึกอีเมลที่อ่านแล้วและผลการ parse
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 ขั้นตอนที่ 3-5
// ⚖️ กฎเหล็ก G5, G6
//
// ⚠️ คอลัมน์ชื่อ body_redacted ไม่ใช่ body เฉยๆ — ห้ามเขียนเนื้ออีเมลดิบลงไป
// ผู้เรียกต้องผ่าน utils/redact.ts มาก่อนเสมอ (G5)

import { supabase } from '../supabase';

export type StoredEmail = {
  id: string;
  parsed: boolean;
};

export type InsertUserEmailInput = {
  userId: string;
  messageId: string;
  /** ผ่าน redactSensitiveText() มาแล้วเท่านั้น */
  bodyRedacted: string;
  receivedAt: Date;
};

/**
 * บันทึกอีเมลฉบับใหม่ คืน null ถ้า message_id นี้เคยบันทึกไปแล้ว (ชน unique (user_id, message_id))
 * การชนไม่ใช่ error — เป็นกรณีปกติเมื่อ job รันซ้ำหรือธนาคารส่งซ้ำ (SPEC §S8 ขั้นตอนที่ 3)
 */
export async function insertUserEmail(
  input: InsertUserEmailInput
): Promise<StoredEmail | null> {
  const { data, error } = await supabase
    .from('user_emails')
    .insert({
      user_id: input.userId,
      message_id: input.messageId,
      body_redacted: input.bodyRedacted,
      received_at: input.receivedAt.toISOString(),
      parsed: false,
    })
    .select('id, parsed')
    .single();

  if (error) {
    if (error.code === '23505') return null; // เคยอ่านฉบับนี้ไปแล้ว
    throw error;
  }
  return data;
}

/** บันทึกผลหลัง parse — ผูกกับรายการที่สร้าง หรือรายการเดิมที่ตรวจพบว่าซ้ำ */
export async function markEmailParsed(
  emailId: string,
  matchedTransactionId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('user_emails')
    .update({ parsed: true, matched_transaction_id: matchedTransactionId })
    .eq('id', emailId);

  if (error) {
    throw error;
  }
}

/**
 * จำนวนอีเมลที่อ่านไม่ออกของผู้ใช้คนหนึ่ง
 * SPEC §S12 ให้ dailySummary แจ้งตัวเลขนี้ให้ผู้ใช้รู้ว่ามีอีเมลที่ระบบ parse ไม่ได้กี่ฉบับ
 * ⚖️ G6: กรอง user_id
 */
export async function countUnparsedEmails(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('parsed', false);

  if (error) {
    throw error;
  }
  return count ?? 0;
}
