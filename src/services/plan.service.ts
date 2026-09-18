// ไฟล์นี้ทำหน้าที่อะไร: คำนวณกำลังออมของผู้ใช้ สร้าง 3 ทางเลือกแผนออม และติดตามความคืบหน้า
// ใครรับผิดชอบ: ③ AI (ตาม SPEC) — แต่เนื้อในห้ามมี AI แม้แต่บรรทัดเดียว
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S5.3 สูตรหลัก, §S5.4 สร้าง 3 ทางเลือก, §S5.5 Cold-start, §S5.6 ติดตาม
// ⚖️ กฎเหล็ก G1, G3, G6, G7
//
// 🔴 §S5 คือ Money Engine "ห้ามมี AI" — ทุกตัวเลขในไฟล์นี้มาจากสูตรตรงๆ
// ข้อมูลเดิมเข้า ต้องได้ผลเดิมออกเสมอ AI แตะได้อย่างเดียวคือ "ข้อความที่ห่อตัวเลข" ไม่ใช่ตัวเลข
//
// G3 — ทุกยอดเป็นสตางค์ (integer) แปลงเป็นบาทที่ชั้น db/queries เท่านั้น
// G7 — ความคืบหน้าของแผนนับจาก transfer เท่านั้น ซึ่งไม่ถูกนับเป็นรายรับหรือรายจ่าย

import { roundDownToTenBaht, roundHalfUpToSatang, toSatang } from '../utils/money';
import {
  addDaysIso,
  getTodayIso,
  parseIsoDate,
  shiftMonthClampDay,
} from '../utils/thaiDate';
import {
  COLD_START,
  EMERGENCY_BUFFER,
  MAX_ACTIVE_PLANS,
  MAX_AMOUNT_SATANG,
  PLAN_SAFETY_RATIO,
} from '../config/constants';
import {
  cancelDraftPlans,
  findPlanOwnedByUser,
  insertDraftPlans,
  listPlansByUser,
  listPlanTransferRows,
  transitionPlanStatus,
  type PlanConfidence,
  type PlanRow,
} from '../db/queries/plans';
import {
  findFirstTransactionDate,
  listPlanningRowsInRange,
  type PlanningRow,
} from '../db/queries/summary';
import { getMonthlyRecurringTotals } from './recurring.service';
import { createTransaction } from './transaction.service';

/** ช่วงข้อมูลที่ S5.3 ใช้: 90 วันย้อนหลังนับจากเมื่อวาน */
const LOOKBACK_DAYS = 90;
/** 90 วัน = 3 เดือน — ตัวหารในนิยาม avgIncome3M / avgEssential / avgExpense */
const LOOKBACK_MONTHS = 3;

/** สัดส่วนของ capacity ที่ทางเลือก "สมดุล" และ "สบาย" ใช้ (S5.4) */
const BALANCED_RATIO = 0.6;
const RELAXED_RATIO = 0.35;

/** ทางเลือกที่ออมได้น้อยกว่านี้ให้ซ่อน (S5.4) — ฿100 = 10,000 สตางค์ */
const MIN_MONTHLY_SAVE_SATANG = 10_000;

/** เพดานจำนวนเดือนของแผน กันเคสเป้าใหญ่มากแล้วได้แผน 900 ปี */
const MAX_PLAN_MONTHS = 600;

/** S5.6: หลุดเป้าเมื่อคืบหน้า < เป้าสะสม × 0.9 และแผนเริ่มมาแล้ว ≥ 14 วัน */
const OFF_TRACK_RATIO = 0.9;
const OFF_TRACK_MIN_DAYS = 14;

