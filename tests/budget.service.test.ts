// ไฟล์นี้ทำหน้าที่อะไร: test งบรายหมวด (S5.8) — ยอดใช้, สัดส่วน, เกณฑ์เตือน 80/100
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G3, G6, G7
//
// mock ชั้น db/queries ทิ้งทั้งหมด เพราะสิ่งที่ต้องพิสูจน์คือ "ตัดสินใจเตือนถูกจังหวะไหม"
// และ "หารเปอร์เซ็นต์ถูกไหม" ไม่ใช่ "Supabase คืนค่าได้ไหม"

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/budgets', () => ({
  listBudgetsByMonth: vi.fn(),
  findBudget: vi.fn(),
  upsertBudget: vi.fn(),
  deleteBudget: vi.fn(),
  claimBudgetAlert: vi.fn(),
}));
vi.mock('../src/db/queries/categories', () => ({
  findCategoryOwnedByUser: vi.fn(),
}));
vi.mock('../src/db/queries/summary', () => ({
  listTransactionRowsInRange: vi.fn(),
}));

import {
  claimBudgetAlert,
  deleteBudget,
  findBudget,
  listBudgetsByMonth,
  upsertBudget,
} from '../src/db/queries/budgets';
import { findCategoryOwnedByUser } from '../src/db/queries/categories';
import { listTransactionRowsInRange } from '../src/db/queries/summary';
import {
  BudgetError,
  evaluateBudgetAlert,
  formatBudgetAlert,
  getBudgetOverview,
  removeBudget,
  setBudget,
} from '../src/services/budget.service';

const USER = 'user-1';
const FOOD = 'cat-food';
const SHOP = 'cat-shop';
const NOW = new Date('2026-09-14T03:00:00Z'); // 14 ก.ย. 2026 10:00 เวลาไทย
const MONTH = '2026-09-01';

/** แถวดิบแบบที่ Supabase คืนมาจริง (amount เป็น string เสมอ) */
function tx(
  type: 'income' | 'expense' | 'transfer',
  amount: string,
  categoryId: string | null,
  occurredAt = '2026-09-05T03:00:00Z'
) {
  return { type, amount, occurred_at: occurredAt, category_id: categoryId };
}

function budgetRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'budget-1',
    category_id: FOOD,
    month: MONTH,
    limit_amount: '3000.00',
    alerted_80: false,
    alerted_100: false,
    ...overrides,
  };
}

function category(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: FOOD,
    name: 'อาหาร',
    type: 'expense',
    emoji: '🍜',
    is_essential: true,
    is_default: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(listBudgetsByMonth).mockResolvedValue([]);
  vi.mocked(listTransactionRowsInRange).mockResolvedValue([]);
  vi.mocked(findBudget).mockResolvedValue(null);
  vi.mocked(claimBudgetAlert).mockResolvedValue(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(findCategoryOwnedByUser).mockResolvedValue(category() as any);
});

