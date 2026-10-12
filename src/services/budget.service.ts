// ไฟล์นี้ทำหน้าที่อะไร: คำนวณสถานะงบรายหมวด และตัดสินใจว่าถึงเวลาเตือน 80%/100% หรือยัง
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S5.8 งบรายหมวด (อยู่ใต้ §S5 Money Engine 🔴 ห้ามมี AI)
// ⚖️ กฎเหล็ก G1, G3, G6, G7
//
// G1 — ทุกตัวเลขที่นี่มาจากสูตรตรงๆ ข้อมูลเดิมเข้า ต้องได้ผลเดิมออกเสมอ ไม่มี AI แตะ
// G3 — ทุกยอดในไฟล์นี้เป็น "สตางค์" (integer) ค่าจาก DB เป็น numeric string จึงต้องผ่าน
//      toSatang() ก่อนทุกครั้ง ส่วนตอนเขียนกลับลง DB ต้องผ่าน fromSatang() (คอลัมน์เป็นบาท)
// G7 — ยอดใช้ของหมวดนับเฉพาะ type='expense' เท่านั้น transfer ไม่นับ (และ income ไม่เกี่ยว)
//
// ⚠️ ไม่มีคอลัมน์ "ใช้ไปแล้วเท่าไหร่" เก็บไว้ในตาราง budgets โดยตั้งใจ — ยอดใช้คำนวณสด
// จาก transactions ทุกครั้ง ตามกติการ่วมของ §S5 ("ห้ามบวกเพิ่มทีละครั้ง") เพราะถ้าเก็บยอด
// สะสมไว้ การลบ/แก้/กู้คืนรายการจะทำให้ยอดเพี้ยนแบบที่ไม่มีใครรู้ตัว

import { formatBaht, fromSatang, toSatang } from '../utils/money';
import { getMonthStartIso, shiftMonthStartIso } from '../utils/thaiDate';
import { MAX_AMOUNT_SATANG } from '../config/constants';
import {
  claimBudgetAlert,
  deleteBudget,
  findBudget,
  insertCarriedBudgets,
  listBudgetHistoryUpTo,
  listBudgetsByMonth,
  markBudgetCleared,
  upsertBudget,
} from '../db/queries/budgets';
import { findCategoryOwnedByUser } from '../db/queries/categories';
import { listTransactionRowsInRange } from '../db/queries/summary';

/** เกณฑ์เตือนตาม S5.8 — เตือนระดับละครั้งเดียวต่อเดือน */
export const WARNING_PERCENT = 80;
export const OVER_PERCENT = 100;

/** สถานะสีของแถบงบ: ปกติ / ใกล้เต็ม / เกินแล้ว */
export type BudgetLevel = 'ok' | 'warning' | 'over';

export type BudgetStatus = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  emoji: string | null;
  /** เพดานงบเดือนนี้ (สตางค์) */
  limitSatang: number;
  /** ใช้ไปแล้วเดือนนี้ (สตางค์) — คำนวณสดจาก transactions */
  spentSatang: number;
  /** เหลืออีกเท่าไหร่ (สตางค์) ติดลบได้ถ้าใช้เกิน */
  remainingSatang: number;
  /** สัดส่วนที่ใช้ไป หน่วยเปอร์เซ็นต์ ปัดทศนิยม 1 ตำแหน่ง */
  percentUsed: number;
  level: BudgetLevel;
  alerted80: boolean;
  alerted100: boolean;
};

export type BudgetOverview = {
  /** เดือนที่คิด ในรูป `YYYY-MM-01` (เวลาไทย) */
  month: string;
  items: BudgetStatus[];
  /** ผลรวมเพดานงบของทุกหมวดที่ตั้งไว้ (สตางค์) */
  totalLimitSatang: number;
  /**
   * ผลรวมยอดใช้ "เฉพาะหมวดที่ตั้งงบไว้" (สตางค์)
   * ตั้งใจไม่รวมหมวดที่ไม่ได้ตั้งงบ เพราะการ์ด "งบประมาณรายเดือน" เอาสองยอดนี้มาหารกัน
   * ถ้าเอายอดใช้ทั้งเดือนมาหารด้วยเพดานของบางหมวด เปอร์เซ็นต์จะทะลุ 100% ทั้งที่ยังไม่เกินงบ
   */
  totalSpentSatang: number;
};

