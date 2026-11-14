// ไฟล์นี้ทำหน้าที่อะไร: เพดานการใช้จ่ายที่ผู้ใช้ตั้งเอง (ร่าง §S5.10) — ตรวจ/จัดรูปค่า และคิด "วันนี้ใช้ได้อีก" ตามเพดาน
// ใครรับผิดชอบ: ② Database
// อ้างอิง: docs/DRAFT_S5.10_spending_limits.md · supabase/migrations/005_spending_limits.sql
// ⚖️ กฎเหล็ก G1, G3, G6, G7
//
// ทำไมต้องมีไฟล์นี้: เดิมเพดานอยู่ในเบราว์เซอร์อย่างเดียว ผู้ใช้ตั้งเพดานรายวันไว้ 300 บาท
// แล้วถามบอทว่า "เหลือ" ก็ยังได้ "เงินเหลือทั้งเดือน ÷ วันที่เหลือ" ซึ่งไม่ใช่ตัวเลขที่ตัวเองตั้ง
//
// สูตรตรงกับหน้าเว็บ (web/js/app.js getSpendingLimitInfo) เพื่อให้สองที่ตอบเลขเดียวกัน:
//   manual : เพดาน = ตัวเลขที่ผู้ใช้กรอก
//   system : เพดาน = (คงเหลือเดือนนี้ + ใช้ไปวันนี้) ÷ วันที่เหลือรวมวันนี้ × ตัวคูณของรูปแบบ
//            (บวกยอดวันนี้กลับก่อนหาร = เพดานของ "ต้นวัน" ไม่ขยับลงทุกครั้งที่จด)
//   ใช้ได้อีก = เพดาน − ใช้ไปวันนี้ (ติดลบได้ = เกินเพดาน)

import { MAX_AMOUNT_SATANG } from '../config/constants';
import { listTransactionRowsInRange } from '../db/queries/summary';
import { getSpendingLimitsRaw } from '../db/queries/users';
import { add, roundDownToSatang, toSatang } from '../utils/money';
import { addDaysIso, getTodayIso } from '../utils/thaiDate';
import { getSafeToSpend } from './summary.service';

export class SpendingLimitError extends Error {
  constructor(
    message: string,
    readonly status: 400 = 400
  ) {
    super(message);
    this.name = 'SpendingLimitError';
  }
}

export const SPENDING_LIMIT_PERIODS = ['daily', 'weekly', 'monthly'] as const;
export type SpendingLimitPeriod = (typeof SPENDING_LIMIT_PERIODS)[number];
export type SpendingLimitMode = 'system' | 'manual';
export type SpendingProfile = 'moderate' | 'frugal';

export type SpendingLimitSetting = {
  enabled: boolean;
  mode: SpendingLimitMode;
  /** เฉพาะโหมด manual — สตางค์ จำนวนเต็มบวก */
  limitSatang: number | null;
};

export type SpendingLimits = {
  profile: SpendingProfile;
} & Record<SpendingLimitPeriod, SpendingLimitSetting>;

/**
 * ตัวคูณของรูปแบบในโหมด system — ค่าเดียวกับ SPENDING_PROFILE_META ของหน้าเว็บ
 * ⚠️ "ประหยัด" 0.8 ยังไม่อยู่ในร่าง §S5.10 เป็นสมมติฐานเดิมของหน้าเว็บ ต้องแก้สองที่พร้อมกัน
 */
const PROFILE_FACTOR: Record<SpendingProfile, number> = { moderate: 1, frugal: 0.8 };
export const PROFILE_LABEL: Record<SpendingProfile, string> = { moderate: 'ปานกลาง', frugal: 'ประหยัด' };

function defaultSetting(): SpendingLimitSetting {
  return { enabled: false, mode: 'system', limitSatang: null };
}