describe('getBudgetOverview — การรวมยอดและสัดส่วน', () => {
  it('คิดยอดใช้จาก transactions สดๆ และหาสัดส่วนถูกต้อง', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(listBudgetsByMonth).mockResolvedValue([
      { ...budgetRow(), categories: { name: 'อาหาร', emoji: '🍜', type: 'expense' } },
    ] as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('expense', '900.00', FOOD),
      tx('expense', '600.50', FOOD),
    ]);

    const overview = await getBudgetOverview(USER);

    expect(overview.month).toBe(MONTH);
    expect(overview.items).toHaveLength(1);
    expect(overview.items[0]!.limitSatang).toBe(300000);
    expect(overview.items[0]!.spentSatang).toBe(150050);
    expect(overview.items[0]!.remainingSatang).toBe(149950);
    expect(overview.items[0]!.percentUsed).toBe(50);
    expect(overview.items[0]!.level).toBe('ok');
  });

  it('G7: transfer และรายรับไม่ถูกนับเป็นยอดใช้ของหมวด', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(listBudgetsByMonth).mockResolvedValue([
      { ...budgetRow(), categories: { name: 'อาหาร', emoji: '🍜', type: 'expense' } },
    ] as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('expense', '300.00', FOOD),
      tx('transfer', '5000.00', FOOD),
      tx('income', '9000.00', FOOD),
    ]);

    const overview = await getBudgetOverview(USER);
    expect(overview.items[0]!.spentSatang).toBe(30000);
  });

  it('รายการที่ไม่ระบุหมวดไม่ไปเกาะงบหมวดไหนเลย', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(listBudgetsByMonth).mockResolvedValue([
      { ...budgetRow(), categories: { name: 'อาหาร', emoji: '🍜', type: 'expense' } },
    ] as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('expense', '250.00', null),
      tx('expense', '100.00', FOOD),
    ]);

    const overview = await getBudgetOverview(USER);
    expect(overview.items[0]!.spentSatang).toBe(10000);
  });

  it('ยอดรวมนับเฉพาะหมวดที่ตั้งงบไว้ ไม่เอารายจ่ายหมวดอื่นมาปน', async () => {
    vi.mocked(listBudgetsByMonth).mockResolvedValue([
      { ...budgetRow(), categories: { name: 'อาหาร', emoji: '🍜', type: 'expense' } },
      {
        ...budgetRow({ id: 'budget-2', category_id: SHOP, limit_amount: '1000.00' }),
        categories: { name: 'ช้อปปิ้ง', emoji: '🛍️', type: 'expense' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('expense', '1500.00', FOOD),
      tx('expense', '400.00', SHOP),
      tx('expense', '9999.00', 'cat-ไม่ได้ตั้งงบ'),
    ]);

    const overview = await getBudgetOverview(USER);
    expect(overview.totalLimitSatang).toBe(400000);
    expect(overview.totalSpentSatang).toBe(190000);
  });

  it('เรียงหมวดที่ใช้ไปเยอะที่สุด (เป็นสัดส่วน) ขึ้นก่อน', async () => {
    vi.mocked(listBudgetsByMonth).mockResolvedValue([
      { ...budgetRow(), categories: { name: 'อาหาร', emoji: '🍜', type: 'expense' } },
      {
        ...budgetRow({ id: 'budget-2', category_id: SHOP, limit_amount: '1000.00' }),
        categories: { name: 'ช้อปปิ้ง', emoji: '🛍️', type: 'expense' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('expense', '300.00', FOOD),   // 10% ของ 3000
      tx('expense', '900.00', SHOP),   // 90% ของ 1000
    ]);

    const overview = await getBudgetOverview(USER);
    expect(overview.items.map((item) => item.categoryName)).toEqual(['ช้อปปิ้ง', 'อาหาร']);
  });

  it('ระดับ warning เริ่มที่ 80% พอดี และ over เริ่มที่ 100% พอดี', async () => {
    vi.mocked(listBudgetsByMonth).mockResolvedValue([
      { ...budgetRow(), categories: { name: 'อาหาร', emoji: '🍜', type: 'expense' } },
      {
        ...budgetRow({ id: 'budget-2', category_id: SHOP, limit_amount: '1000.00' }),
        categories: { name: 'ช้อปปิ้ง', emoji: '🛍️', type: 'expense' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      tx('expense', '2400.00', FOOD), // 80% เป๊ะ
      tx('expense', '1000.00', SHOP), // 100% เป๊ะ
    ]);

    const overview = await getBudgetOverview(USER);
    const byName = new Map(overview.items.map((item) => [item.categoryName, item]));
    expect(byName.get('อาหาร')!.level).toBe('warning');
    expect(byName.get('ช้อปปิ้ง')!.level).toBe('over');
  });

  it('ใช้เกินงบ → remaining ติดลบ ไม่ถูกตัดเป็น 0', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(listBudgetsByMonth).mockResolvedValue([
      { ...budgetRow(), categories: { name: 'อาหาร', emoji: '🍜', type: 'expense' } },
    ] as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '3500.00', FOOD)]);

    const overview = await getBudgetOverview(USER);
    expect(overview.items[0]!.remainingSatang).toBe(-50000);
    expect(overview.items[0]!.percentUsed).toBeCloseTo(116.7, 1);
  });

  it('query ช่วงเดือนถูกต้อง: ตั้งแต่วันที่ 1 ถึงวันที่ 1 ของเดือนถัดไป', async () => {
    await getBudgetOverview(USER);
    expect(listTransactionRowsInRange).toHaveBeenCalledWith(USER, '2026-09-01', '2026-10-01');
  });

  it('ข้ามปีได้: ธันวาคม → มกราคมปีถัดไป', async () => {
    await getBudgetOverview(USER, '2026-12-01');
    expect(listTransactionRowsInRange).toHaveBeenCalledWith(USER, '2026-12-01', '2027-01-01');
  });
});

describe('setBudget — การตรวจก่อนเขียน', () => {
  it('ปฏิเสธงบ 0 หรือติดลบ (G3: เงินต้องเป็นบวกเสมอ)', async () => {
    await expect(setBudget(USER, FOOD, 0)).rejects.toBeInstanceOf(BudgetError);
    await expect(setBudget(USER, FOOD, -100)).rejects.toBeInstanceOf(BudgetError);
    expect(upsertBudget).not.toHaveBeenCalled();
  });

  it('ปฏิเสธค่าที่ไม่ใช่จำนวนเต็มสตางค์', async () => {
    await expect(setBudget(USER, FOOD, 100.5)).rejects.toBeInstanceOf(BudgetError);
  });

  it('G6: ปฏิเสธหมวดที่ไม่ใช่ของผู้ใช้คนนี้ ด้วย 404 และไม่แตะ DB', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(null);
    await expect(setBudget(USER, 'cat-ของคนอื่น', 300000)).rejects.toMatchObject({ status: 404 });
    expect(upsertBudget).not.toHaveBeenCalled();
  });

  it('ตั้งงบกับหมวดรายรับไม่ได้', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(category({ type: 'income' }) as any);
    await expect(setBudget(USER, FOOD, 300000)).rejects.toMatchObject({ status: 400 });
    expect(upsertBudget).not.toHaveBeenCalled();
  });

  it('G3: แปลงสตางค์เป็นบาทก่อนเขียน DB (คอลัมน์เป็น numeric บาท)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(upsertBudget).mockResolvedValue(budgetRow({ limit_amount: '3000.00' }) as any);
    await setBudget(USER, FOOD, 300000);
    expect(upsertBudget).toHaveBeenCalledWith(USER, FOOD, MONTH, '3000.00');
  });

  it('คืนสถานะพร้อมยอดใช้ปัจจุบันทันที ไม่ต้องรอโหลดหน้าใหม่', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(upsertBudget).mockResolvedValue(budgetRow() as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '750.00', FOOD)]);

    const status = await setBudget(USER, FOOD, 300000);
    expect(status).toMatchObject({
      categoryId: FOOD,
      categoryName: 'อาหาร',
      limitSatang: 300000,
      spentSatang: 75000,
      percentUsed: 25,
      level: 'ok',
    });
  });
});

