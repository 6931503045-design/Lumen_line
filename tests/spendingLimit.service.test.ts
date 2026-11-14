// ไฟล์นี้ทำหน้าที่อะไร: test เพดานการใช้จ่ายที่ผู้ใช้ตั้งเอง (ร่าง §S5.10)
// ใครรับผิดชอบ: ② Database
// ⚖️ กฎเหล็ก G1, G3, G7
//
// สิ่งที่ต้องพิสูจน์:
//   1. ค่าจากหน้าเว็บที่ผิดรูปถูกปฏิเสธก่อนเขียน (G3: เงินเป็นจำนวนเต็มสตางค์บวก)
//   2. ค่าใน DB ที่เพี้ยนไม่ทำให้คำสั่ง "เหลือ" พัง
//   3. "วันนี้ใช้ได้อีก" ตามเพดาน = สูตรเดียวกับหน้าเว็บ ไม่ใช่สูตร S5.2 เดิม
//   4. โอนเข้าแผนไม่นับเป็นการใช้เงินของวันนี้ (G7)

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/users', () => ({ getSpendingLimitsRaw: vi.fn() }));
vi.mock('../src/db/queries/summary', () => ({ listTransactionRowsInRange: vi.fn() }));
vi.mock('../src/services/summary.service', () => ({ getSafeToSpend: vi.fn() }));

import { getSpendingLimitsRaw } from '../src/db/queries/users';
import { listTransactionRowsInRange } from '../src/db/queries/summary';
import { getSafeToSpend } from '../src/services/summary.service';
import {
  defaultSpendingLimits,
  getDailyAllowance,
  getMonthlyAllowance,
  getWeekStartSundayIso,
  getWeeklyAllowance,
  normalizeSpendingLimits,
  parseSpendingLimitsInput,
  SpendingLimitError,
} from '../src/services/spendingLimit.service';

const USER = 'user-1';
const TODAY = '2026-11-14';

function rows(...items: Array<[type: 'income' | 'expense' | 'transfer', amount: string]>) {
  return items.map(([type, amount]) => ({ type, amount, occurred_at: `${TODAY}T05:00:00Z` })) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTransactionRowsInRange).mockResolvedValue(rows());
});

describe('parseSpendingLimitsInput — ค่าจากหน้าเว็บ', () => {
  it('รับค่าที่ถูกต้องครบ', () => {
    const parsed = parseSpendingLimitsInput({
      profile: 'frugal',
      daily: { enabled: true, mode: 'manual', limitSatang: 30000 },
      weekly: { enabled: false, mode: 'system', limitSatang: null },
    });
    expect(parsed.profile).toBe('frugal');
    expect(parsed.daily).toEqual({ enabled: true, mode: 'manual', limitSatang: 30000 });
    expect(parsed.monthly).toEqual(defaultSpendingLimits().monthly);
  });

  it.each([
    ['ยอดเป็นทศนิยม (G3)', { daily: { enabled: true, mode: 'manual', limitSatang: 300.5 } }],
    ['ยอดติดลบ (G3)', { daily: { enabled: true, mode: 'manual', limitSatang: -100 } }],
    ['enabled เป็น string', { daily: { enabled: 'true', mode: 'manual', limitSatang: 30000 } }],
    ['mode ไม่รู้จัก', { daily: { enabled: true, mode: 'auto', limitSatang: 30000 } }],
    ['profile ไม่รู้จัก', { profile: 'yolo' }],
    ['ไม่ใช่ object', 'daily'],
  ])('ปฏิเสธ: %s', (_label, input) => {
    expect(() => parseSpendingLimitsInput(input)).toThrow(SpendingLimitError);
  });

  it('โหมดตั้งเองที่ยังไม่กรอกเงินรับได้ (หน้าเว็บบันทึกโหมดก่อนแล้วค่อยถามยอด)', () => {
    const parsed = parseSpendingLimitsInput({ daily: { enabled: true, mode: 'manual', limitSatang: null } });
    expect(parsed.daily.limitSatang).toBeNull();
  });
});