export class PlanError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409
  ) {
    super(message);
    this.name = 'PlanError';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// S5.3 + S5.5 — กำลังออม
// ────────────────────────────────────────────────────────────────────────────

export type CapacityBreakdown = {
  /** รายรับเฉลี่ยต่อเดือน (สตางค์) */
  avgIncomeSatang: number;
  /** รายจ่ายประจำต่อเดือนจาก recurring_rules (สตางค์) */
  recurringTotalSatang: number;
  /** รายจ่ายจำเป็นที่ไม่ใช่รายการประจำ ต่อเดือน (สตางค์) */
  avgEssentialSatang: number;
  /** รายจ่ายรวมเฉลี่ยต่อเดือน (สตางค์) */
  avgExpenseSatang: number;
  /** เงินกันฉุกเฉิน = avgExpense × 0.15 (สตางค์) */
  emergencyBufferSatang: number;
};

export type PlanCapacity = {
  /** เงินที่ย้ายไปออมได้ต่อเดือนก่อนหักเผื่อความคลาดเคลื่อน (สตางค์ ติดลบได้) */
  disposableSatang: number;
  /** ออมเพิ่มได้อีกเท่าไหร่ต่อเดือน = disposable × 0.8 − Σ แผน active เดิม (สตางค์) */
  capacitySatang: number;
  /** Σ monthly_save ของแผน active ปัจจุบัน (สตางค์) */
  committedSatang: number;
  activePlanCount: number;
  confidence: PlanConfidence;
  /** จำนวนวันข้อมูลย้อนหลังที่ใช้ตัดสินระดับความมั่นใจ (S5.5) */
  daysOfData: number;
  breakdown: CapacityBreakdown;
  /** สร้างแผนใหม่ได้ไหม ถ้าไม่ได้ `reason` บอกเหตุผลเป็นตัวเลขตาม S5.3 */
  canCreatePlan: boolean;
  reason: string | null;
};

/** ระดับความมั่นใจตามจำนวนวันข้อมูล (S5.5) */
function confidenceFor(daysOfData: number): PlanConfidence {
  if (daysOfData < COLD_START.LOW_UNDER_DAYS) return 'low';
  if (daysOfData < COLD_START.MEDIUM_UNDER_DAYS) return 'medium';
  return 'high';
}

/** จำนวนวันระหว่างสองวันที่ ISO แบบนับรวมวันแรก (1 = วันเดียวกัน) */
function inclusiveDaysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  const diffMs =
    Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day);
  return Math.floor(diffMs / 86_400_000) + 1;
}

function sumRows(rows: PlanningRow[], predicate: (row: PlanningRow) => boolean): number {
  let total = 0;
  for (const row of rows) {
    // ⚖️ G7: transfer ไม่ใช่ทั้งรายรับและรายจ่าย ตัดออกก่อนเงื่อนไขอื่นเสมอ
    if (row.type === 'transfer') continue;
    if (predicate(row)) total += toSatang(row.amount);
  }
  return total;
}

/**
 * ตัวเลขฝั่ง "รายรับ/รายจ่าย" ที่เอาไปเข้าสูตร ต่างกันตามระดับความมั่นใจ (ตาราง S5.5)
 *
 * เหตุผลที่ต้องต่างกัน: ผู้ใช้ที่เพิ่งใช้มา 10 วันมีข้อมูลจริงแค่ 10 วัน การหารด้วย 3
 * แบบสูตรเต็มจะได้รายรับเฉลี่ยต่อเดือนต่ำกว่าความจริงราวสามเท่า แล้วระบบจะบอกว่า
 * "ออมไม่ไหว" ทั้งที่จริงออมได้ — ผู้ใช้ใหม่จะเลิกใช้แอปตั้งแต่วันแรก
 */
