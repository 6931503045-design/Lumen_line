// ไฟล์นี้ทำหน้าที่อะไร: ส่งข้อความ push หาผู้ใช้ โดยผ่านโควตาและการกันส่งซ้ำเสมอ
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S13 "push ทุกครั้ง MUST ผ่าน quota.service" + "MUST มี dedup_key"
// ⚖️ กฎเหล็ก G5, G6
//
// 🚫 ห้าม import lineClient ไปเรียก pushMessage เองจากที่อื่น
//    ทุกการ push ต้องผ่าน sendPush() ในไฟล์นี้ ไม่งั้นโควตากับ dedup จะไม่ถูกนับ
//
// ⚖️ G6: รับ userId ภายในระบบ แล้ว query line_user_id เองที่นี่
//    ผู้เรียกไม่ต้องรู้จัก line_user_id และไม่มีทางส่งผิดคนจากการส่ง id มาผิดชนิด

import { lineClient } from './client';
import { logger } from '../utils/logger';
import { claimPushSlot, releasePushSlot } from '../db/queries/push';
import { getLineUserId } from '../db/queries/users';
import { checkPushQuota, logQuotaRejection, type PushKind } from '../services/quota.service';

export type PushResult =
  | { sent: true }
  | { sent: false; reason: 'duplicate' | 'quota' | 'no-line-user' | 'error' };

/**
 * ส่งข้อความ push หนึ่งครั้ง
 *
 * ลำดับสำคัญมาก: เช็คโควตา → จองสิทธิ์ (insert push_log) → ค่อยยิง LINE API
 * ถ้ายิงไม่สำเร็จจะคืนสิทธิ์ให้รอบหน้าลองใหม่
 *
 * จองก่อนส่งเพราะถ้าทำกลับด้าน (ส่งก่อนแล้วค่อย log) แล้ว cron ยิงพร้อมกันสองรอบ
 * ทั้งคู่จะเห็นว่ายังไม่มี log แล้วส่งข้อความซ้ำให้ผู้ใช้สองครั้ง
 *
 * @param dedupKey กุญแจกันซ้ำ เช่น `budget100:2026-09:<categoryId>` — ต้องไม่ซ้ำข้ามผู้ใช้
 */
export async function sendPush(
  userId: string,
  kind: PushKind,
  dedupKey: string,
  text: string
): Promise<PushResult> {
  const decision = await checkPushQuota(kind);
  if (!decision.allowed) {
    logQuotaRejection(kind, decision);
    return { sent: false, reason: 'quota' };
  }

  const lineUserId = await getLineUserId(userId);
  if (!lineUserId) {
    logger.warn(`[push] ข้าม: ไม่พบ line_user_id ของผู้ใช้ ${userId}`);
    return { sent: false, reason: 'no-line-user' };
  }

  const claimed = await claimPushSlot(userId, kind, dedupKey);
  if (!claimed) {
    return { sent: false, reason: 'duplicate' };
  }

  try {
    await lineClient.pushMessage({ to: lineUserId, messages: [{ type: 'text', text }] });
    return { sent: true };
  } catch (err) {
    // คืนสิทธิ์เพื่อให้รอบหน้าลองใหม่ได้ — ไม่งั้นผู้ใช้จะไม่ได้รับข้อความนี้เลยตลอดกาล
    logger.error('[push] ส่งไม่สำเร็จ กำลังคืนสิทธิ์:', err);
    await releasePushSlot(dedupKey).catch((releaseErr) => {
      logger.error('[push] คืนสิทธิ์ไม่สำเร็จ ข้อความนี้จะไม่ถูกส่งซ้ำอีก:', releaseErr);
    });
    return { sent: false, reason: 'error' };
  }
}