describe('normalizeSpendingLimits — ค่าจาก DB', () => {
  it('ค่าเพี้ยนหรือไม่มีค่า → ใช้ค่าเริ่มต้น ไม่ throw', () => {
    expect(normalizeSpendingLimits(null)).toEqual(defaultSpendingLimits());
    expect(normalizeSpendingLimits('garbage')).toEqual(defaultSpendingLimits());
    expect(
      normalizeSpendingLimits({ daily: { enabled: true, mode: 'manual', limitSatang: 'สามร้อย' } }).daily
    ).toEqual({ enabled: true, mode: 'manual', limitSatang: null });
  });
});

describe('getDailyAllowance — วันนี้ใช้ได้อีกตามเพดาน', () => {
  it('ไม่ได้เปิดเพดานรายวัน → null (ผู้เรียกใช้สูตร S5.2 เดิม)', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({});
    expect(await getDailyAllowance(USER, TODAY)).toBeNull();
  });

  it('ยังไม่ได้รัน migration (คอลัมน์ไม่มี) → null ไม่พัง', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue(null);
    expect(await getDailyAllowance(USER, TODAY)).toBeNull();
  });

  it('ตั้งเอง ฿300 ใช้ไป ฿120 → เหลือ ฿180 (โอนเข้าแผนไม่นับ ⚖️ G7)', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      daily: { enabled: true, mode: 'manual', limitSatang: 30000 },
    });
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(
      rows(['expense', '80.00'], ['expense', '40.00'], ['transfer', '500.00'], ['income', '1000.00'])
    );

    expect(await getDailyAllowance(USER, TODAY)).toEqual({
      mode: 'manual',
      profile: 'moderate',
      ceilingSatang: 30000,
      spentTodaySatang: 12000,
      remainingSatang: 18000,
    });
    // เพดานตั้งเองไม่ต้องพึ่งยอดทั้งเดือน
    expect(getSafeToSpend).not.toHaveBeenCalled();
  });

  it('ใช้เกินเพดาน → remaining ติดลบ', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      daily: { enabled: true, mode: 'manual', limitSatang: 30000 },
    });
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(rows(['expense', '350.00']));

    expect((await getDailyAllowance(USER, TODAY))?.remainingSatang).toBe(-5000);
  });

  it('ให้ระบบคิด — เพดานของต้นวัน = (คงเหลือ + ใช้ไปวันนี้) ÷ วันที่เหลือ เหมือนหน้าเว็บ', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({ daily: { enabled: true, mode: 'system' } });
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(rows(['expense', '100.00']));
    // คงเหลือหลังหักยอดวันนี้แล้ว ฿2,888 เหลือ 17 วัน → ต้นวัน (2,888 + 100) ÷ 17 = 175.76...
    vi.mocked(getSafeToSpend).mockResolvedValue({ monthRemainingSatang: 288800, daysLeft: 17 } as never);

    const allowance = await getDailyAllowance(USER, TODAY);
    expect(allowance?.ceilingSatang).toBe(17576);
    expect(allowance?.remainingSatang).toBe(17576 - 10000);
  });

  it('ให้ระบบคิดแบบประหยัด → คูณ 0.8 ปัดลงเป็นสตางค์', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      profile: 'frugal',
      daily: { enabled: true, mode: 'system' },
    });
    vi.mocked(getSafeToSpend).mockResolvedValue({ monthRemainingSatang: 288800, daysLeft: 17 } as never);

    expect((await getDailyAllowance(USER, TODAY))?.ceilingSatang).toBe(Math.floor(16988 * 0.8));
  });

  it('ตั้งเองแต่ยังไม่กรอกเงิน → ถือว่าให้ระบบคิด (ตรงกับหน้าเว็บ)', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      daily: { enabled: true, mode: 'manual', limitSatang: null },
    });
    vi.mocked(getSafeToSpend).mockResolvedValue({ monthRemainingSatang: 170000, daysLeft: 17 } as never);

    const allowance = await getDailyAllowance(USER, TODAY);
    expect(allowance?.mode).toBe('system');
    expect(allowance?.ceilingSatang).toBe(10000);
  });

  it('เงินเดือนนี้ติดลบ → เพดานระบบเป็น 0 ไม่ติดลบ', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({ daily: { enabled: true, mode: 'system' } });
    vi.mocked(getSafeToSpend).mockResolvedValue({ monthRemainingSatang: -50000, daysLeft: 10 } as never);

    expect((await getDailyAllowance(USER, TODAY))?.ceilingSatang).toBe(0);
  });
});

