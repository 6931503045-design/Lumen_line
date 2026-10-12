// ไฟล์นี้ทำหน้าที่อะไร: test ว่ารายการประจำที่สร้างใหม่ได้หมวดที่ถูกต้อง
// ใครรับผิดชอบ: ② Database
//
// บั๊กที่ผู้ใช้ทดสอบเจอ: ตั้ง "เงินเดือน" เป็นรายการประจำ แล้วเงินไม่ไปอยู่หมวดเงินเดือน
// เพราะ createRecurringRule ใส่ categoryId = null ทุกครั้ง รายการที่สร้างทุกรอบจึงไม่มีหมวด

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/recurring', () => ({
  listDueRulesAllUsers: vi.fn(),
  listActiveRulesByUser: vi.fn(),
  insertRecurringRule: vi.fn(),
  insertRecurringTransaction: vi.fn(),
  updateRuleSchedule: vi.fn(),
  deactivateRule: vi.fn(),
}));
vi.mock('../src/db/queries/categories', () => ({ listCategoriesByUser: vi.fn() }));

import { insertRecurringRule } from '../src/db/queries/recurring';
import { listCategoriesByUser } from '../src/db/queries/categories';
import { createRecurringRule } from '../src/services/recurring.service';

const CATEGORIES = [
  { id: 'c-food', name: 'อาหาร', type: 'expense', emoji: '🍜', is_essential: true, is_default: true },
  { id: 'c-other', name: 'อื่นๆ', type: 'expense', emoji: '📦', is_essential: false, is_default: true },
  { id: 'c-salary', name: 'เงินเดือน', type: 'income', emoji: '💰', is_essential: false, is_default: true },
];

function create(label: string, type: 'income' | 'expense') {
  return createRecurringRule({
    userId: 'u1',
    label,
    type,
    amountSatang: 500000,
    frequency: 'monthly',
    startDate: '2026-10-25',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(listCategoriesByUser).mockResolvedValue(CATEGORIES as any);
  vi.mocked(insertRecurringRule).mockImplementation(async (row) => ({
    id: 'r1',
    user_id: row.userId,
    category_id: row.categoryId,
    label: row.label,
    type: row.type,
    amount: '5000.00',
    frequency: row.frequency,
    day_of_month: row.dayOfMonth,
    day_of_week: row.dayOfWeek,
    next_run: row.nextRun,
    end_date: row.endDate,
    is_active: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
});

describe('createRecurringRule — หมวดของรายการประจำ', () => {
  it('🔴 "เงินเดือน" รายรับ → หมวดเงินเดือน', async () => {
    const view = await create('เงินเดือน', 'income');
    expect(vi.mocked(insertRecurringRule).mock.calls[0]![0].categoryId).toBe('c-salary');
    expect(view.categoryName).toBe('เงินเดือน');
  });

  it('จับคู่แบบมีคำของกันและกัน — "ค่าอาหารกลางวัน" → อาหาร', async () => {
    await create('ค่าอาหารกลางวัน', 'expense');
    expect(vi.mocked(insertRecurringRule).mock.calls[0]![0].categoryId).toBe('c-food');
  });

  it('รายจ่ายที่จับคู่ไม่ได้ → อื่นๆ', async () => {
    await create('ค่าหอ', 'expense');
    expect(vi.mocked(insertRecurringRule).mock.calls[0]![0].categoryId).toBe('c-other');
  });

  it('รายรับที่จับคู่ไม่ได้ → ไม่มีหมวด (ไม่ติดป้ายผิด)', async () => {
    await create('ค่าขนมจากแม่', 'income');
    expect(vi.mocked(insertRecurringRule).mock.calls[0]![0].categoryId).toBeNull();
  });

  it('ไม่ข้ามประเภท — รายจ่ายชื่อ "เงินเดือน" ต้องไม่ไปลงหมวดรายรับ', async () => {
    await create('เงินเดือน', 'expense');
    expect(vi.mocked(insertRecurringRule).mock.calls[0]![0].categoryId).toBe('c-other');
  });
});
