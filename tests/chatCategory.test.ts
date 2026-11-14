// ไฟล์นี้ทำหน้าที่อะไร: test การเปลี่ยนหมวดจากแชท (FR-01 / SPEC §S1 postback edit_category → set_category)
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G6, G7
//
// เดิมปุ่มนี้ตอบ "ฟีเจอร์แก้หมวดยังไม่เปิดใช้งาน" ทั้งที่ Charter จัดเป็น P0
// สิ่งที่ต้องพิสูจน์: id ของรายการและหมวดใน postback ปลอมได้ — ต้องแตะได้เฉพาะของตัวเอง
// และย้ายรายจ่ายไปหมวดรายรับไม่ได้

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/transactions', () => ({
  getTransactionDetail: vi.fn(),
  updateTransaction: vi.fn(),
  insertTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
}));
vi.mock('../src/db/queries/categories', () => ({
  listCategoriesByUser: vi.fn(),
  findCategoryOwnedByUser: vi.fn(),
  findOrCreateCategory: vi.fn(),
}));
vi.mock('../src/services/budget.service', () => ({
  evaluateBudgetAlert: vi.fn(),
  getCategoryBudgetStatus: vi.fn(),
}));

import { getTransactionDetail, updateTransaction } from '../src/db/queries/transactions';
import {
  findCategoryOwnedByUser,
  findOrCreateCategory,
  listCategoriesByUser,
} from '../src/db/queries/categories';
import { evaluateBudgetAlert, getCategoryBudgetStatus } from '../src/services/budget.service';
import {
  changeTransactionCategory,
  listCategoryChoices,
  TransactionError,
} from '../src/services/transaction.service';

const USER = 'user-1';
const TX = 'tx-1';

const CATEGORIES = [
  { id: 'c-food', name: 'อาหาร', type: 'expense', emoji: '🍜', is_essential: true, is_default: true },
  { id: 'c-travel', name: 'เดินทาง', type: 'expense', emoji: '🚗', is_essential: true, is_default: true },
  { id: 'c-shop', name: 'ช้อปปิ้ง', type: 'expense', emoji: null, is_essential: false, is_default: false },
  { id: 'c-salary', name: 'เงินเดือน', type: 'income', emoji: '💰', is_essential: false, is_default: true },
] as const;

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: TX,
    type: 'expense',
    category_id: 'c-food',
    occurred_at: '2026-11-14T05:00:00Z',
    note: 'กาแฟเย็น',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTransactionDetail).mockResolvedValue(detail());
  vi.mocked(listCategoriesByUser).mockResolvedValue([...CATEGORIES] as never);
  vi.mocked(evaluateBudgetAlert).mockResolvedValue(null);
  vi.mocked(getCategoryBudgetStatus).mockResolvedValue(null);
});

describe('listCategoryChoices — หมวดที่ย้ายไปได้', () => {
  it('เฉพาะหมวดชนิดเดียวกับรายการ และไม่รวมหมวดปัจจุบัน', async () => {
    const result = await listCategoryChoices(USER, TX);

    expect(result.currentCategoryName).toBe('อาหาร');
    expect(result.choices.map((c) => c.id)).toEqual(['c-travel', 'c-shop']);
    // ⚖️ G6: อ่านรายการด้วย user ของคนกดเท่านั้น
    expect(getTransactionDetail).toHaveBeenCalledWith(TX, USER);
    expect(listCategoriesByUser).toHaveBeenCalledWith(USER);
  });

  it('รายรับเห็นเฉพาะหมวดรายรับ', async () => {
    vi.mocked(getTransactionDetail).mockResolvedValue(detail({ type: 'income', category_id: null }));
    const result = await listCategoryChoices(USER, TX);
    expect(result.choices.map((c) => c.id)).toEqual(['c-salary']);
    expect(result.currentCategoryName).toBeNull();
  });

  it('รายการของคนอื่นหรือถูกลบไปแล้ว → 404', async () => {
    vi.mocked(getTransactionDetail).mockResolvedValue(null);
    await expect(listCategoryChoices(USER, TX)).rejects.toMatchObject({ status: 404 });
  });

  it('รายการโอนเข้าแผน (⚖️ G7) ไม่มีหมวด → 400', async () => {
    vi.mocked(getTransactionDetail).mockResolvedValue(detail({ type: 'transfer' }));
    await expect(listCategoryChoices(USER, TX)).rejects.toBeInstanceOf(TransactionError);
  });
});

describe('changeTransactionCategory — ย้ายหมวดตามปุ่มที่กด', () => {
  it('ย้ายไปหมวดของตัวเองที่ชนิดตรงกัน → อัปเดตและคืนชื่อหมวดกับชื่อรายการเดิม', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(CATEGORIES[1] as never);
    vi.mocked(findOrCreateCategory).mockResolvedValue('c-travel');
    vi.mocked(updateTransaction).mockResolvedValue({
      id: TX, amount: '80.00', type: 'expense', occurred_at: '2026-11-14T05:00:00Z',
    } as never);

    const result = await changeTransactionCategory(USER, TX, 'c-travel');

    expect(findCategoryOwnedByUser).toHaveBeenCalledWith(USER, 'c-travel');
    expect(updateTransaction).toHaveBeenCalledWith(TX, USER, expect.objectContaining({ categoryId: 'c-travel' }));
    expect(result).toMatchObject({ categoryName: 'เดินทาง', title: 'กาแฟเย็น', updated: { id: TX, amountSatang: 8000 } });
  });

  it('หมวดของคนอื่น (เดา id มาใส่ postback) → 404 และไม่แตะรายการ (⚖️ G6)', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(null);

    await expect(changeTransactionCategory(USER, TX, 'someone-elses-category')).rejects.toMatchObject({ status: 404 });
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('รายจ่ายไปหมวดรายรับไม่ได้ → 400 และไม่แตะรายการ', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(CATEGORIES[3] as never);

    await expect(changeTransactionCategory(USER, TX, 'c-salary')).rejects.toMatchObject({ status: 400 });
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('รายการไม่มีแล้ว (ลบไปก่อนกดปุ่ม) → 404', async () => {
    vi.mocked(getTransactionDetail).mockResolvedValue(null);
    await expect(changeTransactionCategory(USER, TX, 'c-travel')).rejects.toMatchObject({ status: 404 });
  });
});