// 2026-11-14 เป็นวันเสาร์ → สัปดาห์นี้คือ อา. 8 – ส. 14 พ.ย. (อยู่ในเดือนเดียว) ผ่านมาแล้ว 6 วัน
describe('getWeekStartSundayIso — สัปดาห์เริ่มวันอาทิตย์ (§S5.10.3)', () => {
  it.each([
    ['วันเสาร์', '2026-11-14', '2026-11-08'],
    ['วันอาทิตย์เอง', '2026-11-08', '2026-11-08'],
    ['วันจันทร์', '2026-11-09', '2026-11-08'],
    ['ข้ามเดือน', '2026-12-01', '2026-11-29'],
  ])('%s', (_label, date, expected) => {
    expect(getWeekStartSundayIso(date)).toBe(expected);
  });
});

describe('getWeeklyAllowance — สัปดาห์นี้ใช้ได้อีกตามเพดาน', () => {
  it('นับรายจ่ายตั้งแต่วันอาทิตย์ถึงสิ้นวันนี้ และไม่นับโอนเข้าแผน (G7)', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      weekly: { enabled: true, mode: 'manual', limitSatang: 150000 },
    });
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(
      rows(['expense', '500.00'], ['transfer', '900.00'], ['income', '1000.00'])
    );

    expect(await getWeeklyAllowance(USER, TODAY)).toEqual({
      enabled: true,
      available: true,
      mode: 'manual',
      profile: 'moderate',
      ceilingSatang: 150000,
      spentSatang: 50000,
      remainingSatang: 100000,
    });
    expect(listTransactionRowsInRange).toHaveBeenCalledWith(USER, '2026-11-08', '2026-11-15');
    // เพดานตั้งเองไม่ต้องพึ่งยอดทั้งเดือน
    expect(getSafeToSpend).not.toHaveBeenCalled();
  });

  it('ไม่ได้เปิดเพดานรายสัปดาห์ → enabled=false แต่ยังบอกยอดที่ใช้ไปได้', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({});
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(rows(['expense', '120.00']));

    const allowance = await getWeeklyAllowance(USER, TODAY);
    expect(allowance.enabled).toBe(false);
    expect(allowance.spentSatang).toBe(12000);
  });

  it('ให้ระบบคิด — (คงเหลือ + ใช้ไปสัปดาห์นี้) ÷ (วันที่เหลือ + วันที่ผ่านไป) × 7 เหมือนหน้าเว็บ', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({ weekly: { enabled: true, mode: 'system' } });
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(rows(['expense', '100.00']));
    vi.mocked(getSafeToSpend).mockResolvedValue({ monthRemainingSatang: 288800, daysLeft: 17 } as never);

    // (288,800 + 10,000) ÷ (17 + 6) × 7 = 90,939.13... → ปัดลง
    const allowance = await getWeeklyAllowance(USER, TODAY);
    expect(allowance.mode).toBe('system');
    expect(allowance.ceilingSatang).toBe(90939);
    expect(allowance.remainingSatang).toBe(90939 - 10000);
  });

  it('ให้ระบบคิดแบบประหยัด → คูณ 0.8 ปัดลงเป็นสตางค์', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      profile: 'frugal',
      weekly: { enabled: true, mode: 'system' },
    });
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(rows(['expense', '100.00']));
    vi.mocked(getSafeToSpend).mockResolvedValue({ monthRemainingSatang: 288800, daysLeft: 17 } as never);

    expect((await getWeeklyAllowance(USER, TODAY)).ceilingSatang).toBe(Math.floor(90939 * 0.8));
  });

  it('🔴 สัปดาห์คาบสองเดือนในโหมดระบบคิด → available=false ไม่เดาตัวเลข', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({ weekly: { enabled: true, mode: 'system' } });

    const allowance = await getWeeklyAllowance(USER, '2026-12-01');
    expect(allowance.enabled).toBe(true);
    expect(allowance.available).toBe(false);
    expect(getSafeToSpend).not.toHaveBeenCalled();
  });

  it('สัปดาห์คาบสองเดือนแต่ตั้งเพดานเอง → ยังตอบได้ตามปกติ', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      weekly: { enabled: true, mode: 'manual', limitSatang: 150000 },
    });

    const allowance = await getWeeklyAllowance(USER, '2026-12-01');
    expect(allowance.available).toBe(true);
    expect(allowance.remainingSatang).toBe(150000);
  });

  it('เงินเดือนนี้ติดลบ → เพดานระบบเป็น 0 ไม่ติดลบ', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({ weekly: { enabled: true, mode: 'system' } });
    vi.mocked(getSafeToSpend).mockResolvedValue({ monthRemainingSatang: -50000, daysLeft: 17 } as never);

    expect((await getWeeklyAllowance(USER, TODAY)).ceilingSatang).toBe(0);
  });
});

