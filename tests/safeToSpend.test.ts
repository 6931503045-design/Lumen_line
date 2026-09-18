// ไฟล์นี้ทำหน้าที่อะไร: test S5.2 ใช้ได้วันละเท่าไหร่ (Safe-to-spend)
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W2
// ⚖️ กฎเหล็ก G1, G3, G7
//
// 🔴 §S5 Money Engine ห้ามมี AI — ทุกตัวเลขต้องคำนวณซ้ำได้เหมือนเดิมทุกครั้ง

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/supabase', () => ({ supabase: {} }));
vi.mock('../src/db/queries/summary', () => ({
  listTransactionRowsInRange: vi.fn(),
  listAllTransactionRows: vi.fn(),
  listPlanningRowsInRange: vi.fn(),
  findFirstTransactionDate: vi.fn(),
}));
vi.mock('../src/db/queries/categories', () => ({ listCategoriesByUser: vi.fn() }));
vi.mock('../src/db/queries/plans', () => ({ listPlansByUser: vi.fn() }));
vi.mock('../src/db/queries/recurring', () => ({ listActiveRulesByUser: vi.fn() }));

import { listTransactionRowsInRange } from '../src/db/queries/summary';
import { listPlansByUser } from '../src/db/queries/plans';
import { listActiveRulesByUser } from '../src/db/queries/recurring';
import { getSafeToSpend } from '../src/services/summary.service';

const USER = 'user-1';
const TODAY = '2026-09-17'; // กันยายนมี 30 วัน → เหลือ 14 วันรวมวันนี้

function tx(type: 'income' | 'expense' | 'transfer', amount: string) {
  return { type, amount, occurred_at: '2026-09-05T03:00:00Z', category_id: null };
}

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1', user_id: USER, category_id: null, label: 'เงินเดือน',
    type: 'income', amount: '15000.00', frequency: 'monthly',
    day_of_month: 25, day_of_week: null, next_run: '2026-09-25',
    end_date: null, is_active: true, categories: null,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTransactionRowsInRange).mockResolvedValue([]);
  vi.mocked(listPlansByUser).mockResolvedValue([]);
  vi.mocked(listActiveRulesByUser).mockResolvedValue([]);
});

describe('getSafeToSpend — สูตร S5.2', () => {
  it('นับวันที่เหลือรวมวันนี้ด้วย', async () => {
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.daysLeft).toBe(14); // 17..30 ก.ย.
  });

  it('วันสุดท้ายของเดือน = เหลือ 1 วัน ไม่ใช่ 0 (กันหารด้วยศูนย์)', async () => {
    const result = await getSafeToSpend(USER, '2026-09-30');
    expect(result.daysLeft).toBe(1);
  });

  it('รายรับ − รายจ่าย แล้วหารด้วยวันที่เหลือ', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('income', '15000.00'),
      tx('expense', '1000.00'),
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.monthRemainingSatang).toBe(1400000);
    expect(result.perDaySatang).toBe(100000); // 1,400,000 ÷ 14
  });

  it('G7: transfer ไม่ถูกนับทั้งฝั่งรายรับและรายจ่าย', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('income', '15000.00'),
      tx('transfer', '5000.00'),
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.monthRemainingSatang).toBe(1500000);
  });

  it('หัก Σ monthly_save ของแผน active', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('income', '15000.00')]);
    vi.mocked(listPlansByUser).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { monthly_save: '3000.00' } as any,
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.breakdown.planCommitmentSatang).toBe(300000);
    expect(result.monthRemainingSatang).toBe(1200000);
  });

  it('บวก recurring รายรับที่ยังไม่ถึงรอบในเดือนนี้', async () => {
    // เงินเดือนเข้า 25 ก.ย. ซึ่งยังมาไม่ถึง ต้องนับด้วย
    vi.mocked(listActiveRulesByUser).mockResolvedValue([rule()]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.breakdown.upcomingIncomeSatang).toBe(1500000);
    expect(result.monthRemainingSatang).toBe(1500000);
  });

  it('หัก recurring รายจ่ายที่ยังไม่ถึงรอบ', async () => {
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      rule({ id: 'r2', type: 'expense', amount: '3500.00', next_run: '2026-09-25' }),
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.breakdown.upcomingExpenseSatang).toBe(350000);
    expect(result.monthRemainingSatang).toBe(-350000);
  });

  it('รอบที่เลยสิ้นเดือนไปแล้วไม่นับ', async () => {
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      rule({ next_run: '2026-10-25' }),
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.breakdown.upcomingIncomeSatang).toBe(0);
  });

  it('รอบที่เลยมาแล้วแต่ job ยังไม่ได้สร้าง ไม่นับ (S5.2 นับจากวันนี้ไป)', async () => {
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      rule({ next_run: '2026-09-10' }), // ก่อนวันนี้
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.breakdown.upcomingIncomeSatang).toBe(0);
  });

  it('กฎรายสัปดาห์นับหลายรอบในเดือนเดียวได้', async () => {
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      rule({ type: 'expense', amount: '500.00', frequency: 'weekly',
             day_of_month: null, day_of_week: 4, next_run: '2026-09-17' }),
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    // 17, 24 ก.ย. = 2 รอบ (1 ต.ค. เลยเดือนแล้ว)
    expect(result.breakdown.upcomingExpenseSatang).toBe(100000);
  });

  it('กฎที่หมดอายุกลางเดือนไม่นับรอบหลัง end_date', async () => {
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      rule({ type: 'expense', amount: '500.00', frequency: 'weekly',
             day_of_month: null, day_of_week: 4, next_run: '2026-09-17',
             end_date: '2026-09-20' }),
    ]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.breakdown.upcomingExpenseSatang).toBe(50000); // เฉพาะ 17 ก.ย.
  });
});

describe('getSafeToSpend — ใช้เกินแล้ว', () => {
  it('คงเหลือติดลบ → perDay เป็น 0 และบอกว่าเกินเท่าไหร่', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '500.00')]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.monthRemainingSatang).toBe(-50000);
    expect(result.perDaySatang).toBe(0);
    expect(result.overspentSatang).toBe(50000); // เป็นบวกเสมอ (G3)
  });
});

describe('getSafeToSpend — การปัดเศษ', () => {
  it('ปัดลงเสมอตาม S5.2 ไม่ใช่ปัดครึ่งขึ้น', async () => {
    // 100.00 ÷ 14 วัน = 714.28... สตางค์ ต้องได้ 714 ไม่ใช่ 714.29 หรือ 715
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('income', '100.00')]);
    const result = await getSafeToSpend(USER, TODAY);
    expect(result.perDaySatang).toBe(714);
    expect(Number.isInteger(result.perDaySatang)).toBe(true);
  });
});
