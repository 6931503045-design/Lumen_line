// ไฟล์นี้ทำหน้าที่อะไร: ตรวจแผนออมของผู้ใช้ทุกคนทุกวัน แล้วเตือนเมื่อหลุดเป้าหรือครบเป้า
// ใครรับผิดชอบ: ③ AI (ตาม SPEC) — แต่ไม่มี AI ในไฟล์นี้เลย
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S5.6 ติดตามและปรับแผน, §S7 ("planCheck | 09:00 ไทย | 0 2 * * * UTC")
// ⚖️ กฎเหล็ก G1, G7
//
// แยกจาก plan.service เพราะที่นั่นเป็นโซน §S5 Money Engine ที่มีแต่การคำนวณล้วนๆ
// ส่วนไฟล์นี้เป็นงาน "ตัดสินใจว่าจะส่งข้อความไหม" ซึ่งคนละหน้าที่กัน
// การคำนวณความคืบหน้ายังใช้ computePlanProgress ของ plan.service ที่เดียวเหมือนเดิม

import { formatBaht, toSatang } from '../utils/money';
import { getTodayIso, getWeekStartIso } from '../utils/thaiDate';
import { logger } from '../utils/logger';
import {
  listActivePlansAllUsers,
  listTransferRowsForPlans,
  transitionPlanStatus,
} from '../db/queries/plans';
import { computePlanProgress } from './plan.service';
import { sendPush } from '../line/push';

export type PlanCheckResult = {
  plansChecked: number;
  /** แผนที่ออมครบเป้าแล้ว เปลี่ยนเป็น completed */
  completed: number;
  /** แผนที่ออมช้ากว่าเป้า */
  offTrack: number;
  /** ส่ง push สำเร็จกี่ข้อความ */
  pushed: number;
  /** ไม่ได้ส่งเพราะซ้ำ/โควตา/ผู้ใช้บล็อกบอท — ไม่ใช่ error */
  pushSkipped: number;
  /** แผนที่พังระหว่างทาง (ไม่ทำให้แผนอื่นหยุด) */
  failed: number;
};

const EMPTY_RESULT: PlanCheckResult = {
  plansChecked: 0,
  completed: 0,
  offTrack: 0,
  pushed: 0,
  pushSkipped: 0,
  failed: 0,
};

/**
 * ส่งคำยินดีตอนแผนครบเป้า — ใช้ร่วมกันระหว่าง job planCheck กับตอนผู้ใช้โอนจนครบเอง
 *
 * dedup_key เป็น `plandone:<planId>` เหมือนกันทั้งสองทาง จึงส่งได้ครั้งเดียวตลอดกาล
 * ไม่ว่าใครจะถึงก่อน — สำคัญเพราะถ้าผู้ใช้โอนจนครบผ่านหน้าเว็บ แล้ว job มาเจอทีหลัง
 * ผู้ใช้จะได้ข้อความยินดีสองรอบ
 */
export async function notifyPlanCompleted(
  userId: string,
  planId: string,
  title: string,
  targetSatang: number
): Promise<boolean> {
  const sent = await sendPush(
    userId,
    'planStatus',
    `plandone:${planId}`,
    completedMessage(title, targetSatang)
  );
  return sent.sent;
}

function completedMessage(title: string, targetSatang: number): string {
  return [
    `🎉 ครบเป้าแล้ว! "${title}"`,
    `ออมครบ ${formatBaht(targetSatang)} ตามที่ตั้งใจไว้`,
    '',
    'เก่งมากครับ 👏',
  ].join('\n');
}

function offTrackMessage(
  title: string,
  savedSatang: number,
  expectedSatang: number,
  remainingSatang: number
): string {
  return [
    `⚠️ แผน "${title}" ออมช้ากว่าเป้าหน่อยนะครับ`,
    `ตอนนี้ออมได้ ${formatBaht(savedSatang)} จากที่ควรจะถึง ${formatBaht(expectedSatang)}`,
    `เหลืออีก ${formatBaht(remainingSatang)} ถึงเป้า`,
    '',
    'ถ้าออมไม่ไหว ปรับแผนใหม่ให้ยืดเวลาออกไปได้ที่หน้าวิเคราะห์',
  ].join('\n');
}

/**
 * S5.6 — งาน planCheck รายวัน
 *
 * ครบเป้า → completed + แสดงความยินดี (ครั้งเดียวตลอดกาล)
 * หลุดเป้า → เตือนสัปดาห์ละครั้ง (dedup_key ผูกกับวันจันทร์ของสัปดาห์นั้น)
 *
 * แผนหนึ่งพังต้องไม่ทำให้แผนที่เหลือหยุด เหมือน emailPoll และ recurring
 */
export async function checkActivePlans(
  todayIso: string = getTodayIso(),
  now: Date = new Date()
): Promise<PlanCheckResult> {
  const result: PlanCheckResult = { ...EMPTY_RESULT };

  const plans = await listActivePlansAllUsers();
  if (plans.length === 0) return result;

  const transfers = await listTransferRowsForPlans(plans.map((plan) => plan.id));
  const savedByPlan = new Map<string, number>();
  for (const row of transfers) {
    savedByPlan.set(row.plan_id, (savedByPlan.get(row.plan_id) ?? 0) + toSatang(row.amount));
  }

  const weekKey = getWeekStartIso(todayIso);

  for (const plan of plans) {
    result.plansChecked += 1;
    try {
      const progress = computePlanProgress(plan, savedByPlan.get(plan.id) ?? 0, now);

      if (progress.reachedTarget) {
        // เปลี่ยนสถานะก่อนส่ง: ถ้าแพ้การแข่งกับ request อื่นที่ปิดแผนไปแล้ว
        // จะได้ไม่ส่งคำยินดีซ้ำ (transitionPlanStatus บังคับสถานะเดิมเป็น active)
        const closed = await transitionPlanStatus(plan.user_id, plan.id, 'active', 'completed');
        if (!closed) continue;

        result.completed += 1;
        const sent = await notifyPlanCompleted(
          plan.user_id,
          plan.id,
          plan.title,
          progress.targetSatang
        );
        if (sent) result.pushed += 1;
        else result.pushSkipped += 1;
        continue;
      }

      if (!progress.offTrack) continue;

      result.offTrack += 1;
      const sent = await sendPush(
        plan.user_id,
        'planStatus',
        `planoff:${plan.id}:${weekKey}`, // สัปดาห์ละครั้งตาม S5.6
        offTrackMessage(
          plan.title,
          progress.savedSatang,
          progress.expectedSatang,
          progress.remainingSatang
        )
      );
      if (sent.sent) result.pushed += 1;
      else result.pushSkipped += 1;
    } catch (err) {
      result.failed += 1;
      logger.error(`[planCheck] แผน ${plan.id} ตรวจไม่สำเร็จ:`, err);
    }
  }

  logger.info('[planCheck] รอบตรวจแผนจบ:', result);
  return result;
}