function estimateAverages(
  rows: PlanningRow[],
  daysOfData: number,
  confidence: PlanConfidence,
  recurringIncomeSatang: number,
  recurringExpenseSatang: number
): Omit<CapacityBreakdown, 'emergencyBufferSatang'> {
  if (confidence === 'low') {
    // ข้อมูลน้อยกว่า 7 วัน — เชื่อได้แค่รายการประจำที่ผู้ใช้ตั้งไว้เอง
    return {
      avgIncomeSatang: recurringIncomeSatang,
      recurringTotalSatang: recurringExpenseSatang,
      avgEssentialSatang: 0,
      avgExpenseSatang: recurringExpenseSatang,
    };
  }

  if (confidence === 'medium') {
    // 7–89 วัน — ยืดข้อมูลที่มีให้เป็นต่อเดือน
    const recordedIncome = sumRows(rows, (row) => row.type === 'income');
    const months = Math.ceil(daysOfData / 30);
    const avgIncomeSatang = recurringIncomeSatang > 0
      ? recurringIncomeSatang
      : roundHalfUpToSatang(recordedIncome / months);

    const scaleToMonth = (value: number) => roundHalfUpToSatang((value / daysOfData) * 30);
    return {
      avgIncomeSatang,
      recurringTotalSatang: recurringExpenseSatang,
      avgEssentialSatang: scaleToMonth(
        sumRows(
          rows,
          (row) =>
            row.type === 'expense' &&
            row.source !== 'recurring' &&
            row.categories?.is_essential === true
        )
      ),
      avgExpenseSatang: scaleToMonth(sumRows(rows, (row) => row.type === 'expense')),
    };
  }

  // ≥ 90 วัน — สูตรเต็มตาม S5.3 (ผลรวม 90 วัน ÷ 3)
  const perMonth = (value: number) => roundHalfUpToSatang(value / LOOKBACK_MONTHS);
  return {
    avgIncomeSatang: perMonth(sumRows(rows, (row) => row.type === 'income')),
    recurringTotalSatang: recurringExpenseSatang,
    avgEssentialSatang: perMonth(
      sumRows(
        rows,
        (row) =>
          row.type === 'expense' &&
          // ตัด recurring ออกเพื่อไม่ให้นับซ้ำกับ recurringTotal (S5.3 ตารางนิยาม)
          row.source !== 'recurring' &&
          row.categories?.is_essential === true
      )
    ),
    avgExpenseSatang: perMonth(sumRows(rows, (row) => row.type === 'expense')),
  };
}

/**
 * S5.3 — กำลังออมของผู้ใช้ ณ ตอนนี้
 *
 * disposable = avgIncome3M − recurringTotal − avgEssential − (avgExpense × 0.15)
 * capacity   = disposable × 0.8 − Σ monthly_save ของแผน active เดิม
 */
