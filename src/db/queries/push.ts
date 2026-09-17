// ไฟล์นี้ทำหน้าที่อะไร: query ตาราง push_log — จองสิทธิ์ส่ง push และนับโควตาที่ใช้ไปเดือนนี้
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S13 Push & Quota
// ⚖️ กฎเหล็ก G6
//
// หัวใจของไฟล์นี้: การ "จองสิทธิ์" กับการ "ส่งจริง" ต้องแยกกัน
// insert ลง push_log ก่อนแล้วค่อยยิง LINE API — ถ้าชน unique ของ dedup_key
// แปลว่ามี process อื่นส่งไปแล้ว เราต้องไม่ส่งซ้ำ
//
// ทำกลับด้าน (ส่งก่อนแล้วค่อย log) ไม่ได้ เพราะถ้า cron ยิงพร้อมกันสองรอบ
// ทั้งคู่จะเห็นว่ายังไม่มี log แล้วส่งข้อความซ้ำให้ผู้ใช้สองครั้ง

import { supabase } from '../supabase';

/**
 * จองสิทธิ์ส่ง push หนึ่งครั้ง — คืน false ถ้าเคยส่งไปแล้ว (dedup_key ซ้ำ)
 *
 * @param dedupKey กุญแจกันซ้ำ เช่น `daily:2026-09-17:<user_id>` (SPEC §S13)
 */
export async function claimPushSlot(
  userId: string,
  kind: string,
  dedupKey: string
): Promise<boolean> {
  const { error } = await supabase
    .from('push_log')
    .insert({ user_id: userId, kind, dedup_key: dedupKey });

  if (error) {
    // 23505 = unique_violation แปลว่ามีคนจองสิทธิ์นี้ไปแล้ว ไม่ใช่ error จริง
    if (error.code === '23505') {
      return false;
    }
    throw error;
  }
  return true;
}

/**
 * คืนสิทธิ์ที่จองไว้ ใช้เมื่อยิง LINE API ไม่สำเร็จ
 * เพื่อให้รอบถัดไปมีโอกาสส่งใหม่ ไม่ใช่เงียบไปเลยทั้งที่ผู้ใช้ยังไม่ได้รับอะไร
 */
export async function releasePushSlot(dedupKey: string): Promise<void> {
  const { error } = await supabase.from('push_log').delete().eq('dedup_key', dedupKey);
  if (error) {
    throw error;
  }
}

/**
 * จำนวน push ที่ส่งไปแล้วตั้งแต่ `fromIso` — ใช้เทียบกับ PUSH_LIMIT
 *
 * นับทั้งระบบ ไม่ใช่รายคน เพราะโควตา 280 ข้อความของ LINE free tier
 * เป็นของ "ช่องทาง" ไม่ใช่ของผู้ใช้แต่ละคน
 */
export async function countPushSince(fromIso: string): Promise<number> {
  const { count, error } = await supabase
    .from('push_log')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', fromIso);

  if (error) {
    throw error;
  }
  return count ?? 0;
}

/** ลบ log เก่ากว่าวันที่กำหนด — ใช้โดย job cleanup */
export async function deletePushLogsBefore(beforeIso: string): Promise<number> {
  const { data, error } = await supabase
    .from('push_log')
    .delete()
    .lt('sent_at', beforeIso)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}
