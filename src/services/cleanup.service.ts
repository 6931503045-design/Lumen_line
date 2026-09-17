// ไฟล์นี้ทำหน้าที่อะไร: งานบำรุงรักษารายวัน — ทำให้ของที่ค้างหมดอายุ และลบ log เก่า
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S7 "cleanup | 03:00 | pending หมดอายุ → expired,
//          draft plan > 24 ชม. → cancelled, ลบ webhook_events > 7 วัน, ลบ ai_usage_log > 90 วัน"
//
// ⚠️ ทำไมงานนี้สำคัญกว่าที่เห็น: webhook_events เก็บทุก event ที่ LINE ส่งมา
// ถ้าไม่มีใครลบ ตารางจะโตไปเรื่อยๆ ตลอดอายุโปรเจกต์จนชน quota ของ Supabase free tier
// แล้วระบบจะเขียนข้อมูลไม่ได้ทั้งแอป — พังแบบที่ไม่มีใครเดาว่าสาเหตุมาจากตาราง log
//
// งานนี้ idempotent: รันซ้ำกี่ครั้งก็ได้ ของที่หมดอายุไปแล้วจะไม่ถูกนับซ้ำ
// เพราะทุก query มีเงื่อนไขสถานะเดิมกำกับไว้

import { logger } from '../utils/logger';
import { addDaysIso, getTodayIso, toBangkokDayStart } from '../utils/thaiDate';
import {
  cancelStaleDraftPlans,
  deleteOldAiUsageLogs,
  deleteOldWebhookEvents,
  expirePendingActions,
} from '../db/queries/cleanup';
import { deletePushLogsBefore } from '../db/queries/push';

/** อายุที่ยอมให้เก็บของแต่ละอย่าง (วัน) */
const WEBHOOK_EVENT_DAYS = 7;
const AI_USAGE_LOG_DAYS = 90;
/**
 * push_log เก็บนานกว่าหนึ่งเดือนเล็กน้อย เพราะโควตานับเป็นรายเดือน
 * ถ้าลบเร็วกว่านั้นจะนับโควตาผิด (เห็นว่าใช้ไปน้อยกว่าความจริง)
 */
const PUSH_LOG_DAYS = 45;
/** draft plan ที่ผู้ใช้ไม่ได้เลือกภายในหนึ่งวัน ถือว่าเลิกสนใจแล้ว */
const DRAFT_PLAN_HOURS = 24;

export type CleanupResult = {
  pendingExpired: number;
  draftPlansCancelled: number;
  webhookEventsDeleted: number;
  aiLogsDeleted: number;
  pushLogsDeleted: number;
};

export async function runCleanup(todayIso: string = getTodayIso()): Promise<CleanupResult> {
  const nowIso = new Date().toISOString();
  const draftCutoff = new Date(Date.now() - DRAFT_PLAN_HOURS * 3600_000).toISOString();

  // ขอบวันคิดตามเวลาไทย ไม่ใช่ UTC — ไม่งั้นเส้นแบ่ง "7 วันก่อน" จะเลื่อนไป 7 ชั่วโมง
  const webhookCutoff = toBangkokDayStart(addDaysIso(todayIso, -WEBHOOK_EVENT_DAYS));
  const aiLogCutoff = toBangkokDayStart(addDaysIso(todayIso, -AI_USAGE_LOG_DAYS));
  const pushLogCutoff = toBangkokDayStart(addDaysIso(todayIso, -PUSH_LOG_DAYS));

  const result: CleanupResult = {
    pendingExpired: await expirePendingActions(nowIso),
    draftPlansCancelled: await cancelStaleDraftPlans(draftCutoff),
    webhookEventsDeleted: await deleteOldWebhookEvents(webhookCutoff),
    aiLogsDeleted: await deleteOldAiUsageLogs(aiLogCutoff),
    pushLogsDeleted: await deletePushLogsBefore(pushLogCutoff),
  };

  logger.info('[cleanup] รอบบำรุงรักษาจบ:', result);
  return result;
}