export async function getPlanCapacity(
  userId: string,
  todayIso: string = getTodayIso()
): Promise<PlanCapacity> {
  const rangeEnd = todayIso; // exclusive → ข้อมูลจบที่เมื่อวาน ตามนิยามช่วงของ S5.3
  const rangeStart = addDaysIso(todayIso, -LOOKBACK_DAYS);

  const [rows, firstDateRaw, recurring, activePlans] = await Promise.all([
    listPlanningRowsInRange(userId, rangeStart, rangeEnd),
    findFirstTransactionDate(userId),
    getMonthlyRecurringTotals(userId),
    listPlansByUser(userId, ['active']),
  ]);

  const yesterdayIso = addDaysIso(todayIso, -1);
  const firstIso = firstDateRaw ? firstDateRaw.slice(0, 10) : null;
  // ผู้ใช้ที่มีแต่รายการล่วงหน้า (occurred_at เป็นอนาคต) ยังถือว่าไม่มีข้อมูลย้อนหลัง
  const daysOfData =
    firstIso && firstIso <= yesterdayIso ? inclusiveDaysBetween(firstIso, yesterdayIso) : 0;

  const confidence = confidenceFor(daysOfData);
  const averages = estimateAverages(
    rows,
    daysOfData,
    confidence,
    recurring.incomeSatang,
    recurring.expenseSatang
  );

  const emergencyBufferSatang = roundHalfUpToSatang(averages.avgExpenseSatang * EMERGENCY_BUFFER);
  const disposableSatang =
    averages.avgIncomeSatang -
    averages.recurringTotalSatang -
    averages.avgEssentialSatang -
    emergencyBufferSatang;

  const committedSatang = activePlans.reduce((sum, plan) => sum + toSatang(plan.monthly_save), 0);
  const capacitySatang =
    roundHalfUpToSatang(disposableSatang * PLAN_SAFETY_RATIO) - committedSatang;

  const breakdown: CapacityBreakdown = { ...averages, emergencyBufferSatang };

  // ── เหตุผลที่สร้างแผนไม่ได้ ต้องเป็นตัวเลขจับต้องได้ ไม่ใช่ "ข้อมูลไม่พอ" ลอยๆ ──
  let reason: string | null = null;
  if (confidence === 'low' && recurring.incomeSatang <= 0) {
    // S5.5: ข้อมูล < 7 วันและไม่มีรายรับประจำ → ถามรายได้ประจำก่อน ยังไม่สร้างแผน
    reason = 'ยังไม่รู้รายได้ประจำของคุณ — ตั้งรายการประจำของรายรับก่อน แล้วค่อยวางแผนออม';
  } else if (activePlans.length >= MAX_ACTIVE_PLANS) {
    reason = `มีแผนที่กำลังออมอยู่ ${activePlans.length} แผนแล้ว (สูงสุด ${MAX_ACTIVE_PLANS}) — ปิดแผนเดิมก่อนจึงจะสร้างใหม่ได้`;
  } else if (capacitySatang <= 0) {
    reason =
      committedSatang > 0
        ? 'เงินที่ออมได้ถูกใช้กับแผนเดิมหมดแล้ว — ลดยอดออมของแผนเดิมหรือยืดเวลาออกไปก่อน'
        : 'รายรับหลังหักรายจ่ายจำเป็นยังไม่เหลือพอให้ออม — ลองลดรายจ่ายที่ไม่จำเป็นลงก่อน';
  }

  return {
    disposableSatang,
    capacitySatang,
    committedSatang,
    activePlanCount: activePlans.length,
    confidence,
    daysOfData,
    breakdown,
    canCreatePlan: reason === null,
    reason,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// S5.4 — สร้าง 3 ทางเลือก
// ────────────────────────────────────────────────────────────────────────────

export type PlanOptionKind = 'fast' | 'balanced' | 'relaxed';

export type PlanOption = {
  planId: string;
  kind: PlanOptionKind;
  title: string;
  emoji: string;
  targetSatang: number;
  monthlySaveSatang: number;
  months: number;
  targetDate: string;
  confidence: PlanConfidence;
};

export type CreatePlanResult = {
  options: PlanOption[];
  capacity: PlanCapacity;
  /** ผู้ใช้ระบุเวลามาแต่ทำไม่ได้ — S5.4 บังคับว่าต้องบอกตรงๆ ว่าเกินกำลังเท่าไหร่ */
  requestedMonthsNote: string | null;
};

const OPTION_META: Record<PlanOptionKind, { emoji: string; label: string }> = {
  fast: { emoji: '⚡', label: 'เร็ว' },
  balanced: { emoji: '⚖️', label: 'สมดุล' },
  relaxed: { emoji: '🌿', label: 'สบาย' },
};

/** จำนวนเดือนที่ต้องออมเพื่อให้ถึงเป้า — ปัดขึ้นเสมอ เพราะเดือนสุดท้ายที่ได้ไม่ครบก็ยังต้องออม */
function monthsToReach(targetSatang: number, monthlySaveSatang: number): number {
  return Math.ceil(targetSatang / monthlySaveSatang);
}

/**
 * S5.4 — สร้างชุดทางเลือกใหม่ (draft ทั้งหมด) พร้อมยกเลิก draft ชุดเก่า
 *
 * @param months ระยะเวลาที่ผู้ใช้ระบุ (ถ้ามี) — ใช้กับทางเลือก "เร็ว" เท่านั้น
 */
export async function createSavingPlan(
  userId: string,
  title: string,
  targetSatang: number,
  months?: number,
  todayIso: string = getTodayIso()
): Promise<CreatePlanResult> {
  if (!title.trim()) {
    throw new PlanError('ต้องตั้งชื่อเป้าหมายที่อยากออม', 400);
  }
  if (!Number.isInteger(targetSatang) || targetSatang <= 0) {
    throw new PlanError('ราคาเป้าหมายต้องมากกว่า 0 บาท (กฎ G3)', 400);
  }
  if (targetSatang > MAX_AMOUNT_SATANG) {
    throw new PlanError('ราคาเป้าหมายเกินเพดานที่ระบบรองรับ', 400);
  }
  if (months !== undefined && (!Number.isInteger(months) || months <= 0)) {
    throw new PlanError('จำนวนเดือนต้องเป็นจำนวนเต็มบวก', 400);
  }

  const capacity = await getPlanCapacity(userId, todayIso);
  if (!capacity.canCreatePlan) {
    throw new PlanError(capacity.reason ?? 'ยังสร้างแผนไม่ได้', 409);
  }

  // ── ทางเลือก "เร็ว": ถ้าผู้ใช้ระบุเวลาและทำไหว ให้ใช้ยอดตามเป้า ──────────────
  let requestedMonthsNote: string | null = null;
  let fastSave = capacity.capacitySatang;
  let fastLabel = OPTION_META.fast.label;

  if (months !== undefined) {
    const neededPerMonth = Math.ceil(targetSatang / months);
    if (neededPerMonth <= capacity.capacitySatang) {
      fastSave = neededPerMonth;
      fastLabel = 'ตามเป้า';
    } else {
      // S5.4 บังคับให้บอกตรงๆ ว่าเกินกำลัง แล้วยังเสนอ 3 ทางเลือกตามปกติต่อ
      requestedMonthsNote = `ภายใน ${months} เดือนต้องออมเดือนละ ${(neededPerMonth / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท ซึ่งเกินกำลังตอนนี้ (ออมได้สูงสุดเดือนละ ${(capacity.capacitySatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)`;
    }
  }

  const candidates: { kind: PlanOptionKind; save: number; label: string }[] = [
    { kind: 'fast', save: fastSave, label: fastLabel },
    { kind: 'balanced', save: capacity.capacitySatang * BALANCED_RATIO, label: OPTION_META.balanced.label },
    { kind: 'relaxed', save: capacity.capacitySatang * RELAXED_RATIO, label: OPTION_META.relaxed.label },
  ];

  const todayParts = parseIsoDate(todayIso);
  const drafts = candidates
    // S5.4: monthly_save ปัดลงเป็นหลักสิบบาท
    .map((candidate) => ({ ...candidate, save: roundDownToTenBaht(Math.floor(candidate.save)) }))
    // S5.4: ทางเลือกที่ได้ต่ำกว่า ฿100 ให้ซ่อน
    .filter((candidate) => candidate.save >= MIN_MONTHLY_SAVE_SATANG)
    .map((candidate) => {
      const planMonths = Math.min(monthsToReach(targetSatang, candidate.save), MAX_PLAN_MONTHS);
      return {
        kind: candidate.kind,
        months: planMonths,
        monthlySaveSatang: candidate.save,
        title: `${OPTION_META[candidate.kind].emoji} ${candidate.label} — ${title.trim()}`,
        targetDate: shiftMonthClampDay(todayIso, planMonths, todayParts.day),
      };
    });

  if (drafts.length === 0) {
    throw new PlanError(
      'ออมได้ไม่ถึงเดือนละ 100 บาท จึงยังไม่เสนอแผน — ลองลดรายจ่ายที่ไม่จำเป็นลงก่อน',
      409
    );
  }

  // ยกเลิกชุดเก่าก่อนเสมอ ไม่งั้นผู้ใช้จะเห็น draft ปนกันสองชุดแล้วกดยืนยันผิดใบ
  await cancelDraftPlans(userId);

  const inserted = await insertDraftPlans(
    userId,
    drafts.map((draft) => ({
      title: draft.title,
      targetSatang,
      targetDate: draft.targetDate,
      monthlySaveSatang: draft.monthlySaveSatang,
      confidence: capacity.confidence,
    }))
  );

  // จับคู่กลับด้วย monthly_save เพราะ Supabase ไม่รับประกันลำดับแถวที่คืนจาก insert หลายแถว
  const options: PlanOption[] = drafts.map((draft) => {
    const row = inserted.find(
      (candidate) => toSatang(candidate.monthly_save) === draft.monthlySaveSatang
    );
    return {
      planId: row?.id ?? '',
      kind: draft.kind,
      title: draft.title,
      emoji: OPTION_META[draft.kind].emoji,
      targetSatang,
      monthlySaveSatang: draft.monthlySaveSatang,
      months: draft.months,
      targetDate: draft.targetDate,
      confidence: capacity.confidence,
    };
  });

  return { options, capacity, requestedMonthsNote };
}

/**
 * S5.4 — ยืนยันแผน ต้องตรวจกฎ 1 และ 2 ซ้ำ ณ เวลาที่กด
 * เพราะระหว่างที่ผู้ใช้คิดอยู่ อาจมีรายจ่ายก้อนใหญ่เข้ามาจนออมไม่ไหวแล้ว
 */
export async function confirmPlan(userId: string, planId: string): Promise<PlanRow> {
  const plan = await findPlanOwnedByUser(userId, planId);
  if (!plan) {
    throw new PlanError('ไม่พบแผนนี้ในบัญชีของคุณ', 404);
  }
  if (plan.status !== 'draft') {
    throw new PlanError(`แผนนี้อยู่ในสถานะ "${plan.status}" แล้ว ยืนยันซ้ำไม่ได้`, 409);
  }

  const capacity = await getPlanCapacity(userId);
  const monthlySave = toSatang(plan.monthly_save);

  // กฎ 2: จำนวนแผน active ≤ 3
  if (capacity.activePlanCount >= MAX_ACTIVE_PLANS) {
    throw new PlanError(
      `มีแผนที่กำลังออมอยู่ ${capacity.activePlanCount} แผนแล้ว (สูงสุด ${MAX_ACTIVE_PLANS})`,
      409
    );
  }
  // กฎ 1: Σ monthly_save ของทุกแผน active รวมแผนใหม่ ≤ disposable × 0.8
  // capacitySatang หัก Σ แผนเดิมออกไปแล้ว จึงเทียบกับยอดของแผนใหม่ได้ตรงๆ
  if (monthlySave > capacity.capacitySatang) {
    throw new PlanError(
      'ตอนนี้ออมตามแผนนี้ไม่ไหวแล้ว เพราะรายรับ-รายจ่ายเปลี่ยนไปตั้งแต่ตอนสร้างแผน — ลองสร้างชุดใหม่',
      409
    );
  }

  const activated = await transitionPlanStatus(userId, planId, 'draft', 'active', true);
  if (!activated) {
    // แพ้การแข่งกับ request อื่นที่กดยืนยันแผนเดียวกันพร้อมกัน
    throw new PlanError('แผนนี้ถูกยืนยันไปแล้ว', 409);
  }
  return activated;
}

/** ยกเลิกแผน (draft หรือ active ก็ได้) */
export async function cancelPlan(userId: string, planId: string): Promise<PlanRow> {
  const plan = await findPlanOwnedByUser(userId, planId);
  if (!plan) {
    throw new PlanError('ไม่พบแผนนี้ในบัญชีของคุณ', 404);
  }
  if (plan.status === 'completed' || plan.status === 'cancelled') {
    throw new PlanError(`แผนนี้อยู่ในสถานะ "${plan.status}" แล้ว`, 409);
  }

  const cancelled = await transitionPlanStatus(userId, planId, plan.status, 'cancelled');
  if (!cancelled) {
    throw new PlanError('สถานะแผนเปลี่ยนไปแล้ว ลองโหลดหน้าใหม่', 409);
  }
  return cancelled;
}

// ────────────────────────────────────────────────────────────────────────────
// S5.6 — ติดตามความคืบหน้า
// ────────────────────────────────────────────────────────────────────────────

export type PlanProgress = {
  planId: string;
  title: string;
  status: PlanRow['status'];
  confidence: PlanConfidence;
  targetSatang: number;
  monthlySaveSatang: number;
  targetDate: string;
  /** ออมไปแล้วเท่าไหร่ (สตางค์) — คำนวณสดจาก transfer ทุกครั้ง ไม่เก็บยอดสะสม */
  savedSatang: number;
  /** เหลืออีกเท่าไหร่ถึงเป้า (สตางค์ ไม่ต่ำกว่า 0) */
  remainingSatang: number;
  percentComplete: number;
  /** เป้าสะสม ณ วันนี้ = monthly_save × (วันนับจาก confirmed_at ÷ 30) */
  expectedSatang: number;
  /** หลุดเป้าไหม (S5.6) — แผนที่ยังไม่ confirm หรือเพิ่งเริ่ม < 14 วัน ถือว่ายังไม่หลุด */
  offTrack: boolean;
  /** ครบเป้าแล้วไหม */
  reachedTarget: boolean;
  daysSinceStart: number;
};

/** คิดความคืบหน้าของแผนหนึ่งใบจากยอดโอนที่รวมมาแล้ว — ฟังก์ชันบริสุทธิ์ test ได้ตรงๆ */
export function computePlanProgress(
  plan: PlanRow,
  savedSatang: number,
  now: Date = new Date()
): PlanProgress {
  const targetSatang = toSatang(plan.target_amount);
  const monthlySaveSatang = toSatang(plan.monthly_save);

  const daysSinceStart = plan.confirmed_at
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(plan.confirmed_at)) / 86_400_000))
    : 0;

  // เป้าสะสมเดินต่อเนื่องตามวัน ไม่ใช่กระโดดทีละเดือน ไม่งั้นวันที่ 29 ของเดือนแรก
  // จะยังคาดหวัง 0 บาทอยู่ แล้ววันที่ 30 กระโดดเป็นเต็มเดือนทันที
  const expectedSatang = plan.confirmed_at
    ? roundHalfUpToSatang((monthlySaveSatang * daysSinceStart) / 30)
    : 0;

  const reachedTarget = savedSatang >= targetSatang;

  return {
    planId: plan.id,
    title: plan.title,
    status: plan.status,
    confidence: plan.confidence,
    targetSatang,
    monthlySaveSatang,
    targetDate: plan.target_date,
    savedSatang,
    remainingSatang: Math.max(0, targetSatang - savedSatang),
    percentComplete:
      targetSatang > 0 ? Math.round((savedSatang / targetSatang) * 1000) / 10 : 0,
    expectedSatang,
    offTrack:
      plan.status === 'active' &&
      daysSinceStart >= OFF_TRACK_MIN_DAYS &&
      !reachedTarget &&
      savedSatang < expectedSatang * OFF_TRACK_RATIO,
    reachedTarget,
    daysSinceStart,
  };
}

