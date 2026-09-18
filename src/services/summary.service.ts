// ไฟล์นี้ทำหน้าที่อะไร: รวมยอดรายรับ-รายจ่ายจากรายการดิบ ให้ตัวเลขทุกตัวที่หน้า LIFF ต้องใช้
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G1, G3, G7
//
// G1 — ที่นี่คือที่ที่การบวกลบเกิดขึ้น ไม่ใช่ที่ AI และไม่ใช่ที่ route
// G3 — ทุกตัวเลขในไฟล์นี้เป็น "สตางค์" (integer) ค่าที่อ่านจาก DB เป็น numeric string
//      จึงต้องผ่าน money.toSatang() ก่อนบวกทุกครั้ง ห้ามใช้ Number() ตรงๆ
// G7 — type='transfer' ไม่นับเป็นทั้งรายรับและรายจ่าย ตัดออกจากทุกยอดรวม

import { add, roundDownToSatang, toSatang } from '../utils/money';
import {
  daysInMonth,
  formatThaiMonthLabel,
  getMonthStartIso,
  getMonthStartIsoAgo,
  getTodayIso,
  parseIsoDate,
  shiftMonthStartIso,
} from '../utils/thaiDate';
import {
  listAllTransactionRows,
  listTransactionRowsInRange,
  type SummaryRow,
} from '../db/queries/summary';
import { listCategoriesByUser } from '../db/queries/categories';
import { listPlansByUser } from '../db/queries/plans';
import { sumUpcomingRecurringInMonth } from './recurring.service';

/** จำนวนเดือนที่แสดงในกราฟกระแสเงินสด */
const TREND_MONTHS = 6;

export type CategoryAmount = {
  categoryId: string | null;
  name: string;
  amountSatang: number;
};

export type MonthlyPoint = {
  month: string; // "2026-09"
  label: string; // "ก.ย."
  incomeSatang: number;
  expenseSatang: number;
};

export type UserSummary = {
  /** ยอดรายรับเดือนนี้ (สตางค์) */
  monthIncomeSatang: number;
  /** ยอดรายจ่ายเดือนนี้ (สตางค์) */
  monthExpenseSatang: number;
  /** ยอดคงเหลือสะสมทั้งหมด = รายรับทั้งหมด - รายจ่ายทั้งหมด (สตางค์ ติดลบได้) */
  netBalanceSatang: number;
  /** จำนวนรายการทั้งหมดที่ยังไม่ถูกลบ ใช้บอกว่าผู้ใช้เพิ่งเริ่มหรือใช้มานานแล้ว */
  transactionCount: number;
  /** รายจ่ายเดือนนี้แยกตามหมวด เรียงมากไปน้อย */
  expenseByCategory: CategoryAmount[];
  /** ยอดรายเดือนย้อนหลัง 6 เดือนรวมเดือนปัจจุบัน เรียงเก่าไปใหม่ */
  monthlyTrend: MonthlyPoint[];
};

/** บวกยอดของ type ที่ต้องการ โดยแปลง numeric string เป็นสตางค์ก่อนเสมอ (G3) */
function sumByType(rows: SummaryRow[], type: 'income' | 'expense'): number {
  const amounts = rows
    .filter((row) => row.type === type)
    .map((row) => toSatang(row.amount));
  return add(...amounts);
}

/** เดือนของรายการหนึ่งตามเวลาไทย ในรูป "YYYY-MM" */
function monthKeyOf(row: SummaryRow): string {
  return getMonthStartIso(new Date(row.occurred_at)).slice(0, 7);
}

