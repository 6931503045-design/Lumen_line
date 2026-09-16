// ไฟล์นี้ทำหน้าที่อะไร: คำนวณรอบถัดไปของรายการประจำ สร้างรายการที่ถึงรอบ และรวมยอดต่อเดือน
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S5.9 Recurring, §S5.3 (recurringTotal), §S7 (งาน recurring 06:00)
// ⚖️ กฎเหล็ก G1, G3, G6, G7
//
// G1 — ไม่มี AI แตะไฟล์นี้ วันที่รอบถัดไปและยอดเงินมาจากสูตรล้วนๆ
// G3 — ทุกยอดเป็นสตางค์ (integer) แปลงเป็นบาทที่ชั้น db/queries เท่านั้น
//
// ⚠️ ทุกอย่างที่นี่ต้อง idempotent: node-cron ในเซิร์ฟเวอร์กับ GitHub Actions อาจยิงพร้อมกัน
// การกันซ้ำอยู่ที่ unique (recurring_rule_id, recurring_run_date) ของตาราง transactions
// ไม่ใช่ที่ตัวแปรในโค้ด — เพราะสองโปรเซสไม่เห็นตัวแปรของกัน

import { toSatang } from '../utils/money';
import {
  addDaysIso,
  daysInMonth,
  getTodayIso,
  isoDayOfWeek,
  parseIsoDate,
  shiftMonthClampDay,
  toBangkokDayStart,
} from '../utils/thaiDate';
import { logger } from '../utils/logger';
import {
  deactivateRule,
  insertRecurringRule,
  insertRecurringTransaction,
  listActiveRulesByUser,
  listDueRulesAllUsers,
  updateRuleSchedule,
  type RecurringFrequency,
  type RecurringRuleRow,
} from '../db/queries/recurring';

/**
 * เพดานจำนวนรอบที่ตามเก็บย้อนหลังได้ต่อกฎหนึ่งข้อในการรันหนึ่งครั้ง
 *
 * S7 บอกให้ "วนจนกว่า next_run > วันนี้" เพื่อตามทันตอนเซิร์ฟเวอร์หลับ แต่ต้องมีเพดาน:
 * ถ้ามีกฎที่ next_run เพี้ยนไปอยู่ปี 1970 (จากบั๊กหรือข้อมูลนำเข้าผิด) การวนแบบไม่จำกัด
 * จะสร้างรายการหลักหมื่นให้ผู้ใช้ในคราวเดียว ซึ่งกู้คืนยากกว่าการตามเก็บไม่ครบมาก
 * 400 ครอบคลุมกรณีจริงที่สุดคือรายวันที่หลับไปเกินปี
 */
const MAX_CATCH_UP_RUNS = 400;

/** ตัวคูณแปลงความถี่เป็น "ต่อเดือน" ตามตาราง S5.3 */
const MONTHLY_FACTOR: Record<RecurringFrequency, number> = {
  daily: 365 / 12,
  weekly: 52 / 12,
  monthly: 1,
  yearly: 1 / 12,
};

/**
 * รอบถัดไปหลังจากวันที่ `fromIso` — คืนวันที่ที่ "หลังจาก fromIso เสมอ" ไม่เท่ากับ fromIso
 *
 * ฟังก์ชันบริสุทธิ์: ไม่อ่านเวลาปัจจุบัน ไม่แตะ DB จึง test ได้ตรงๆ ทุกกรณีขอบ
 */
