// ไฟล์นี้ทำหน้าที่อะไร: จำลองผลกระทบก่อนซื้อ (SPEC §S5.7 / SRS FR-15)
// ใครรับผิดชอบ: ③ Backend (Money Engine)
// เขียนในสัปดาห์: W7
// ⚖️ กฎเหล็ก G1, G3
//
// 🔴 ไม่มี AI ในไฟล์นี้ ทุกตัวเลขมาจากสูตรตรงๆ และเรียกซ้ำได้ผลเดิมเสมอ
//
// ทำไมต้องย้ายมาที่นี่: เดิมสูตรนี้อยู่ใน web/js/app.js คำนวณบนเบราว์เซอร์
// ซึ่งขัดกับ ⚖️ G1 ที่ SRS §2.2 เขียนไว้เองว่า "ตัวเลขเงินทุกตัวต้องมาจาก Money Engine"
// ถ้าปล่อยไว้ หน้าเว็บกับแชทจะตอบคนละเลขได้ เพราะคนละสูตร คนละที่

import { getBudgetOverview } from './budget.service';
import { getPlanCapacity } from './plan.service';
import { daysInMonth, getTodayIso, parseIsoDate } from '../utils/thaiDate';
import { roundDownToSatang } from '../utils/money';

/** error ที่รู้ว่าจะตอบ status อะไร ให้ชั้น route แปลงเป็น HTTP ได้ตรงๆ */
export class SimulateError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'SimulateError';
  }
}

/**
 * ระดับผลกระทบ
 * - `unknown` ผู้ใช้ยังไม่เคยตั้งงบ → ไม่มีอะไรให้เทียบ ห้ามตัดสิน
 * - `ok`      ไม่เกินครึ่งของงบที่เหลือ
 * - `warn`    เกินครึ่งแต่ยังอยู่ในงบ
 * - `over`    เกินงบที่เหลือ
 */
export type SimulateTone = 'unknown' | 'ok' | 'warn' | 'over';

export type SimulateResult = {
  /** false = ยังไม่เคยตั้งงบสักหมวด ทุกยอดด้านล่างเป็น 0 และ tone เป็น 'unknown' */
  hasBudget: boolean;
  priceSatang: number;
  /** งบรวมเดือนนี้ − ที่ใช้ไปแล้ว (ติดลบได้ ถ้าใช้เกินงบไปแล้ว) */
  budgetLeftSatang: number;
  /** งบที่เหลือหลังซื้อของชิ้นนี้ (ติดลบได้) */
  afterBuySatang: number;
  /** ใช้ได้เฉลี่ยต่อวันก่อนซื้อ (ปัดลง) */
  perDayBeforeSatang: number;
  /** ใช้ได้เฉลี่ยต่อวันหลังซื้อ (ปัดลง) */
  perDayAfterSatang: number;
  /** เกินงบไปเท่าไหร่ ถ้าไม่เกินเป็น 0 */
  overBySatang: number;
  /** จำนวนวันที่เหลือในเดือน นับวันนี้ด้วย */
  daysLeft: number;
  /** ออมเดือนละเท่าไหร่ไหว (จาก plan.service — ⚖️ G1 ห้ามเฉลี่ยเอง) */
  monthlyCapacitySatang: number;
  /** ออมกี่เดือนถึงจะซื้อได้โดยไม่กระทบงบ · null = ตอนนี้ยังออมไม่ไหว */
  monthsToSave: number | null;
  tone: SimulateTone;
};

/** ราคาที่ส่งเข้ามาต้องเป็นจำนวนเต็มบวกหน่วยสตางค์ (⚖️ G3) */
function readPriceSatang(value: unknown): number {
  const price = Number(value);
  if (!Number.isInteger(price)) {
    throw new SimulateError('priceSatang ต้องเป็นจำนวนเต็มหน่วยสตางค์', 400);
  }
  if (price <= 0) {
    throw new SimulateError('ราคาต้องมากกว่า 0', 400);
  }
  return price;
}

/**
 * จำลองว่าถ้าซื้อของราคานี้ตอนนี้ งบเดือนนี้จะเหลือเท่าไหร่
 *
 * ⚠️ ผู้ใช้ที่ยังไม่เคยตั้งงบ จะได้ hasBudget: false กลับไป ไม่ใช่ตัวเลข 0
 * เพราะ "งบเหลือ 0 บาท" กับ "ไม่รู้ว่างบเท่าไหร่" คนละเรื่องกันโดยสิ้นเชิง
 * ถ้าตอบ 0 หน้าเว็บจะขึ้นว่า "เกินงบ" กับทุกราคา ทั้งที่ระบบไม่รู้งบของผู้ใช้เลย
 */
export async function simulatePurchase(
  userId: string,
  rawPriceSatang: unknown,
  todayIso: string = getTodayIso()
): Promise<SimulateResult> {
  const priceSatang = readPriceSatang(rawPriceSatang);

  const [budget, capacity] = await Promise.all([
    getBudgetOverview(userId, `${todayIso.slice(0, 7)}-01`),
    getPlanCapacity(userId, todayIso),
  ]);

  // วันที่เหลือรวมวันนี้ — นับแบบเดียวกับ safe-to-spend (S5.2) ให้สองหน้าจอตรงกัน
  const { day } = parseIsoDate(todayIso);
  const daysLeft =
    daysInMonth(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7))) - day + 1;

  const monthlyCapacitySatang = capacity.capacitySatang;

  // ออมกี่เดือนถึงซื้อได้ — คิดได้แม้ยังไม่ตั้งงบ เพราะมาจากพฤติกรรมจริง ไม่ได้มาจากงบ
  const monthsToSave =
    monthlyCapacitySatang > 0 ? Math.ceil(priceSatang / monthlyCapacitySatang) : null;

  const hasBudget = budget.totalLimitSatang > 0;
  if (!hasBudget) {
    return {
      hasBudget: false,
      priceSatang,
      budgetLeftSatang: 0,
      afterBuySatang: 0,
      perDayBeforeSatang: 0,
      perDayAfterSatang: 0,
      overBySatang: 0,
      daysLeft,
      monthlyCapacitySatang,
      monthsToSave,
      tone: 'unknown',
    };
  }

  const budgetLeftSatang = budget.totalLimitSatang - budget.totalSpentSatang;
  const afterBuySatang = budgetLeftSatang - priceSatang;

  // ปัดลงเหมือน S5.2 — ปัดขึ้นแล้วผู้ใช้จะใช้เกินทีละนิดทุกวัน
  const perDayBeforeSatang =
    budgetLeftSatang > 0 ? roundDownToSatang(budgetLeftSatang / daysLeft) : 0;
  const perDayAfterSatang =
    afterBuySatang > 0 ? roundDownToSatang(afterBuySatang / daysLeft) : 0;

  const overBySatang = Math.max(0, priceSatang - Math.max(0, budgetLeftSatang));

  let tone: SimulateTone = 'ok';
  if (priceSatang > budgetLeftSatang) {
    tone = 'over';
  } else if (priceSatang > budgetLeftSatang / 2) {
    // เกินครึ่งของงบที่เหลือ = เตือน แม้จะยังไม่เกินงบ
    // (afterBuy เป็น 0 พอดีก็เข้าเงื่อนไขนี้ เพราะ price = budgetLeft > budgetLeft/2)
    tone = 'warn';
  }

  return {
    hasBudget: true,
    priceSatang,
    budgetLeftSatang,
    afterBuySatang,
    perDayBeforeSatang,
    perDayAfterSatang,
    overBySatang,
    daysLeft,
    monthlyCapacitySatang,
    monthsToSave,
    tone,
  };
}