export async function getUserSummary(userId: string): Promise<UserSummary> {
  const trendStart = getMonthStartIsoAgo(TREND_MONTHS - 1);
  const monthStart = getMonthStartIso();
  const nextMonthStart = getMonthStartIsoAgo(-1);

  const [allRows, trendRows, categories] = await Promise.all([
    listAllTransactionRows(userId),
    listTransactionRowsInRange(userId, trendStart, nextMonthStart),
    listCategoriesByUser(userId),
  ]);

  const monthRows = trendRows.filter((row) => monthKeyOf(row) === monthStart.slice(0, 7));

  // ── ยอดคงเหลือสะสม (G7: transfer ไม่นับทั้งสองฝั่ง) ────────────────────────
  const netBalanceSatang = sumByType(allRows, 'income') - sumByType(allRows, 'expense');

  // ── รายจ่ายเดือนนี้แยกตามหมวด ───────────────────────────────────────────────
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const byCategory = new Map<string | null, number>();

  for (const row of monthRows) {
    if (row.type !== 'expense') continue;
    const current = byCategory.get(row.category_id) ?? 0;
    byCategory.set(row.category_id, current + toSatang(row.amount));
  }

  const expenseByCategory: CategoryAmount[] = [...byCategory.entries()]
    .map(([categoryId, amountSatang]) => ({
      categoryId,
      name: (categoryId && categoryNameById.get(categoryId)) || 'ไม่ระบุหมวด',
      amountSatang,
    }))
    .sort((a, b) => b.amountSatang - a.amountSatang);

  // ── กราฟย้อนหลัง 6 เดือน ────────────────────────────────────────────────────
  // สร้างช่องของทุกเดือนไว้ก่อนแล้วค่อยเติม เพื่อให้เดือนที่ไม่มีรายการเลยยังมีจุด 0
  // ไม่ใช่หายไปจากกราฟจนแกนเวลาเพี้ยน
  const trendByMonth = new Map<string, MonthlyPoint>();
  for (let index = TREND_MONTHS - 1; index >= 0; index -= 1) {
    const month = getMonthStartIsoAgo(index).slice(0, 7);
    trendByMonth.set(month, {
      month,
      label: formatThaiMonthLabel(month),
      incomeSatang: 0,
      expenseSatang: 0,
    });
  }

  for (const row of trendRows) {
    const point = trendByMonth.get(monthKeyOf(row));
    if (!point) continue;
    if (row.type === 'income') point.incomeSatang += toSatang(row.amount);
    if (row.type === 'expense') point.expenseSatang += toSatang(row.amount);
  }

  return {
    monthIncomeSatang: sumByType(monthRows, 'income'),
    monthExpenseSatang: sumByType(monthRows, 'expense'),
    netBalanceSatang,
    transactionCount: allRows.length,
    expenseByCategory,
    monthlyTrend: [...trendByMonth.values()],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// S5.2 — ใช้ได้วันละเท่าไหร่ (Safe-to-spend)
//
//   คงเหลือเดือนนี้ = รายรับเดือนนี้
//                   + recurring รายรับที่ยังไม่ถึงรอบ (วันนี้ถึงสิ้นเดือน)
//                   − รายจ่ายเดือนนี้
//                   − recurring รายจ่ายที่ยังไม่ถึงรอบ
//                   − Σ monthly_save ของแผน active
//   ใช้ได้ต่อวัน = คงเหลือเดือนนี้ ÷ วันที่เหลือในเดือน (ปัดลง)
//
// 🔴 ห้ามมี AI — ทุกตัวเลขมาจากสูตรตรงๆ
// ⚖️ G7: หัก monthly_save ได้ตรงๆ โดยไม่นับซ้ำ เพราะการโอนเข้าแผนเป็น transfer
//        ซึ่งไม่ถูกนับเป็นรายจ่ายอยู่แล้ว
// ────────────────────────────────────────────────────────────────────────────

export type SafeToSpend = {
  /** เงินที่เหลือใช้ได้ทั้งเดือนหลังหักทุกอย่างแล้ว (สตางค์ ติดลบได้) */
  monthRemainingSatang: number;
  /** ใช้ได้วันละเท่าไหร่ (สตางค์ ปัดลง) — 0 ถ้าคงเหลือติดลบ */
  perDaySatang: number;
  /** จำนวนวันที่เหลือในเดือน นับวันนี้ด้วย */
  daysLeft: number;
  /** ใช้เกินไปแล้วเท่าไหร่ (สตางค์ บวกเสมอ) — 0 ถ้ายังไม่เกิน */
  overspentSatang: number;
  breakdown: {
    monthIncomeSatang: number;
    upcomingIncomeSatang: number;
    monthExpenseSatang: number;
    upcomingExpenseSatang: number;
    planCommitmentSatang: number;
  };
};

export async function getSafeToSpend(
  userId: string,
  todayIso: string = getTodayIso()
): Promise<SafeToSpend> {
  const monthStart = `${todayIso.slice(0, 7)}-01`;
  const nextMonthStart = shiftMonthStartIso(todayIso.slice(0, 7), 1);

  const [monthRows, upcoming, activePlans] = await Promise.all([
    listTransactionRowsInRange(userId, monthStart, nextMonthStart),
    sumUpcomingRecurringInMonth(userId, todayIso),
    listPlansByUser(userId, ['active']),
  ]);

  const monthIncomeSatang = sumByType(monthRows, 'income');
  const monthExpenseSatang = sumByType(monthRows, 'expense');
  const planCommitmentSatang = activePlans.reduce(
    (sum, plan) => sum + toSatang(plan.monthly_save),
    0
  );

  const monthRemainingSatang =
    monthIncomeSatang +
    upcoming.incomeSatang -
    monthExpenseSatang -
    upcoming.expenseSatang -
    planCommitmentSatang;

  // วันที่เหลือรวมวันนี้: วันที่ 17 ของเดือน 30 วัน = เหลือ 14 วัน
  const { day } = parseIsoDate(todayIso);
  const daysLeft = daysInMonth(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7))) - day + 1;

  return {
    monthRemainingSatang,
    // S5.2 ระบุให้ "ปัดลง" ไม่ใช่ปัดครึ่งขึ้น — ปัดขึ้นแล้วผู้ใช้จะใช้เกินทีละนิดทุกวัน
    perDaySatang: monthRemainingSatang > 0 ? roundDownToSatang(monthRemainingSatang / daysLeft) : 0,
    daysLeft,
    overspentSatang: monthRemainingSatang < 0 ? -monthRemainingSatang : 0,
    breakdown: {
      monthIncomeSatang,
      upcomingIncomeSatang: upcoming.incomeSatang,
      monthExpenseSatang,
      upcomingExpenseSatang: upcoming.expenseSatang,
      planCommitmentSatang,
    },
  };
}
