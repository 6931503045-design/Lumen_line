// ไฟล์นี้ทำหน้าที่อะไร: สร้าง/คืนสภาพบัญชีผู้ใช้ตอนแอดเพื่อน และแจ้งเรื่องข้อมูลส่วนบุคคล
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W1 (สร้างบัญชี) / W4 (ข้อความต้อนรับ + แจ้ง PDPA)
// อ้างอิง: SPEC.md §S11.4 "ความเป็นส่วนตัว" / SRS NFR-6
// ⚖️ กฎเหล็ก G5, G6

import { supabase } from '../db/supabase';
import { DEFAULT_CATEGORIES } from '../config/constants';
import { WELCOME_MESSAGE } from '../config/privacy';
import { ensureEmailIngestToken } from '../db/queries/users';
import { replyText } from '../line/reply';

type LineEventLike = {
  /** follow event ของ LINE มี replyToken มาด้วย ใช้ตอบข้อความต้อนรับได้ฟรี */
  replyToken?: string;
  source?: { userId?: string };
};

export async function handleFollow(event: LineEventLike): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    console.error('[followHandler] follow event ไม่มี userId');
    return;
  }

  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('id')
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (selectError) {
    console.error('[followHandler] select user error:', selectError);
    return;
  }

  if (existingUser) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ is_active: true })
      .eq('id', existingUser.id);

    if (updateError) {
      console.error('[followHandler] reactivate user error:', updateError);
      return;
    }

    // แอดกลับมาใหม่ก็ต้องได้เห็นข้อความแจ้งอีกครั้ง — คนที่เคยบล็อกแล้วกลับมา
    // ส่วนใหญ่ลืมไปแล้วว่าตกลงอะไรไว้ และระหว่างที่หายไปเงื่อนไขอาจเปลี่ยน
    await sendWelcome(event.replyToken);
    return;
  }

  const { data: newUser, error: insertUserError } = await supabase
    .from('users')
    .insert({ line_user_id: lineUserId })
    .select('id')
    .single();

  if (insertUserError || !newUser) {
    console.error('[followHandler] insert user error:', insertUserError);
    return;
  }

  const categoryRows = DEFAULT_CATEGORIES.map((category) => ({
    user_id: newUser.id,
    name: category.name,
    type: category.type,
    emoji: category.emoji,
    is_default: true,
    is_essential: category.isEssential,
  }));

  const { error: seedError } = await supabase.from('categories').insert(categoryRows);
  if (seedError) {
    console.error('[followHandler] seed default categories error:', seedError);
  }

  // สร้างที่อยู่ +token สำหรับ forward อีเมลธนาคาร (SPEC §S8) ให้ตั้งแต่ตอนนี้
  // ผู้ใช้จะเห็นที่อยู่เต็มได้ในหน้า settings ของ LIFF โดยไม่ต้องรอให้ระบบสร้างทีหลัง
  // ล้มเหลวไม่ถือว่าร้ายแรง: ensureEmailIngestToken() จะสร้างให้เองตอนเปิดหน้า settings
  try {
    await ensureEmailIngestToken(newUser.id);
  } catch (err) {
    console.error('[followHandler] สร้าง email_ingest_token ไม่สำเร็จ:', err);
  }

  // 🔴 ส่งหลังสร้างบัญชีเสร็จเท่านั้น (SPEC §S11.4)
  // ถ้าส่งก่อนแล้วการสร้างบัญชีพัง ผู้ใช้จะได้ข้อความชวนให้เริ่มใช้
  // ทั้งที่พิมพ์อะไรไปก็จะเจอ "ยังไม่พบบัญชีผู้ใช้" ซึ่งสับสนกว่าไม่ได้ข้อความเลย
  await sendWelcome(event.replyToken);
}

/**
 * ข้อความต้อนรับพร้อมการแจ้งเรื่องข้อมูลส่วนบุคคล (SPEC §S11.4 / NFR-6)
 *
 * ⚠️ ใช้ reply ไม่ใช่ push เพราะ reply ฟรีและไม่กินโควตา 280 ครั้ง/เดือน
 * follow event มี replyToken มาให้อยู่แล้ว
 *
 * ไม่มี replyToken (เช่น event ที่ส่งมาจากการทดสอบ) ก็ข้ามไป ไม่ทำให้ flow พัง —
 * การสร้างบัญชีสำคัญกว่าการได้ข้อความต้อนรับ
 */
async function sendWelcome(replyToken: string | undefined): Promise<void> {
  if (!replyToken) {
    console.warn('[followHandler] follow event ไม่มี replyToken ข้ามข้อความต้อนรับ');
    return;
  }
  await replyText(replyToken, WELCOME_MESSAGE);
}

export async function handleUnfollow(event: LineEventLike): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    console.error('[followHandler] unfollow event ไม่มี userId');
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('line_user_id', lineUserId);

  if (error) {
    console.error('[followHandler] deactivate user error:', error);
  }
}