export function computeNextRun(
  rule: Pick<RecurringRuleRow, 'frequency' | 'day_of_month' | 'day_of_week'>,
  fromIso: string
): string {
  switch (rule.frequency) {
    case 'daily':
      return addDaysIso(fromIso, 1);

    case 'weekly': {
      // ไม่ได้ระบุวันในสัปดาห์ → ยึดวันเดียวกับรอบปัจจุบัน (ครบ 7 วันพอดี)
      const target = rule.day_of_week ?? isoDayOfWeek(fromIso);
      const delta = (target - isoDayOfWeek(fromIso) + 7) % 7;
      // delta = 0 แปลว่าวันนี้ตรงวันเป้าหมายอยู่แล้ว รอบถัดไปคือสัปดาห์หน้า ไม่ใช่วันนี้
      return addDaysIso(fromIso, delta === 0 ? 7 : delta);
    }

    case 'monthly': {
      // ยึดวันที่จากกฎเสมอ ไม่ใช่จาก fromIso ที่อาจถูกหดไปแล้ว (เช่น 31 ม.ค. → 28 ก.พ.)
      // ไม่งั้นรอบถัดไปจะกลายเป็น 28 มี.ค. แทนที่จะกลับเป็น 31 มี.ค.
      const anchorDay = rule.day_of_month ?? parseIsoDate(fromIso).day;
      return shiftMonthClampDay(fromIso, 1, anchorDay);
    }

    case 'yearly': {
      // รายปียึดเดือน/วันของรอบปัจจุบัน 29 ก.พ. ในปีที่ไม่ใช่อธิกสุรทิน → 28 ก.พ.
      const { year, month, day } = parseIsoDate(fromIso);
      const nextYear = year + 1;
      const clampedDay = Math.min(day, daysInMonth(nextYear, month));
      return `${nextYear}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
  }
}

/**
 * ยอดของกฎหนึ่งข้อคิดเป็น "ต่อเดือน" (สตางค์) ตามตัวคูณใน S5.3
 * ปัดครึ่งขึ้นครั้งเดียวตอนท้าย ตามกติการ่วมของ §S5
 */
export function toMonthlySatang(
  rule: Pick<RecurringRuleRow, 'amount' | 'frequency'>
): number {
  return Math.round(toSatang(rule.amount) * MONTHLY_FACTOR[rule.frequency]);
}

export type RecurringTotals = {
  /** รายรับประจำต่อเดือน (สตางค์) */
  incomeSatang: number;
  /** รายจ่ายประจำต่อเดือน (สตางค์) = `recurringTotal` ในสูตร S5.3 */
  expenseSatang: number;
};

/**
 * ยอดรายการประจำต่อเดือนของผู้ใช้ แยกรายรับ/รายจ่าย
 * plan.service เอา expenseSatang ไปใช้เป็น `recurringTotal` ในสูตร disposable (S5.3)
 * และเอา incomeSatang ไปใช้ตอน cold-start (S5.5) ที่ยังไม่มีประวัติรายรับพอ
 */
export async function getMonthlyRecurringTotals(userId: string): Promise<RecurringTotals> {
  const rules = await listActiveRulesByUser(userId);

  let incomeSatang = 0;
  let expenseSatang = 0;
  for (const rule of rules) {
    const monthly = toMonthlySatang(rule);
    if (rule.type === 'income') incomeSatang += monthly;
    else expenseSatang += monthly;
  }

  return { incomeSatang, expenseSatang };
}

export type RecurringRuleView = {
  id: string;
  label: string;
  type: 'income' | 'expense';
  amountSatang: number;
  monthlySatang: number;
  frequency: RecurringFrequency;
  nextRun: string;
  endDate: string | null;
  categoryId: string | null;
  categoryName: string | null;
  emoji: string | null;
};

/** รายการประจำทั้งหมดของผู้ใช้ สำหรับหน้าเว็บ */
export async function listRecurringRules(userId: string): Promise<RecurringRuleView[]> {
  const rules = await listActiveRulesByUser(userId);
  return rules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    type: rule.type,
    amountSatang: toSatang(rule.amount),
    monthlySatang: toMonthlySatang(rule),
    frequency: rule.frequency,
    nextRun: rule.next_run,
    endDate: rule.end_date,
    categoryId: rule.category_id,
    categoryName: rule.categories?.name ?? null,
    emoji: rule.categories?.emoji ?? null,
  }));
}

/** error ที่ route แปลงเป็น HTTP 400/404 ได้โดยไม่ต้องเดาจากข้อความ */
export class RecurringError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404
  ) {
    super(message);
    this.name = 'RecurringError';
  }
}

export type CreateRecurringInput = {
  userId: string;
  label: string;
  type: 'income' | 'expense';
  amountSatang: number;
  frequency: RecurringFrequency;
  /** วันที่ของเดือน (1-31) สำหรับ monthly — ไม่ส่งมาจะยึดวันของ startDate */
  dayOfMonth?: number | null;
  /** วันในสัปดาห์ (0=อาทิตย์) สำหรับ weekly — ไม่ส่งมาจะยึดวันของ startDate */
  dayOfWeek?: number | null;
  /** รอบแรกที่ต้องการให้เริ่มนับ ไม่ส่งมา = วันนี้ */
  startDate?: string;
  endDate?: string | null;
};

const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export async function createRecurringRule(
  input: CreateRecurringInput
): Promise<RecurringRuleView> {
  if (!input.label.trim()) {
    throw new RecurringError('ต้องตั้งชื่อรายการประจำ', 400);
  }
  if (!Number.isInteger(input.amountSatang) || input.amountSatang <= 0) {
    throw new RecurringError('จำนวนเงินต้องมากกว่า 0 บาท (กฎ G3)', 400);
  }
  if (!FREQUENCIES.includes(input.frequency)) {
    throw new RecurringError(`ความถี่ไม่ถูกต้อง: "${input.frequency}"`, 400);
  }

  const startDate = input.startDate ?? getTodayIso();
  // parseIsoDate จะ throw เองถ้ารูปแบบผิด — แปลงเป็น error ที่ผู้ใช้อ่านรู้เรื่องแทน
  let startParts;
  try {
    startParts = parseIsoDate(startDate);
  } catch {
    throw new RecurringError(`วันเริ่มไม่ถูกต้อง: "${startDate}" (ต้องเป็น YYYY-MM-DD)`, 400);
  }

  if (input.endDate) {
    try {
      parseIsoDate(input.endDate);
    } catch {
      throw new RecurringError(`วันสิ้นสุดไม่ถูกต้อง: "${input.endDate}"`, 400);
    }
    if (input.endDate < startDate) {
      throw new RecurringError('วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม', 400);
    }
  }

  const dayOfMonth = input.frequency === 'monthly'
    ? (input.dayOfMonth ?? startParts.day)
    : null;
  const dayOfWeek = input.frequency === 'weekly'
    ? (input.dayOfWeek ?? isoDayOfWeek(startDate))
    : null;

  if (dayOfMonth !== null && (dayOfMonth < 1 || dayOfMonth > 31)) {
    throw new RecurringError('วันที่ของเดือนต้องอยู่ระหว่าง 1-31', 400);
  }
  if (dayOfWeek !== null && (dayOfWeek < 0 || dayOfWeek > 6)) {
    throw new RecurringError('วันในสัปดาห์ต้องอยู่ระหว่าง 0-6 (0 = อาทิตย์)', 400);
  }

  const rule = await insertRecurringRule({
    userId: input.userId,
    categoryId: null,
    label: input.label.trim(),
    type: input.type,
    amountSatang: input.amountSatang,
    frequency: input.frequency,
    dayOfMonth,
    dayOfWeek,
    nextRun: startDate,
    endDate: input.endDate ?? null,
  });

  return {
    id: rule.id,
    label: rule.label,
    type: rule.type,
    amountSatang: toSatang(rule.amount),
    monthlySatang: toMonthlySatang(rule),
    frequency: rule.frequency,
    nextRun: rule.next_run,
    endDate: rule.end_date,
    categoryId: rule.category_id,
    categoryName: null,
    emoji: null,
  };
}

/** ⚖️ G6: ปิดกฎได้เฉพาะกฎของผู้ใช้คนนั้นเอง */
export async function removeRecurringRule(userId: string, ruleId: string): Promise<boolean> {
  return deactivateRule(userId, ruleId);
}

export type RecurringRunResult = {
  /** จำนวนกฎที่ถึงรอบและถูกประมวลผล */
  rulesProcessed: number;
  /** จำนวน transaction ที่สร้างใหม่จริง */
  created: number;
  /** จำนวนรอบที่ข้ามเพราะมีรายการอยู่แล้ว (รันซ้ำ = ตัวเลขนี้ขึ้น created ไม่ขึ้น) */
  skippedDuplicate: number;
  /** จำนวนกฎที่ถูกปิดเพราะเลย end_date */
  deactivated: number;
  /** จำนวนกฎที่ชนเพดานการตามเก็บย้อนหลัง — ถ้าไม่เป็น 0 แปลว่ามีข้อมูลผิดปกติ ต้องไปดู */
  cappedRules: number;
  /** จำนวนกฎที่พังระหว่างทาง (ไม่ทำให้กฎอื่นหยุด) */
  failed: number;
};

const EMPTY_RUN_RESULT: RecurringRunResult = {
  rulesProcessed: 0,
  created: 0,
  skippedDuplicate: 0,
  deactivated: 0,
  cappedRules: 0,
  failed: 0,
};

/**
 * ทำงานของกฎหนึ่งข้อ: สร้างรายการทุกรอบที่ค้างอยู่จนถึงวันนี้ แล้วเลื่อน next_run
 *
 * occurred_at ตั้งเป็นต้นวันตามเวลาไทยของ "วันที่รอบนั้นควรเกิด" ไม่ใช่เวลาที่ job รัน
 * เพื่อให้รายการที่ตามเก็บย้อนหลังไปตกอยู่ในเดือนที่ถูกต้องตอนคิดยอดสรุป
 */
async function runRule(rule: RecurringRuleRow, todayIso: string, result: RecurringRunResult) {
  let runDate = rule.next_run;
  let stillActive = true;
  let iterations = 0;

  while (runDate <= todayIso) {
    if (rule.end_date && runDate > rule.end_date) {
      stillActive = false;
      break;
    }

    if (iterations >= MAX_CATCH_UP_RUNS) {
      result.cappedRules += 1;
      logger.warn(
        `[recurring] กฎ ${rule.id} ค้างเกิน ${MAX_CATCH_UP_RUNS} รอบ หยุดตามเก็บไว้ที่ ${runDate} — ตรวจสอบ next_run ของกฎนี้`
      );
      break;
    }

    const inserted = await insertRecurringTransaction({
      userId: rule.user_id,
      categoryId: rule.category_id,
      type: rule.type,
      amountSatang: toSatang(rule.amount),
      note: rule.label,
      occurredAt: toBangkokDayStart(runDate),
      ruleId: rule.id,
      runDate,
    });

    if (inserted) result.created += 1;
    else result.skippedDuplicate += 1;

    runDate = computeNextRun(rule, runDate);
    iterations += 1;
  }

  // กฎที่รอบถัดไปเลย end_date แล้ว ไม่ต้องรอให้ถึงวันนั้นค่อยปิด
  if (stillActive && rule.end_date && runDate > rule.end_date) {
    stillActive = false;
  }

  await updateRuleSchedule(rule.id, runDate, stillActive);
  if (!stillActive) result.deactivated += 1;
}

/**
 * งาน `recurring` ของ S7 — สร้างรายการของทุกกฎที่ถึงรอบ ของผู้ใช้ทุกคน
 * กฎข้อหนึ่งพังต้องไม่ทำให้กฎที่เหลือหยุด (เหมือน emailPoll)
 */
export async function processDueRecurringRules(
  todayIso: string = getTodayIso()
): Promise<RecurringRunResult> {
  const result: RecurringRunResult = { ...EMPTY_RUN_RESULT };
  const rules = await listDueRulesAllUsers(todayIso);

  for (const rule of rules) {
    result.rulesProcessed += 1;
    try {
      await runRule(rule, todayIso, result);
    } catch (err) {
      result.failed += 1;
      logger.error(`[recurring] กฎ ${rule.id} ทำงานไม่สำเร็จ:`, err);
    }
  }

  return result;
}
