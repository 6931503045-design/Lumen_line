// ไฟล์นี้ทำหน้าที่อะไร: test การรวมยอดรายรับ-รายจ่ายที่ services/summary.service.ts
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G1, G3, G7
//
// mock ชั้น db/queries ทิ้งทั้งหมด เพราะสิ่งที่ต้องพิสูจน์คือ "การบวกเลขถูกไหม"
// ไม่ใช่ "Supabase คืนค่าได้ไหม" — การบวกเลขเงินผิดคือบั๊กที่เจ็บที่สุดในแอปการเงิน

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/summary', () => ({
  listAllTransactionRows: vi.fn(),
  listTransactionRowsInRange: vi.fn(),
}));
vi.mock('../src/db/queries/categories', () => ({
  listCategoriesByUser: vi.fn(),
}));

import { listAllTransactionRows, listTransactionRowsInRange } from '../src/db/queries/summary';
import { listCategoriesByUser } from '../src/db/queries/categories';
import { getUserSummary } from '../src/services/summary.service';

const NOW = new Date('2026-09-14T03:00:00Z'); // 14 ก.ย. 2026 10:00 เวลาไทย

/** ผู้ช่วยสร้างแถวดิบแบบที่ Supabase คืนมาจริง (amount เป็น string เสมอ) */
function row(
  type: 'income' | 'expense' | 'transfer',
  amount: string,
  occurredAt: string,
  categoryId: string | null = null
) {
  return { type, amount, occurred_at: occurredAt, category_id: categoryId };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(listCategoriesByUser).mockResolvedValue([]);
  vi.mocked(listAllTransactionRows).mockResolvedValue([]);
  vi.mocked(listTransactionRowsInRange).mockResolvedValue([]);
});

describe('getUserSummary — การแปลงหน่วยเงิน (G3)', () => {
  it('แปลง numeric string จาก DB เป็นสตางค์ถูกต้อง รวมทศนิยม', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('expense', '45.50', '2026-09-10T05:00:00Z'),
      row('expense', '0.99', '2026-09-11T05:00:00Z'),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.monthExpenseSatang).toBe(4550 + 99);
  });

  it('บวกเลขทศนิยมได้เป๊ะ ไม่เพี้ยนแบบ float', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('expense', '0.10', '2026-09-10T05:00:00Z'),
      row('expense', '0.20', '2026-09-10T05:00:00Z'),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.monthExpenseSatang).toBe(30); // ไม่ใช่ 30.000000000000004
  });
});

describe('getUserSummary — transfer ไม่นับ (G7)', () => {
  it('ตัด transfer ออกจากทั้งรายรับ รายจ่าย และยอดคงเหลือ', async () => {
    const rows = [
      row('income', '1000.00', '2026-09-02T05:00:00Z'),
      row('expense', '300.00', '2026-09-03T05:00:00Z'),
      row('transfer', '500.00', '2026-09-04T05:00:00Z'),
    ];
    vi.mocked(listTransactionRowsInRange).mockResolvedValue(rows);
    vi.mocked(listAllTransactionRows).mockResolvedValue(rows);

    const summary = await getUserSummary('u1');
    expect(summary.monthIncomeSatang).toBe(100000);
    expect(summary.monthExpenseSatang).toBe(30000);
    expect(summary.netBalanceSatang).toBe(70000); // 1000 - 300 ไม่เกี่ยวกับ transfer
  });
});

