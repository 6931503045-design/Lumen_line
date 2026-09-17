// ไฟล์นี้ทำหน้าที่อะไร: query ลบ/หมดอายุข้อมูลเก่า สำหรับงาน cleanup รายวัน
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S7 ตารางงานตามเวลา แถว cleanup
//
// ⚠️ ข้อยกเว้น G6 ที่ตั้งใจ: query ที่นี่กวาดข้อมูลของผู้ใช้ทุกคน เพราะเป็นงานบำรุงรักษา
// ไม่มีผู้ใช้คนไหนเป็นเจ้าของ request เรียกได้จาก src/jobs/* เท่านั้น ซึ่งต้องมี CRON_SECRET
//
// 🔒 ทุก query ที่นี่ "ลบของเก่า" เท่านั้น ห้ามแตะ transactions เด็ดขาด
// เงินของผู้ใช้ไม่มีวันหมดอายุ — ตารางที่ลบได้คือ log และคำขอที่ค้างเท่านั้น

import { supabase } from '../supabase';

/** pending_actions ที่เลยเวลาแล้วแต่ยังค้างสถานะ waiting → expired (ไม่ลบทิ้ง เก็บไว้ตรวจได้) */
export async function expirePendingActions(nowIso: string): Promise<number> {
  const { data, error } = await supabase
    .from('pending_actions')
    .update({ status: 'expired' })
    .eq('status', 'waiting')
    .lt('expires_at', nowIso)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

/**
 * แผนที่ยังเป็น draft เกิน 24 ชม. → cancelled
 * draft คือทางเลือกที่ระบบเสนอแล้วผู้ใช้ไม่ได้เลือก ปล่อยค้างไว้จะไปกินโควตา
 * "แผน active ไม่เกิน 3" ผิดพลาดตอนนับ และรกหน้าจอ
 */
export async function cancelStaleDraftPlans(beforeIso: string): Promise<number> {
  const { data, error } = await supabase
    .from('plans')
    .update({ status: 'cancelled' })
    .eq('status', 'draft')
    .lt('created_at', beforeIso)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

/** webhook_events เก็บไว้กันประมวลผลซ้ำ พ้น 7 วันแล้ว LINE ไม่ retry อีก ลบได้ */
export async function deleteOldWebhookEvents(beforeIso: string): Promise<number> {
  const { data, error } = await supabase
    .from('webhook_events')
    .delete()
    .lt('received_at', beforeIso)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

/** ai_usage_log เก็บไว้ดูโควตา/debug พ้น 90 วันแล้วไม่มีประโยชน์ */
export async function deleteOldAiUsageLogs(beforeIso: string): Promise<number> {
  const { data, error } = await supabase
    .from('ai_usage_log')
    .delete()
    .lt('created_at', beforeIso)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}