export type BudgetAlert = {
  categoryId: string;
  categoryName: string;
  emoji: string | null;
  limitSatang: number;
  spentSatang: number;
  percentUsed: number;
  /** ระดับที่เพิ่งข้ามในรายการนี้ */
  threshold: typeof WARNING_PERCENT | typeof OVER_PERCENT;
};

/** error ที่ route เอาไปแปลงเป็น HTTP 400/404 ได้ โดยไม่ต้องเดาจากข้อความ */
export class BudgetError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404
  ) {
    super(message);
    this.name = 'BudgetError';
  }
}

/**
 * สัดส่วนที่ใช้ไป สำหรับ "แสดงผล" — ปัดทศนิยม 1 ตำแหน่งให้พออ่าน แต่ไม่หยาบจนเพี้ยน
 *
 * ⚠️ ห้ามเอาค่านี้ไปเทียบกับเกณฑ์เตือน ใช้ reachedThreshold() แทน — ดูเหตุผลที่นั่น
 */
function percentOf(spentSatang: number, limitSatang: number): number {
  if (limitSatang <= 0) return 0;
  return Math.round((spentSatang / limitSatang) * 1000) / 10;
}

/**
 * ถึงเกณฑ์ (80% / 100%) แล้วหรือยัง — เทียบด้วยจำนวนเต็มสตางค์ ไม่ผ่านการปัดใดๆ
 *
 * 🔴 แก้บั๊ก: เดิมเทียบจากค่าที่ percentOf() ปัดมาแล้ว ทำให้ยอด 79.99966% ถูกปัดขึ้นเป็น 80.0
 * แล้วยิงเตือน "ใช้งบไป 80%" ทั้งที่ยังไม่ถึง — เตือนผิดครั้งเดียวก็เผาสิทธิ์เตือนของเดือนนั้นทิ้ง
 * เพราะ S5.8 ให้เตือนระดับละครั้งเดียว ผู้ใช้จึงจะไม่ได้รับเตือนตอนถึง 80% จริงอีกเลย
 *
 * คูณไขว้แทนการหาร: ทั้งสองฝั่งเป็นจำนวนเต็ม จึงไม่มีเศษทศนิยมให้คลาดเคลื่อน
 */
function reachedThreshold(spentSatang: number, limitSatang: number, percent: number): boolean {
  return spentSatang * 100 >= limitSatang * percent;
}

function levelOf(spentSatang: number, limitSatang: number): BudgetLevel {
  if (reachedThreshold(spentSatang, limitSatang, OVER_PERCENT)) return 'over';
  if (reachedThreshold(spentSatang, limitSatang, WARNING_PERCENT)) return 'warning';
  return 'ok';
}

/**
 * ยอดรายจ่ายของแต่ละหมวดในเดือนที่ระบุ (สตางค์)
 * ⚖️ G7: นับเฉพาะ type='expense' — transfer (เช่น โอนเข้าแผนออม) ไม่ใช่รายจ่าย
 */
async function spentByCategoryInMonth(
  userId: string,
  monthIso: string
): Promise<Map<string, number>> {
  const rows = await listTransactionRowsInRange(
    userId,
    monthIso,
    shiftMonthStartIso(monthIso, 1)
  );

  const spent = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== 'expense') continue;
    if (!row.category_id) continue; // รายการที่ไม่ระบุหมวด ไม่เข้างบหมวดไหนเลย
    spent.set(row.category_id, (spent.get(row.category_id) ?? 0) + toSatang(row.amount));
  }
  return spent;
}

/**
 * ยกงบล่าสุดของแต่ละหมวดมาเป็นงบของเดือนนี้ — ตั้งครั้งเดียวใช้ทุกเดือนจนกว่าจะแก้หรือยกเลิก
 *
 * 🔴 ทำไมต้องมี: งบเก็บเป็นรายเดือน ผู้ใช้ทดสอบตั้งงบไว้ พอขึ้นเดือนใหม่ทุกหมวดกลายเป็น
 * "ยังไม่ตั้งงบ" แต่คลิกเข้าไปยังเห็นยอดใช้อยู่ — งงว่าข้อมูลหายหรือเปล่า
 *
 * กติกา:
 *   • หมวดที่มีแถวของเดือนนี้แล้ว (รวมแถวยกเลิก = 0) ไม่แตะ
 *   • ไม่งั้นหยิบแถวล่าสุดก่อนหน้า ถ้าเป็น 0 (ผู้ใช้ยกเลิกไว้) ไม่ยก
 *   • คัดลอกเป็นแถวจริงของเดือนนี้ ธงเตือน 80/100% จึงเริ่มนับใหม่ทุกเดือนตาม S5.8
 *   • ไม่ยกไปเดือนอนาคต — ยังไม่มีใครใช้ และผู้ใช้อาจแก้งบก่อนถึงเดือนนั้น
 *
 * ⚖️ G4 แนวเดียวกัน: ยกงบไม่สำเร็จต้องไม่ทำให้หน้างบหรือการบันทึกรายการพัง แค่ไม่มีงบให้เห็น
 */