describe('getUserSummary — ขอบเขตเดือน', () => {
  it('นับเฉพาะรายการเดือนนี้ในยอดรายเดือน', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('expense', '100.00', '2026-09-05T05:00:00Z'), // เดือนนี้
      row('expense', '999.00', '2026-08-20T05:00:00Z'), // เดือนก่อน
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.monthExpenseSatang).toBe(10000);
  });

  it('รายการหัวค่ำวันสิ้นเดือนก่อนหน้าต้องไม่หลุดเข้ามา (เวลาไทย ไม่ใช่ UTC)', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      // 31 ส.ค. 20:00 เวลาไทย = 31 ส.ค. 13:00 UTC — ยังเป็นเดือนสิงหาคม
      row('expense', '500.00', '2026-08-31T13:00:00Z'),
      // 1 ก.ย. 00:30 เวลาไทย = 31 ส.ค. 17:30 UTC — เป็นเดือนกันยายนแล้ว
      row('expense', '700.00', '2026-08-31T17:30:00Z'),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.monthExpenseSatang).toBe(70000);
  });

  it('ยอดคงเหลือสะสมนับทุกเดือน ไม่ใช่แค่เดือนนี้', async () => {
    vi.mocked(listAllTransactionRows).mockResolvedValue([
      row('income', '5000.00', '2026-01-10T05:00:00Z'),
      row('expense', '2000.00', '2026-09-10T05:00:00Z'),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.netBalanceSatang).toBe(300000);
  });

  it('ใช้จ่ายเกินรายรับแล้วยอดคงเหลือติดลบได้', async () => {
    vi.mocked(listAllTransactionRows).mockResolvedValue([
      row('income', '100.00', '2026-09-01T05:00:00Z'),
      row('expense', '250.00', '2026-09-02T05:00:00Z'),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.netBalanceSatang).toBe(-15000);
  });
});

describe('getUserSummary — รายจ่ายแยกตามหมวด', () => {
  it('รวมยอดต่อหมวด เรียงมากไปน้อย และแปลง id เป็นชื่อ', async () => {
    vi.mocked(listCategoriesByUser).mockResolvedValue([
      { id: 'c1', name: 'อาหาร', type: 'expense', emoji: '🍜', is_essential: true, is_default: true },
      { id: 'c2', name: 'เดินทาง', type: 'expense', emoji: '🚗', is_essential: true, is_default: true },
    ]);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('expense', '50.00', '2026-09-02T05:00:00Z', 'c1'),
      row('expense', '80.00', '2026-09-03T05:00:00Z', 'c2'),
      row('expense', '70.00', '2026-09-04T05:00:00Z', 'c1'),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.expenseByCategory).toEqual([
      { categoryId: 'c1', name: 'อาหาร', amountSatang: 12000 },
      { categoryId: 'c2', name: 'เดินทาง', amountSatang: 8000 },
    ]);
  });

  it('รายการที่ไม่มีหมวดถูกจัดเป็น "ไม่ระบุหมวด" ไม่ใช่หายไปเฉยๆ', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('expense', '25.00', '2026-09-02T05:00:00Z', null),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.expenseByCategory).toEqual([
      { categoryId: null, name: 'ไม่ระบุหมวด', amountSatang: 2500 },
    ]);
  });

  it('รายรับไม่ถูกนับรวมในสัดส่วนรายจ่าย', async () => {
    vi.mocked(listCategoriesByUser).mockResolvedValue([
      { id: 'c9', name: 'เงินเดือน', type: 'income', emoji: '💰', is_essential: false, is_default: true },
    ]);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('income', '35000.00', '2026-09-01T05:00:00Z', 'c9'),
    ]);

    const summary = await getUserSummary('u1');
    expect(summary.expenseByCategory).toEqual([]);
  });
});

describe('getUserSummary — กราฟย้อนหลัง', () => {
  it('มีครบ 6 เดือนเสมอ แม้เดือนที่ไม่มีรายการเลย', async () => {
    const summary = await getUserSummary('u1');
    expect(summary.monthlyTrend).toHaveLength(6);
    expect(summary.monthlyTrend.map((point) => point.month)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ]);
    expect(summary.monthlyTrend.every((point) => point.incomeSatang === 0)).toBe(true);
  });

  it('ใส่ยอดลงเดือนที่ถูกต้อง', async () => {
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('income', '100.00', '2026-07-15T05:00:00Z'),
      row('expense', '40.00', '2026-07-20T05:00:00Z'),
      row('income', '200.00', '2026-09-01T05:00:00Z'),
    ]);

    const summary = await getUserSummary('u1');
    const july = summary.monthlyTrend.find((point) => point.month === '2026-07');
    const september = summary.monthlyTrend.find((point) => point.month === '2026-09');

    expect(july).toMatchObject({ incomeSatang: 10000, expenseSatang: 4000 });
    expect(september).toMatchObject({ incomeSatang: 20000, expenseSatang: 0 });
  });
});
