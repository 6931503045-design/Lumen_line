import { supabase } from '../db/supabase';
import { DEFAULT_CATEGORIES } from '../config/constants';
import { ensureEmailIngestToken } from '../db/queries/users';

type LineEventLike = {
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
    }
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
