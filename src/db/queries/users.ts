// ไฟล์นี้ทำหน้าที่อะไร: query เกี่ยวกับตาราง users
// ใครรับผิดชอบ: ② Database
// ⚖️ กฎเหล็ก G6

import { randomBytes } from 'node:crypto';
import { supabase } from '../supabase';

export async function getUserIdByLineUserId(lineUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('line_user_id', lineUserId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[db/queries/users] getUserIdByLineUserId error:', error);
    return null;
  }

  return data?.id ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// email_ingest_token — ที่อยู่ +token ที่ผู้ใช้ forward อีเมลธนาคารเข้ามา (SPEC §S8)
// ────────────────────────────────────────────────────────────────────────────
//
// ⚠️ SPEC สั่งไว้ตรงๆ: "MUST สุ่มด้วย crypto.randomBytes(16) ขึ้นไป ห้ามสร้างจาก user_id"
// เหตุผลคือใครก็ตามที่เดา token ได้ จะส่งรายการปลอมเข้าบัญชีคนอื่นได้ทันที
// ถ้าสร้างจาก user_id (เช่น hash) คนที่รู้ user_id ของเพื่อนก็คำนวณย้อนได้

/** จำนวน bytes ที่สุ่ม — 16 bytes = 32 ตัวอักษร hex ตามขั้นต่ำที่ SPEC กำหนด */
const TOKEN_BYTES = 16;

/** โอกาสชน token เดิมแทบเป็นศูนย์ แต่ DB มี unique constraint อยู่ จึงเผื่อ retry ไว้ */
const MAX_TOKEN_ATTEMPTS = 3;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

export type EmailTokenOwner = {
  id: string;
  is_active: boolean;
};

/**
 * หาเจ้าของ token จากที่อยู่ +token ที่อีเมลถูก forward มา
 * คืน null ถ้าไม่เจอ — ผู้เรียกต้องข้ามอีเมลฉบับนั้นไป ห้ามเดาว่าเป็นของใคร
 */
export async function getUserByEmailToken(token: string): Promise<EmailTokenOwner | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, is_active')
    .eq('email_ingest_token', token)
    .maybeSingle();

  if (error) {
    console.error('[db/queries/users] getUserByEmailToken error:', error);
    return null;
  }
  return data;
}

/** อ่าน token ปัจจุบันของผู้ใช้ (อาจยังไม่มี) */
export async function getEmailIngestToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('email_ingest_token')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.email_ingest_token ?? null;
}

/** สุ่ม token ใหม่ให้ผู้ใช้ (ที่อยู่เดิมจะใช้ไม่ได้ทันที) — ใช้ตอนกดปุ่มในหน้า settings */
export async function rotateEmailIngestToken(userId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const token = generateToken();
    const { error } = await supabase
      .from('users')
      .update({ email_ingest_token: token })
      .eq('id', userId);

    if (!error) {
      return token;
    }
    // 23505 = ชน unique constraint ของ email_ingest_token — สุ่มใหม่
    if (error.code !== '23505') {
      throw error;
    }
  }
  throw new Error('rotateEmailIngestToken: สุ่ม token ไม่สำเร็จหลังลองหลายครั้ง');
}

/** คืน token ที่มีอยู่ ถ้ายังไม่มีให้สร้างใหม่ */
export async function ensureEmailIngestToken(userId: string): Promise<string> {
  const existing = await getEmailIngestToken(userId);
  return existing ?? rotateEmailIngestToken(userId);
}

/**
 * หา line_user_id จาก users.id ภายในระบบ — ใช้ตอนจะ push หาผู้ใช้
 * คืน null ถ้าไม่เจอหรือผู้ใช้ถูกปิดใช้งาน (บล็อกบอทไปแล้ว) ซึ่งไม่ควร push หาอีก
 * ⚖️ G6: ผู้เรียกส่ง user_id ภายในมาเท่านั้น ไม่ต้องรู้จัก line_user_id เอง
 */
export async function getLineUserId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('line_user_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data || !data.is_active) return null;
  return data.line_user_id ?? null;
}
