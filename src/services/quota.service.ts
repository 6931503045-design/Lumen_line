// ไฟล์นี้ทำหน้าที่อะไร: ตัดสินใจว่า push ข้อความนี้ได้ไหม ตามโควตาที่เหลือและความสำคัญ
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S13 Push & Quota
// ⚖️ กฎเหล็ก G4
//
// ทำไมต้องมี: LINE free tier ให้ push เดือนละ 280 ข้อความ "ต่อช่องทาง" ไม่ใช่ต่อผู้ใช้
// ถ้าปล่อยให้ทุกที่ push ได้อิสระ ผู้ใช้คนเดียวที่ใช้เยอะจะกินโควตาของทุกคนหมด
// แล้วการเตือน "งบเกิน" ของคนอื่นจะส่งไม่ออกทั้งเดือนโดยไม่มีใครรู้
//
// reply (ตอบในแชท) ไม่กินโควตานี้ — ถ้าเตือนพร้อม reply ได้ให้ใช้ reply เสมอ (S5.8)

import { PUSH_LIMIT } from '../config/constants';
import { getMonthStartIso, toBangkokDayStart } from '../utils/thaiDate';
import { countPushSince } from '../db/queries/push';
import { logger } from '../utils/logger';

/**
 * ลำดับความสำคัญตาม SPEC §S13 (เลขน้อย = สำคัญกว่า)
 *   ① งบเกิน 100%  ② แผนหลุดเป้า/ครบเป้า  ③ งบ 80%  ④ สรุปรายวัน
 */
export const PUSH_PRIORITY = {
  budgetOver: 1,
  planStatus: 2,
  budgetWarning: 3,
  dailySummary: 4,
} as const;

export type PushKind = keyof typeof PUSH_PRIORITY;

/**
 * เมื่อโควตาเหลือน้อยกว่าสัดส่วนนี้ ให้ส่งเฉพาะระดับ ① และ ② (SPEC §S13)
 * เพื่อกันไม่ให้สรุปรายวันกินโควตาจนไม่เหลือให้เรื่องด่วนตอนปลายเดือน
 */
const RESERVE_RATIO = 0.2;
const RESERVED_PRIORITY = PUSH_PRIORITY.planStatus;

export type QuotaDecision = {
  allowed: boolean;
  /** ส่งไปแล้วกี่ข้อความเดือนนี้ */
  used: number;
  remaining: number;
  /** เหตุผลที่ส่งไม่ได้ — null ถ้าส่งได้ */
  reason: string | null;
};

/**
 * ส่ง push ประเภทนี้ได้ไหม ณ ตอนนี้
 * นับจากต้นเดือน "ตามเวลาไทย" ไม่ใช่ UTC — ไม่งั้นช่วงหัวค่ำของวันสิ้นเดือน
 * จะถูกนับเข้าเดือนถัดไปเร็วกว่าความจริง 7 ชั่วโมง
 */
export async function checkPushQuota(kind: PushKind): Promise<QuotaDecision> {
  const monthStart = toBangkokDayStart(getMonthStartIso());
  const used = await countPushSince(monthStart);
  const remaining = Math.max(0, PUSH_LIMIT - used);

  if (remaining <= 0) {
    return { allowed: false, used, remaining, reason: `ใช้โควตา push ครบ ${PUSH_LIMIT} ข้อความแล้วเดือนนี้` };
  }

  const priority = PUSH_PRIORITY[kind];
  if (remaining < PUSH_LIMIT * RESERVE_RATIO && priority > RESERVED_PRIORITY) {
    return {
      allowed: false,
      used,
      remaining,
      reason: `โควตาเหลือ ${remaining} ข้อความ กันไว้ให้เรื่องด่วนเท่านั้น`,
    };
  }

  return { allowed: true, used, remaining, reason: null };
}

/** log ตอนถูกปฏิเสธ เพื่อให้รู้ว่าโควตาหมดจริง ไม่ใช่ระบบเงียบไปเฉยๆ */
export function logQuotaRejection(kind: PushKind, decision: QuotaDecision): void {
  logger.warn(
    `[quota] ไม่ส่ง push ประเภท ${kind}: ${decision.reason} (ใช้ไป ${decision.used}/${PUSH_LIMIT})`
  );
}