async function carryOverBudgets(userId: string, monthIso: string): Promise<void> {
  if (monthIso > getMonthStartIso()) return;

  try {
    const history = await listBudgetHistoryUpTo(userId, monthIso);

    const latestByCategory = new Map<string, (typeof history)[number]>();
    for (const row of history) {
      if (!latestByCategory.has(row.category_id)) latestByCategory.set(row.category_id, row);
    }

    const toCarry = [...latestByCategory.values()]
      .filter((row) => row.month < monthIso)
      .filter((row) => toSatang(row.limit_amount) > 0)
      // หมวดที่ถูกเปลี่ยนเป็นรายรับภายหลังไม่ยกต่อ — ตั้งงบได้เฉพาะรายจ่าย
      .filter((row) => row.categories?.type === 'expense')
      .map((row) => ({ categoryId: row.category_id, limitBaht: row.limit_amount }));

    await insertCarriedBudgets(userId, monthIso, toCarry);
  } catch (err) {
    console.error('[budget] ยกงบไปเดือนใหม่ไม่สำเร็จ:', err);
  }
}

/** งบทุกหมวดของผู้ใช้พร้อมยอดใช้จริงในเดือนนั้น เรียงหมวดที่ใช้ไปเยอะที่สุดขึ้นก่อน */
export async function getBudgetOverview(
  userId: string,
  monthIso: string = getMonthStartIso()
): Promise<BudgetOverview> {
  await carryOverBudgets(userId, monthIso);
  const [budgets, spent] = await Promise.all([
    listBudgetsByMonth(userId, monthIso),
    spentByCategoryInMonth(userId, monthIso),
  ]);

  const items: BudgetStatus[] = budgets
    .map((budget) => {
      const limitSatang = toSatang(budget.limit_amount);
      const spentSatang = spent.get(budget.category_id) ?? 0;
      const percentUsed = percentOf(spentSatang, limitSatang);
      return {
        budgetId: budget.id,
        categoryId: budget.category_id,
        categoryName: budget.categories?.name ?? 'ไม่ระบุหมวด',
        emoji: budget.categories?.emoji ?? null,
        limitSatang,
        spentSatang,
        remainingSatang: limitSatang - spentSatang,
        percentUsed,
        level: levelOf(spentSatang, limitSatang),
        alerted80: budget.alerted_80,
        alerted100: budget.alerted_100,
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed);

  return {
    month: monthIso,
    items,
    totalLimitSatang: items.reduce((sum, item) => sum + item.limitSatang, 0),
    totalSpentSatang: items.reduce((sum, item) => sum + item.spentSatang, 0),
  };
}

/**
 * ตั้ง/แก้งบของหมวดหนึ่งในเดือนหนึ่ง แล้วคืนสถานะล่าสุดกลับไปเลย
 * ผู้เรียกส่ง `limitSatang` เป็นสตางค์เสมอ (G3) — การแปลงเป็นบาทเกิดที่นี่ที่เดียว
 */
export async function setBudget(
  userId: string,
  categoryId: string,
  limitSatang: number,
  monthIso: string = getMonthStartIso()
): Promise<BudgetStatus> {
  if (!Number.isInteger(limitSatang) || limitSatang <= 0) {
    throw new BudgetError('งบต้องเป็นจำนวนเงินที่มากกว่า 0 บาท', 400);
  }
  if (limitSatang > MAX_AMOUNT_SATANG) {
    throw new BudgetError('งบเกินเพดานที่ระบบรองรับ', 400);
  }

  // ⚖️ G6: ห้ามเชื่อ categoryId ที่มาจาก request ต้องยืนยันว่าเป็นหมวดของผู้ใช้คนนี้จริง
  const category = await findCategoryOwnedByUser(userId, categoryId);
  if (!category) {
    throw new BudgetError('ไม่พบหมวดหมู่นี้ในบัญชีของคุณ', 404);
  }
  if (category.type !== 'expense') {
    throw new BudgetError('ตั้งงบได้เฉพาะหมวดรายจ่ายเท่านั้น', 400);
  }

  const budget = await upsertBudget(userId, categoryId, monthIso, fromSatang(limitSatang));
  const spent = await spentByCategoryInMonth(userId, monthIso);
  const spentSatang = spent.get(categoryId) ?? 0;
  const percentUsed = percentOf(spentSatang, limitSatang);

  return {
    budgetId: budget.id,
    categoryId,
    categoryName: category.name,
    emoji: category.emoji,
    limitSatang,
    spentSatang,
    remainingSatang: limitSatang - spentSatang,
    percentUsed,
    level: levelOf(spentSatang, limitSatang),
    alerted80: budget.alerted_80,
    alerted100: budget.alerted_100,
  };
}

/**
 * ยกเลิกงบของหมวดหนึ่งตั้งแต่เดือนนี้ คืน true ถ้ามีงบให้ยกเลิกจริง
 *
 * เก็บเป็นแถว 0 แทนการลบ ไม่งั้นงบของเดือนก่อนจะถูกยกกลับมาใหม่ (ดู carryOverBudgets)
 */
export async function removeBudget(
  userId: string,
  categoryId: string,
  monthIso: string = getMonthStartIso()
): Promise<boolean> {
  await carryOverBudgets(userId, monthIso);
  const existing = await findBudget(userId, categoryId, monthIso);
  const hadBudget = existing !== null && toSatang(existing.limit_amount) > 0;
  if (!hadBudget) return false;

  try {
    await markBudgetCleared(userId, categoryId, monthIso);
  } catch (err) {
    // 23514 = check_violation — ยังไม่ได้รัน 003_budget_carry_over.sql ที่อนุญาตให้ limit = 0
    // ถอยไปลบแถวแบบเดิม ปุ่มยังใช้ได้ แค่งบอาจถูกยกกลับมาในเดือนถัดไป
    if ((err as { code?: string } | null)?.code !== '23514') throw err;
    console.warn('[budget] ยังไม่ได้รัน migration 003 — ยกเลิกงบด้วยการลบแถวแทน');
    await deleteBudget(userId, categoryId, monthIso);
  }
  return true;
}

/**
 * งบของหมวดในเดือนนั้น — ถ้ายังไม่มีแถว ลองยกงบล่าสุดมาก่อนแล้วอ่านใหม่
 *
 * รายการแรกของเดือนใหม่มักมาจากแชท ก่อนผู้ใช้เปิดหน้าเว็บ ถ้าไม่ยกงบตรงนี้
 * การเตือน 80/100% และแถบงบบนการ์ดจะหายไปจนกว่าจะมีคนเปิดหน้างบ
 */
async function findBudgetCarryingOver(userId: string, categoryId: string, monthIso: string) {
  const budget = await findBudget(userId, categoryId, monthIso);
  if (budget) return budget;
  await carryOverBudgets(userId, monthIso);
  return findBudget(userId, categoryId, monthIso);
}

/**
 * S5.8 — เรียกหลังบันทึกรายจ่ายสำเร็จ เพื่อดูว่ารายการนี้ทำให้ข้ามเกณฑ์เตือนหรือเปล่า
 *
 * คืน null เมื่อ: หมวดนี้ไม่ได้ตั้งงบ / ยังไม่ถึงเกณฑ์ / เตือนระดับนั้นไปแล้วในเดือนนี้
 * คืนค่าเมื่อ: เพิ่งข้ามเกณฑ์ในรายการนี้ — ผู้เรียกเอาไปแนบท้าย reply (ฟรี) หรือ push
 *
 * ใช้เดือนของ occurredAt ไม่ใช่เดือนปัจจุบัน เพราะผู้ใช้ย้อนบันทึกรายการของเดือนก่อนได้
 * ตอนนั้นงบที่ต้องเช็คคืองบของเดือนนั้น ไม่ใช่เดือนนี้
 */
/**
 * สถานะงบของหมวดหนึ่ง ณ ตอนนี้ — อ่านอย่างเดียว ไม่แตะสิทธิ์เตือน
 *
 * ต่างจาก evaluateBudgetAlert() ตรงที่อันนั้นคืนค่า "เฉพาะตอนเพิ่งข้ามเกณฑ์ 80/100%"
 * และ **เขียน DB เพื่อจองสิทธิ์เตือน** ด้วย เอามาวาดแถบความคืบหน้าทุกครั้งไม่ได้
 * เพราะจะเผาสิทธิ์เตือนของทั้งเดือนทิ้งตั้งแต่รายการแรก
 *
 * ฟังก์ชันนี้มีไว้ให้การ์ด "บันทึกแล้ว" โชว์แถบงบได้ทุกครั้งที่บันทึก
 * คืน null เมื่อหมวดนี้ยังไม่ได้ตั้งงบเดือนนั้น ซึ่งเป็นเรื่องปกติ ไม่ใช่ error
 */
export async function getCategoryBudgetStatus(
  userId: string,
  categoryId: string,
  occurredAt: Date = new Date()
): Promise<BudgetStatus | null> {
  const monthIso = getMonthStartIso(occurredAt);

  const budget = await findBudgetCarryingOver(userId, categoryId, monthIso);
  if (!budget) return null;

  const limitSatang = toSatang(budget.limit_amount);
  if (limitSatang <= 0) return null;

  const category = await findCategoryOwnedByUser(userId, categoryId);
  const spent = await spentByCategoryInMonth(userId, monthIso);
  const spentSatang = spent.get(categoryId) ?? 0;

  return {
    budgetId: budget.id,
    categoryId,
    categoryName: category?.name ?? 'ไม่ระบุหมวด',
    emoji: category?.emoji ?? null,
    limitSatang,
    spentSatang,
    remainingSatang: limitSatang - spentSatang,
    percentUsed: percentOf(spentSatang, limitSatang),
    level: levelOf(spentSatang, limitSatang),
    alerted80: budget.alerted_80,
    alerted100: budget.alerted_100,
  };
}

export async function evaluateBudgetAlert(
  userId: string,
  categoryId: string,
  occurredAt: Date = new Date()
): Promise<BudgetAlert | null> {
  const monthIso = getMonthStartIso(occurredAt);

  const budget = await findBudgetCarryingOver(userId, categoryId, monthIso);
  if (!budget) return null;

  const limitSatang = toSatang(budget.limit_amount);
  if (limitSatang <= 0) return null;

  const spent = await spentByCategoryInMonth(userId, monthIso);
  const spentSatang = spent.get(categoryId) ?? 0;
  const percentUsed = percentOf(spentSatang, limitSatang);

  // เช็ค 100 ก่อน 80 เสมอ: ถ้ารายการเดียวพุ่งจาก 0% ไป 120% ต้องเตือนว่า "เกินงบแล้ว"
  // ไม่ใช่ "ใกล้เต็มงบ" ซึ่งเบากว่าความจริง
  const threshold = reachedThreshold(spentSatang, limitSatang, OVER_PERCENT)
    ? OVER_PERCENT
    : reachedThreshold(spentSatang, limitSatang, WARNING_PERCENT)
      ? WARNING_PERCENT
      : null;
  if (threshold === null) return null;

  const alreadyAlerted = threshold === OVER_PERCENT ? budget.alerted_100 : budget.alerted_80;
  if (alreadyAlerted) return null;

  // จองสิทธิ์เตือนกับ DB ก่อน — ถ้าอีก request ชิงไปได้ก่อน เราจะไม่เตือนซ้ำ
  const claimed = await claimBudgetAlert(userId, budget.id, threshold);
  if (!claimed) return null;

  const category = await findCategoryOwnedByUser(userId, categoryId);

  return {
    categoryId,
    categoryName: category?.name ?? 'หมวดนี้',
    emoji: category?.emoji ?? null,
    limitSatang,
    spentSatang,
    percentUsed,
    threshold,
  };
}

/** ข้อความเตือนสำหรับแนบท้าย reply ในแชท (S5.8) */
export function formatBudgetAlert(alert: BudgetAlert): string {
  const icon = alert.emoji ?? '📊';
  const head = alert.threshold === OVER_PERCENT
    ? `⚠️ ใช้เกินงบหมวด ${icon} ${alert.categoryName} แล้ว`
    : `🔔 ใช้งบหมวด ${icon} ${alert.categoryName} ไปแล้ว ${alert.percentUsed}%`;
  return `${head}\n${formatBaht(alert.spentSatang)} จากงบ ${formatBaht(alert.limitSatang)}`;
}