/** แผนทั้งหมดของผู้ใช้ที่ยังมีความหมาย (draft + active + completed) พร้อมความคืบหน้า */
export async function listPlansWithProgress(userId: string): Promise<PlanProgress[]> {
  const [plans, transfers] = await Promise.all([
    listPlansByUser(userId, ['draft', 'active', 'completed']),
    listPlanTransferRows(userId),
  ]);

  const savedByPlan = new Map<string, number>();
  for (const row of transfers) {
    savedByPlan.set(row.plan_id, (savedByPlan.get(row.plan_id) ?? 0) + toSatang(row.amount));
  }

  return plans.map((plan) => computePlanProgress(plan, savedByPlan.get(plan.id) ?? 0));
}

/**
 * S5.6 — แผนที่ออมครบเป้าแล้วให้เปลี่ยนเป็น completed
 * แยกออกมาเป็นฟังก์ชันเพราะต้องเรียกได้ทั้งจาก job (planCheck) และตอนผู้ใช้เปิดหน้าแผน
 */
export async function completeReachedPlans(userId: string): Promise<string[]> {
  const progress = await listPlansWithProgress(userId);
  const completed: string[] = [];

  for (const plan of progress) {
    if (plan.status !== 'active' || !plan.reachedTarget) continue;
    const row = await transitionPlanStatus(userId, plan.planId, 'active', 'completed');
    if (row) completed.push(plan.planId);
  }

  return completed;
}

