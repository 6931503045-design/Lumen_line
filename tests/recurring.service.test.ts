// ไฟล์นี้ทำหน้าที่อะไร: test รายการประจำ (S5.9) — วันรอบถัดไป, ยอดต่อเดือน, การตามเก็บย้อนหลัง
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G3, G6
//
// computeNextRun เป็นฟังก์ชันบริสุทธิ์ จึง test ตรงๆ ได้ทุกกรณีขอบปฏิทิน
// ส่วน processDueRecurringRules ต้อง mock ชั้น db เพราะสิ่งที่ต้องพิสูจน์คือ
// "ตามเก็บครบกี่รอบ และรันซ้ำแล้วไม่สร้างซ้ำไหม" ไม่ใช่ "Supabase คืนค่าได้ไหม"

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/recurring', () => ({
  listDueRulesAllUsers: vi.fn(),
  listActiveRulesByUser: vi.fn(),
  insertRecurringRule: vi.fn(),
  insertRecurringTransaction: vi.fn(),
  updateRuleSchedule: vi.fn(),
  deactivateRule: vi.fn(),
}));

import {
  insertRecurringTransaction,
  listActiveRulesByUser,
  listDueRulesAllUsers,
  updateRuleSchedule,
} from '../src/db/queries/recurring';
import {
  computeNextRun,
  getMonthlyRecurringTotals,
  processDueRecurringRules,
  toMonthlySatang,
} from '../src/services/recurring.service';

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    user_id: 'user-1',
    category_id: null,
    label: 'ค่าหอ',
    type: 'expense',
    amount: '3500.00',
    frequency: 'monthly',
    day_of_month: 1,
    day_of_week: null,
    next_run: '2026-09-01',
    end_date: null,
    is_active: true,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listDueRulesAllUsers).mockResolvedValue([]);
  vi.mocked(listActiveRulesByUser).mockResolvedValue([]);
  vi.mocked(insertRecurringTransaction).mockResolvedValue({ id: 'tx-new' });
  vi.mocked(updateRuleSchedule).mockResolvedValue(undefined);
});

describe('computeNextRun — daily', () => {
  it('บวกทีละวัน และข้ามเดือนได้', () => {
    const daily = { frequency: 'daily' as const, day_of_month: null, day_of_week: null };
    expect(computeNextRun(daily, '2026-09-14')).toBe('2026-09-15');
    expect(computeNextRun(daily, '2026-09-30')).toBe('2026-10-01');
    expect(computeNextRun(daily, '2026-12-31')).toBe('2027-01-01');
  });

  it('ข้ามวันที่ 29 ก.พ. ของปีอธิกสุรทินได้ถูกต้อง', () => {
    const daily = { frequency: 'daily' as const, day_of_month: null, day_of_week: null };
    expect(computeNextRun(daily, '2028-02-28')).toBe('2028-02-29');
    expect(computeNextRun(daily, '2028-02-29')).toBe('2028-03-01');
    // 2026 ไม่ใช่ปีอธิกสุรทิน
    expect(computeNextRun(daily, '2026-02-28')).toBe('2026-03-01');
  });
});

describe('computeNextRun — weekly', () => {
  it('ไปวันในสัปดาห์ที่กำหนดครั้งถัดไป', () => {
    // 2026-09-14 เป็นวันจันทร์ (dayOfWeek = 1)
    const friday = { frequency: 'weekly' as const, day_of_month: null, day_of_week: 5 };
    expect(computeNextRun(friday, '2026-09-14')).toBe('2026-09-18');
  });

  it('ถ้าวันนี้ตรงวันเป้าหมายอยู่แล้ว ต้องไปสัปดาห์หน้า ไม่ใช่วันเดิม', () => {
    const monday = { frequency: 'weekly' as const, day_of_month: null, day_of_week: 1 };
    expect(computeNextRun(monday, '2026-09-14')).toBe('2026-09-21');
  });

  it('ข้ามสัปดาห์ย้อนกลับได้ถูก (เป้าหมายอยู่ก่อนวันปัจจุบันในสัปดาห์)', () => {
    // จันทร์ 14 ก.ย. → อาทิตย์ถัดไปคือ 20 ก.ย.
    const sunday = { frequency: 'weekly' as const, day_of_month: null, day_of_week: 0 };
    expect(computeNextRun(sunday, '2026-09-14')).toBe('2026-09-20');
  });

  it('ไม่ระบุวันในสัปดาห์ = ครบ 7 วันพอดี', () => {
    const weekly = { frequency: 'weekly' as const, day_of_month: null, day_of_week: null };
    expect(computeNextRun(weekly, '2026-09-14')).toBe('2026-09-21');
  });
});