describe('removeBudget', () => {
  it('ส่งเดือนปัจจุบันให้ query เมื่อไม่ได้ระบุเดือน', async () => {
    vi.mocked(deleteBudget).mockResolvedValue(true);
    await expect(removeBudget(USER, FOOD)).resolves.toBe(true);
    expect(deleteBudget).toHaveBeenCalledWith(USER, FOOD, MONTH);
  });
});

describe('evaluateBudgetAlert — S5.8 เตือนระดับละครั้งเดียว', () => {
  it('ไม่ได้ตั้งงบหมวดนี้ → ไม่เตือน และไม่ต้องไปอ่าน transactions ให้เปลือง', async () => {
    vi.mocked(findBudget).mockResolvedValue(null);
    await expect(evaluateBudgetAlert(USER, FOOD)).resolves.toBeNull();
    expect(listTransactionRowsInRange).not.toHaveBeenCalled();
  });

  it('ยังไม่ถึง 80% แม้ปัดแล้วจะได้ 80.0 → ไม่เตือน (เทียบจากสตางค์ ไม่ใช่ค่าที่ปัดแล้ว)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findBudget).mockResolvedValue(budgetRow() as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '2399.99', FOOD)]);

    await expect(evaluateBudgetAlert(USER, FOOD)).resolves.toBeNull();
    expect(claimBudgetAlert).not.toHaveBeenCalled();
  });

  it('ข้าม 80% → เตือนระดับ 80 และติดธงไว้', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findBudget).mockResolvedValue(budgetRow() as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '2400.00', FOOD)]);

    const alert = await evaluateBudgetAlert(USER, FOOD);
    expect(alert).toMatchObject({ threshold: 80, percentUsed: 80, categoryName: 'อาหาร' });
    expect(claimBudgetAlert).toHaveBeenCalledWith(USER, 'budget-1', 80);
  });

  it('เตือน 80% ไปแล้ว → ไม่เตือนซ้ำ', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findBudget).mockResolvedValue(budgetRow({ alerted_80: true }) as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '2700.00', FOOD)]);

    await expect(evaluateBudgetAlert(USER, FOOD)).resolves.toBeNull();
  });

  it('พุ่งจาก 0% ทะลุ 100% ในรายการเดียว → เตือนว่า "เกินงบ" ไม่ใช่ "ใกล้เต็ม"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findBudget).mockResolvedValue(budgetRow() as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '4000.00', FOOD)]);

    const alert = await evaluateBudgetAlert(USER, FOOD);
    expect(alert!.threshold).toBe(100);
    expect(claimBudgetAlert).toHaveBeenCalledWith(USER, 'budget-1', 100);
  });

  it('เตือน 80 ไปแล้วแต่ยังไม่เตือน 100 → พอเกิน 100 ต้องเตือนอีกครั้ง', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findBudget).mockResolvedValue(budgetRow({ alerted_80: true }) as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '3100.00', FOOD)]);

    const alert = await evaluateBudgetAlert(USER, FOOD);
    expect(alert!.threshold).toBe(100);
  });

  it('เตือน 100% ไปแล้ว → เงียบตลอดเดือน', async () => {
    vi.mocked(findBudget).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      budgetRow({ alerted_80: true, alerted_100: true }) as any
    );
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '5000.00', FOOD)]);

    await expect(evaluateBudgetAlert(USER, FOOD)).resolves.toBeNull();
  });

  it('มีอีก request ชิงจองสิทธิ์เตือนไปก่อน → ฝั่งนี้ไม่เตือนซ้ำ', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findBudget).mockResolvedValue(budgetRow() as any);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([tx('expense', '2500.00', FOOD)]);
    vi.mocked(claimBudgetAlert).mockResolvedValue(false);

    await expect(evaluateBudgetAlert(USER, FOOD)).resolves.toBeNull();
  });

  it('รายการย้อนหลัง → เช็คงบของ "เดือนที่รายการเกิด" ไม่ใช่เดือนปัจจุบัน', async () => {
    await evaluateBudgetAlert(USER, FOOD, new Date('2026-07-20T03:00:00Z'));
    expect(findBudget).toHaveBeenCalledWith(USER, FOOD, '2026-07-01');
  });
});

describe('formatBudgetAlert — ข้อความที่ผู้ใช้เห็น', () => {
  it('ระดับ 80 บอกเป็นเปอร์เซ็นต์ที่ใช้ไป', () => {
    const text = formatBudgetAlert({
      categoryId: FOOD,
      categoryName: 'อาหาร',
      emoji: '🍜',
      limitSatang: 300000,
      spentSatang: 250000,
      percentUsed: 83.3,
      threshold: 80,
    });
    expect(text).toContain('83.3%');
    expect(text).toContain('อาหาร');
    expect(text).toContain('฿2,500.00');
  });

  it('ระดับ 100 บอกตรงๆ ว่าใช้เกินงบแล้ว', () => {
    const text = formatBudgetAlert({
      categoryId: FOOD,
      categoryName: 'อาหาร',
      emoji: '🍜',
      limitSatang: 300000,
      spentSatang: 320000,
      percentUsed: 106.7,
      threshold: 100,
    });
    expect(text).toContain('เกินงบ');
  });
});