// ────────────────────────────────────────────────────────────────────────────
// โอนเงินเข้าแผน — ตัวที่ทำให้ความคืบหน้าของแผนขยับจริง (S5.6)
// ────────────────────────────────────────────────────────────────────────────

export type PlanTransferResult = {
  transactionId: string;
  progress: PlanProgress;
  /** รายการนี้ทำให้แผนครบเป้าพอดี — ผู้เรียกควรแสดงความยินดี */
  justCompleted: boolean;
};

/**
 * โอนเงินเข้าแผนออม
 *
 * ⚖️ G7: บันทึกเป็น type='transfer' ผูก plan_id — ไม่ถูกนับเป็นรายรับหรือรายจ่าย
 * ในทุกยอดสรุป ตาราง transactions มี CHECK บังคับไว้อีกชั้นว่า plan_id ใส่ได้
 * เฉพาะ transfer เท่านั้น
 *
 * โอนได้เฉพาะแผนที่ active: แผน draft ยังไม่ได้ยืนยัน ส่วนแผนที่ completed/cancelled
 * ปิดไปแล้ว การโอนเข้าจะทำให้ยอดเกินเป้าโดยไม่มีความหมาย
 */
export async function transferToPlan(
  userId: string,
  planId: string,
  amountSatang: number,
  occurredAt: Date = new Date()
): Promise<PlanTransferResult> {
  if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
    throw new PlanError('จำนวนเงินที่โอนต้องมากกว่า 0 บาท (กฎ G3)', 400);
  }
  if (amountSatang > MAX_AMOUNT_SATANG) {
    throw new PlanError('จำนวนเงินเกินเพดานที่ระบบรองรับ', 400);
  }

  const plan = await findPlanOwnedByUser(userId, planId);
  if (!plan) {
    throw new PlanError('ไม่พบแผนนี้ในบัญชีของคุณ', 404);
  }
  if (plan.status !== 'active') {
    throw new PlanError(
      plan.status === 'draft'
        ? 'ต้องกดยืนยันแผนนี้ก่อนจึงจะโอนเงินเข้าได้'
        : `แผนนี้ปิดไปแล้ว (${plan.status}) โอนเงินเข้าไม่ได้`,
      409
    );
  }

  const created = await createTransaction({
    userId,
    type: 'transfer',
    amountSatang,
    occurredAt,
    source: 'liff',
    parsedBy: 'manual',
    note: `โอนเข้าแผน ${plan.title}`,
    planId,
  });

  // อ่านยอดสะสมใหม่จาก DB ไม่ใช่บวกเอาเองจากยอดเดิม — รายการอาจถูกโอนจากอีกหน้าต่าง
  // พร้อมกัน หรือถูกลบไประหว่างนั้น ยอดที่บวกเองจะเพี้ยนทันที (กติการ่วม §S5)
  const transfers = await listPlanTransferRows(userId);
  const savedSatang = transfers
    .filter((row) => row.plan_id === planId)
    .reduce((sum, row) => sum + toSatang(row.amount), 0);

  const progress = computePlanProgress(plan, savedSatang);

  let justCompleted = false;
  if (progress.reachedTarget) {
    // ปิดแผนทันทีไม่ต้องรอ job รอบถัดไป — บังคับสถานะเดิมเป็น active อยู่แล้ว
    // ถ้าแพ้การแข่งกับ job ที่ปิดไปก่อน จะได้ไม่นับว่าเพิ่งครบเป้าซ้ำ
    const closed = await transitionPlanStatus(userId, planId, 'active', 'completed');
    justCompleted = closed !== null;
  }

  return {
    transactionId: created.id,
    progress: { ...progress, status: justCompleted ? 'completed' : progress.status },
    justCompleted,
  };
}