describe('computeNextRun — monthly (S5.9 การหดวันในเดือนสั้น)', () => {
  it('รอบปกติเลื่อนไปเดือนถัดไปวันเดิม', () => {
    const rule1 = { frequency: 'monthly' as const, day_of_month: 1, day_of_week: null };
    expect(computeNextRun(rule1, '2026-09-01')).toBe('2026-10-01');
  });

  it('day_of_month = 31 ในเดือนที่สั้นกว่า → วันสุดท้ายของเดือน', () => {
    const day31 = { frequency: 'monthly' as const, day_of_month: 31, day_of_week: null };
    expect(computeNextRun(day31, '2026-01-31')).toBe('2026-02-28');
    expect(computeNextRun(day31, '2026-03-31')).toBe('2026-04-30');
  });

  it('🔴 หลังถูกหดแล้วต้องกลับไปวันที่ 31 ไม่ใช่ค้างที่ 28', () => {
    // นี่คือกรณีที่พลาดง่ายที่สุด: ถ้ายึดวันจากวันที่ปัจจุบัน (28) แทนที่จะยึดจากกฎ (31)
    // ค่าเช่าจะเลื่อนจากสิ้นเดือนไปเป็นวันที่ 28 ตลอดไปหลังผ่านเดือนกุมภาพันธ์ครั้งเดียว
    const day31 = { frequency: 'monthly' as const, day_of_month: 31, day_of_week: null };
    expect(computeNextRun(day31, '2026-02-28')).toBe('2026-03-31');
  });

  it('ปีอธิกสุรทิน: 31 ม.ค. → 29 ก.พ. 2028', () => {
    const day31 = { frequency: 'monthly' as const, day_of_month: 31, day_of_week: null };
    expect(computeNextRun(day31, '2028-01-31')).toBe('2028-02-29');
  });

  it('ข้ามปีตอนธันวาคม', () => {
    const day15 = { frequency: 'monthly' as const, day_of_month: 15, day_of_week: null };
    expect(computeNextRun(day15, '2026-12-15')).toBe('2027-01-15');
  });

  it('ไม่ระบุ day_of_month = ยึดวันของรอบปัจจุบัน', () => {
    const monthly = { frequency: 'monthly' as const, day_of_month: null, day_of_week: null };
    expect(computeNextRun(monthly, '2026-09-20')).toBe('2026-10-20');
  });
});

describe('computeNextRun — yearly', () => {
  it('เลื่อนไปปีถัดไปวันเดิม', () => {
    const yearly = { frequency: 'yearly' as const, day_of_month: null, day_of_week: null };
    expect(computeNextRun(yearly, '2026-06-10')).toBe('2027-06-10');
  });

  it('29 ก.พ. ในปีที่ไม่ใช่อธิกสุรทิน → 28 ก.พ.', () => {
    const yearly = { frequency: 'yearly' as const, day_of_month: null, day_of_week: null };
    expect(computeNextRun(yearly, '2028-02-29')).toBe('2029-02-28');
  });
});

describe('toMonthlySatang — ตัวคูณตาม S5.3', () => {
  it('monthly = ยอดเดิม', () => {
    expect(toMonthlySatang({ amount: '3500.00', frequency: 'monthly' })).toBe(350000);
  });

  it('daily × 365 ÷ 12', () => {
    // ฿50/วัน = 5000 สตางค์ × 30.4166... = 152083.33 → ปัดครึ่งขึ้น = 152083
    expect(toMonthlySatang({ amount: '50.00', frequency: 'daily' })).toBe(152083);
  });

  it('weekly × 52 ÷ 12', () => {
    // ฿300/สัปดาห์ = 30000 × 4.3333... = 130000
    expect(toMonthlySatang({ amount: '300.00', frequency: 'weekly' })).toBe(130000);
  });

  it('yearly ÷ 12', () => {
    // ฿1,200/ปี = 120000 ÷ 12 = 10000
    expect(toMonthlySatang({ amount: '1200.00', frequency: 'yearly' })).toBe(10000);
  });

  it('G3: คืนค่าเป็นจำนวนเต็มสตางค์เสมอ ไม่มีเศษทศนิยมหลุดออกไป', () => {
    const value = toMonthlySatang({ amount: '33.33', frequency: 'daily' });
    expect(Number.isInteger(value)).toBe(true);
  });
});

describe('getMonthlyRecurringTotals — อินพุตของสูตร S5.3', () => {
  it('แยกรายรับ/รายจ่าย และแปลงทุกความถี่เป็นต่อเดือน', async () => {
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      rule({ type: 'income', amount: '15000.00', frequency: 'monthly' }),
      rule({ id: 'r2', type: 'expense', amount: '3500.00', frequency: 'monthly' }),
      rule({ id: 'r3', type: 'expense', amount: '1200.00', frequency: 'yearly' }),
    ]);

    const totals = await getMonthlyRecurringTotals('user-1');
    expect(totals.incomeSatang).toBe(1500000);
    expect(totals.expenseSatang).toBe(350000 + 10000);
  });

  it('ไม่มีกฎเลย → 0 ทั้งคู่ (ไม่ใช่ NaN)', async () => {
    const totals = await getMonthlyRecurringTotals('user-1');
    expect(totals).toEqual({ incomeSatang: 0, expenseSatang: 0 });
  });
});