export function defaultSpendingLimits(): SpendingLimits {
  return {
    profile: 'moderate',
    daily: defaultSetting(),
    weekly: defaultSetting(),
    monthly: defaultSetting(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidLimitSatang(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT_SATANG;
}

/**
 * จัดรูปค่าที่อ่านจาก DB — ผ่อนปรน ค่าไหนเพี้ยนก็ใช้ค่าเริ่มต้นของช่องนั้น ไม่ throw
 * (ข้อมูลเก่าหรือแก้มือใน DB ต้องไม่ทำให้คำสั่ง "เหลือ" พัง)
 */
export function normalizeSpendingLimits(raw: unknown): SpendingLimits {
  const result = defaultSpendingLimits();
  if (!isRecord(raw)) return result;

  if (raw.profile === 'frugal') result.profile = 'frugal';

  for (const period of SPENDING_LIMIT_PERIODS) {
    const value = raw[period];
    if (!isRecord(value)) continue;
    result[period] = {
      enabled: value.enabled === true,
      mode: value.mode === 'manual' ? 'manual' : 'system',
      limitSatang: isValidLimitSatang(value.limitSatang) ? value.limitSatang : null,
    };
  }
  return result;
}

/**
 * ตรวจค่าที่หน้าเว็บส่งมาก่อนบันทึก — เข้มงวด ผิดตรงไหนบอกตรงนั้น (400)
 * ไม่แปลง "true" หรือ "300" ให้เอง: เดาใจผิดแล้วผู้ใช้จะได้เพดานที่ตัวเองไม่ได้ตั้ง
 */
export function parseSpendingLimitsInput(input: unknown): SpendingLimits {
  if (!isRecord(input)) {
    throw new SpendingLimitError('spendingLimits ต้องเป็น object');
  }
  const result = defaultSpendingLimits();

  if (input.profile !== undefined) {
    if (input.profile !== 'moderate' && input.profile !== 'frugal') {
      throw new SpendingLimitError('profile ต้องเป็น moderate หรือ frugal');
    }
    result.profile = input.profile;
  }

  for (const period of SPENDING_LIMIT_PERIODS) {
    const value = input[period];
    if (value === undefined) continue;
    if (!isRecord(value)) throw new SpendingLimitError(`${period} ต้องเป็น object`);
    if (typeof value.enabled !== 'boolean') {
      throw new SpendingLimitError(`${period}.enabled ต้องเป็น true หรือ false`);
    }
    if (value.mode !== 'system' && value.mode !== 'manual') {
      throw new SpendingLimitError(`${period}.mode ต้องเป็น system หรือ manual`);
    }
    const limit = value.limitSatang ?? null;
    if (limit !== null && !isValidLimitSatang(limit)) {
      throw new SpendingLimitError(`${period}.limitSatang ต้องเป็นจำนวนเต็มสตางค์ที่มากกว่า 0 (G3)`);
    }
    // โหมดตั้งเองที่ยังไม่มีตัวเลขรับได้ — หน้าเว็บบันทึกโหมดก่อนแล้วค่อยเปิดช่องกรอกเงิน
    // ระหว่างนั้นทั้งเว็บและ getDailyAllowance ถือว่าเป็นแบบระบบคำนวณ
    result[period] = { enabled: value.enabled, mode: value.mode, limitSatang: limit };
  }
  return result;
}

export async function getSpendingLimits(userId: string): Promise<SpendingLimits> {
  return normalizeSpendingLimits(await getSpendingLimitsRaw(userId));
}

export type DailyAllowance = {
  mode: SpendingLimitMode;
  /** ใช้เฉพาะโหมด system */
  profile: SpendingProfile;
  ceilingSatang: number;
  spentTodaySatang: number;
  /** เพดาน − ใช้ไปวันนี้ — ติดลบ = เกินเพดานแล้ว */
  remainingSatang: number;
};

/**
 * "วันนี้ใช้ได้อีกเท่าไหร่" ตามเพดานรายวันที่ผู้ใช้เปิดไว้
 * คืน null ถ้าไม่ได้เปิดเพดานรายวัน — ผู้เรียกใช้สูตร S5.2 เดิมต่อ
 */
export async function getDailyAllowance(
  userId: string,
  todayIso: string = getTodayIso()
): Promise<DailyAllowance | null> {
  const limits = await getSpendingLimits(userId);
  const daily = limits.daily;
  if (!daily.enabled) return null;

  const todayRows = await listTransactionRowsInRange(userId, todayIso, addDaysIso(todayIso, 1));
  // ⚖️ G7: นับเฉพาะรายจ่าย โอนเข้าแผนไม่ใช่การใช้เงิน
  const spentTodaySatang = add(
    ...todayRows.filter((row) => row.type === 'expense').map((row) => toSatang(row.amount))
  );

  let ceilingSatang: number;
  if (daily.mode === 'manual' && daily.limitSatang !== null) {
    ceilingSatang = daily.limitSatang;
  } else {
    const safe = await getSafeToSpend(userId, todayIso);
    const startOfDayPerDay = roundDownToSatang(
      (safe.monthRemainingSatang + spentTodaySatang) / Math.max(1, safe.daysLeft)
    );
    ceilingSatang = Math.max(0, roundDownToSatang(startOfDayPerDay * PROFILE_FACTOR[limits.profile]));
  }

  return {
    mode: daily.mode === 'manual' && daily.limitSatang !== null ? 'manual' : 'system',
    profile: limits.profile,
    ceilingSatang,
    spentTodaySatang,
    remainingSatang: ceilingSatang - spentTodaySatang,
  };
}