describe('getMonthlyAllowance — เดือนนี้ใช้ได้อีกตามเพดาน', () => {
  const safe = (monthRemainingSatang: number, monthExpenseSatang: number) =>
    ({ monthRemainingSatang, daysLeft: 17, breakdown: { monthExpenseSatang } }) as never;

  it('ตั้งเอง → เพดาน − ใช้ไปแล้วเดือนนี้', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      monthly: { enabled: true, mode: 'manual', limitSatang: 500000 },
    });
    vi.mocked(getSafeToSpend).mockResolvedValue(safe(288800, 120000));

    expect(await getMonthlyAllowance(USER, TODAY)).toEqual({
      enabled: true,
      available: true,
      mode: 'manual',
      profile: 'moderate',
      ceilingSatang: 500000,
      spentSatang: 120000,
      remainingSatang: 380000,
    });
  });

  it('ให้ระบบคิด — เพดาน = ใช้ไปแล้ว + เงินเหลือทั้งเดือน (§S5.10.2)', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({ monthly: { enabled: true, mode: 'system' } });
    vi.mocked(getSafeToSpend).mockResolvedValue(safe(288800, 120000));

    const allowance = await getMonthlyAllowance(USER, TODAY);
    expect(allowance.ceilingSatang).toBe(408800);
    expect(allowance.remainingSatang).toBe(288800);
  });

  it('ใช้เกินเพดานที่ตั้งเอง → remaining ติดลบ', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({
      monthly: { enabled: true, mode: 'manual', limitSatang: 100000 },
    });
    vi.mocked(getSafeToSpend).mockResolvedValue(safe(0, 120000));

    expect((await getMonthlyAllowance(USER, TODAY)).remainingSatang).toBe(-20000);
  });

  it('ไม่ได้เปิดเพดานรายเดือน → enabled=false', async () => {
    vi.mocked(getSpendingLimitsRaw).mockResolvedValue({});
    vi.mocked(getSafeToSpend).mockResolvedValue(safe(288800, 120000));

    const allowance = await getMonthlyAllowance(USER, TODAY);
    expect(allowance.enabled).toBe(false);
    expect(allowance.spentSatang).toBe(120000);
  });
});