describe('processDueRecurringRules — S7 ตามทันเมื่อเซิร์ฟเวอร์หลับ', () => {
  it('ถึงรอบพอดี 1 รอบ → สร้าง 1 รายการ แล้วเลื่อน next_run', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([rule({ next_run: '2026-09-01' })]);

    const result = await processDueRecurringRules('2026-09-14');

    expect(result.created).toBe(1);
    expect(updateRuleSchedule).toHaveBeenCalledWith('rule-1', '2026-10-01', true);
  });

  it('หลับไป 3 เดือน → ตามเก็บครบทุกรอบที่ค้าง', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([rule({ next_run: '2026-06-01' })]);

    const result = await processDueRecurringRules('2026-09-14');

    expect(result.created).toBe(4); // มิ.ย. ก.ค. ส.ค. ก.ย.
    expect(updateRuleSchedule).toHaveBeenCalledWith('rule-1', '2026-10-01', true);
  });

  it('รายการย้อนหลังต้องลงวันที่ของรอบนั้น ไม่ใช่วันที่ job รัน', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([rule({ next_run: '2026-07-01' })]);

    await processDueRecurringRules('2026-09-14');

    const runDates = vi.mocked(insertRecurringTransaction).mock.calls.map((call) => call[0].runDate);
    expect(runDates).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
    // occurred_at ต้องเป็นต้นวันตามเวลาไทยของวันนั้น ไม่งั้นยอดสรุปจะตกเดือนผิด
    expect(vi.mocked(insertRecurringTransaction).mock.calls[0]![0].occurredAt)
      .toBe('2026-07-01T00:00:00+07:00');
  });

  it('idempotent: รอบที่มีรายการอยู่แล้วนับเป็น skippedDuplicate ไม่ใช่ created', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([rule({ next_run: '2026-08-01' })]);
    // จำลองว่ารอบ ส.ค. ถูกสร้างไปแล้ว (unique constraint ชน) ส่วน ก.ย. ยังไม่มี
    vi.mocked(insertRecurringTransaction)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'tx-sep' });

    const result = await processDueRecurringRules('2026-09-14');

    expect(result.skippedDuplicate).toBe(1);
    expect(result.created).toBe(1);
  });

  it('G3: ส่งจำนวนเงินเป็นสตางค์ให้ชั้น db ไม่ใช่ numeric string จาก DB', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([rule({ amount: '3500.50' })]);

    await processDueRecurringRules('2026-09-14');

    expect(vi.mocked(insertRecurringTransaction).mock.calls[0]![0].amountSatang).toBe(350050);
  });

  it('เลย end_date แล้ว → ไม่สร้างรายการ และปิดกฎ', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([
      rule({ next_run: '2026-09-01', end_date: '2026-08-31' }),
    ]);

    const result = await processDueRecurringRules('2026-09-14');

    expect(insertRecurringTransaction).not.toHaveBeenCalled();
    expect(result.deactivated).toBe(1);
    expect(updateRuleSchedule).toHaveBeenCalledWith('rule-1', '2026-09-01', false);
  });

  it('รอบสุดท้ายยังอยู่ในช่วง แต่รอบถัดไปเลย end_date → สร้างรอบสุดท้ายแล้วปิดกฎ', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([
      rule({ next_run: '2026-09-01', end_date: '2026-09-15' }),
    ]);

    const result = await processDueRecurringRules('2026-09-14');

    expect(result.created).toBe(1);
    expect(result.deactivated).toBe(1);
    expect(updateRuleSchedule).toHaveBeenCalledWith('rule-1', '2026-10-01', false);
  });

  it('ยังไม่ถึงรอบ → ไม่สร้างอะไรเลย (เผื่อ query คืนกฎที่ยังไม่ถึงรอบมา)', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([rule({ next_run: '2026-10-01' })]);

    const result = await processDueRecurringRules('2026-09-14');

    expect(result.created).toBe(0);
    expect(insertRecurringTransaction).not.toHaveBeenCalled();
  });

  it('มีเพดานการตามเก็บ — กฎที่ next_run เพี้ยนไปไกลมากต้องไม่สร้างรายการไม่จำกัด', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([
      rule({ frequency: 'daily', day_of_month: null, next_run: '1970-01-01' }),
    ]);

    const result = await processDueRecurringRules('2026-09-14');

    expect(result.created).toBe(400);
    expect(result.cappedRules).toBe(1);
  });

  it('กฎข้อหนึ่งพังต้องไม่ทำให้กฎที่เหลือหยุด', async () => {
    vi.mocked(listDueRulesAllUsers).mockResolvedValue([
      rule({ id: 'rule-พัง' }),
      rule({ id: 'rule-ดี' }),
    ]);
    vi.mocked(insertRecurringTransaction)
      .mockRejectedValueOnce(new Error('DB ล่ม'))
      .mockResolvedValueOnce({ id: 'tx-ok' });

    const result = await processDueRecurringRules('2026-09-14');

    expect(result.failed).toBe(1);
    expect(result.created).toBe(1);
    expect(result.rulesProcessed).toBe(2);
  });
});
