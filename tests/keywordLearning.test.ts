// ไฟล์นี้ทำหน้าที่อะไร: test พจนานุกรมส่วนตัว (L3) — จำหมวดที่ผู้ใช้เลือกเอง แล้วใช้ครั้งต่อไป
// ใครรับผิดชอบ: ③ AI
// ⚖️ กฎเหล็ก G4, G5, G6
//
// ปัญหาเดิม: ผู้ใช้เปลี่ยน "ร้านป้าแดง" จาก "อื่นๆ" เป็น "อาหาร" แล้ว ครั้งหน้าพิมพ์คำเดิมก็ยังลง "อื่นๆ"
// สิ่งที่ต้องพิสูจน์:
//   1. คำถูก normalize ให้รูปเดียวกัน และไม่จำคำที่มีตัวเลข (⚖️ G5)
//   2. สิ่งที่ผู้ใช้สอนชนะตารางคำกลาง
//   3. การเปลี่ยนหมวดทุกทาง (แชท/เว็บ) สอนระบบ และการจำที่ล้มไม่ทำให้การแก้ล้ม

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/categories', () => ({
  listCategoriesByUser: vi.fn(),
  findOrCreateCategory: vi.fn(),
  findCategoryOwnedByUser: vi.fn(),
}));
vi.mock('../src/db/queries/transactions', () => ({
  getTransactionDetail: vi.fn(),
  updateTransaction: vi.fn(),
  insertTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
}));
vi.mock('../src/services/budget.service', () => ({
  evaluateBudgetAlert: vi.fn(),
  getCategoryBudgetStatus: vi.fn(),
}));

import { findLearnedKeyword, upsertLearnedKeyword } from '../src/db/queries/keywords';
import { findOrCreateCategory, listCategoriesByUser } from '../src/db/queries/categories';
import { getTransactionDetail, updateTransaction } from '../src/db/queries/transactions';
import { evaluateBudgetAlert, getCategoryBudgetStatus } from '../src/services/budget.service';
import {
  learnCategory,
  lookupLearnedCategory,
  normalizeKeyword,
} from '../src/services/keyword.service';
import { resolveCategory } from '../src/services/category.service';
import { updateTransactionForUser } from '../src/services/transaction.service';

const USER = 'user-1';

const CATEGORIES = [
  { id: 'c-food', name: 'อาหาร', type: 'expense', emoji: null, is_essential: true, is_default: true },
  { id: 'c-drink', name: 'เครื่องดื่ม', type: 'expense', emoji: null, is_essential: false, is_default: false },
  { id: 'c-other', name: 'อื่นๆ', type: 'expense', emoji: null, is_essential: false, is_default: true },
  { id: 'c-salary', name: 'เงินเดือน', type: 'income', emoji: null, is_essential: false, is_default: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findLearnedKeyword).mockResolvedValue(null);
  vi.mocked(upsertLearnedKeyword).mockResolvedValue(undefined);
  vi.mocked(listCategoriesByUser).mockResolvedValue(CATEGORIES as never);
  vi.mocked(evaluateBudgetAlert).mockResolvedValue(null);
  vi.mocked(getCategoryBudgetStatus).mockResolvedValue(null);
});

describe('normalizeKeyword', () => {
  it.each([
    ['  Coffee  ', 'coffee'],
    ['ร้านป้าแดง', 'ร้านป้าแดง'],
    ['ข้าว   มันไก่', 'ข้าว มันไก่'],
    ['"ชานม"!', 'ชานม'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeKeyword(input)).toBe(expected);
  });

  it.each([
    ['ว่าง', ''],
    ['null', null],
    ['มีตัวเลข (อาจเป็นเลขบัญชี/เบอร์ ⚖️ G5)', 'โอนให้ 0812345678'],
    ['เลขไทย', 'ค่าห้อง ๓'],
    ['ยาวเกิน (โน้ตยาวจากเว็บ)', 'ก'.repeat(41)],
  ])('ไม่จำ: %s', (_label, input) => {
    expect(normalizeKeyword(input as string | null)).toBeNull();
  });
});

describe('learnCategory / lookupLearnedCategory', () => {
  it('จำด้วยคำที่ normalize แล้ว ของผู้ใช้คนนี้', async () => {
    expect(await learnCategory(USER, '  ร้านป้าแดง ', 'c-food')).toBe(true);
    expect(upsertLearnedKeyword).toHaveBeenCalledWith(USER, 'ร้านป้าแดง', 'c-food');
  });

  it('คำที่ไม่ควรจำ → ไม่แตะ DB', async () => {
    expect(await learnCategory(USER, 'โอนให้ 0812345678', 'c-food')).toBe(false);
    expect(upsertLearnedKeyword).not.toHaveBeenCalled();
  });

  it('จำไม่สำเร็จ → คืน false ไม่ throw (การแก้หมวดสำเร็จไปแล้ว)', async () => {
    vi.mocked(upsertLearnedKeyword).mockRejectedValue(new Error('DB ล่ม'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(learnCategory(USER, 'ร้านป้าแดง', 'c-food')).resolves.toBe(false);
    spy.mockRestore();
  });

  it('ค้นเจอแต่ชนิดไม่ตรง (สอนไว้ฝั่งรายจ่าย ถามฝั่งรายรับ) → ไม่ใช้', async () => {
    vi.mocked(findLearnedKeyword).mockResolvedValue({
      categoryId: 'c-food', categoryName: 'อาหาร', categoryType: 'expense', hitCount: 1,
    });
    expect(await lookupLearnedCategory(USER, 'ร้านป้าแดง', 'expense')).toBe('อาหาร');
    expect(await lookupLearnedCategory(USER, 'ร้านป้าแดง', 'income')).toBeNull();
  });

  it('อ่านพจนานุกรมไม่ได้ → ถือว่าไม่เคยสอน ไม่ทำให้การบันทึกพัง', async () => {
    vi.mocked(findLearnedKeyword).mockRejectedValue(new Error('DB ล่ม'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await lookupLearnedCategory(USER, 'ร้านป้าแดง', 'expense')).toBeNull();
    spy.mockRestore();
  });
});

describe('resolveCategory — ลำดับ L3 → ชื่อหมวด → L2', () => {
  it('🔴 สิ่งที่ผู้ใช้สอนชนะตารางคำกลาง ("กาแฟ" ที่ย้ายไป "เครื่องดื่ม" ต้องไม่กลับไป "อาหาร")', async () => {
    vi.mocked(findLearnedKeyword).mockResolvedValue({
      categoryId: 'c-drink', categoryName: 'เครื่องดื่ม', categoryType: 'expense', hitCount: 2,
    });
    expect(await resolveCategory(USER, 'กาแฟ', 'expense')).toEqual({ name: 'เครื่องดื่ม', source: 'learned' });
  });

  it('ยังไม่เคยสอน → ใช้ตารางคำกลางเหมือนเดิม', async () => {
    expect(await resolveCategory(USER, 'กาแฟ', 'expense')).toEqual({ name: 'อาหาร', source: 'dictionary' });
  });

  it('ไม่มีใครรู้จักคำนี้ → null (ผู้เรียกลง "อื่นๆ")', async () => {
    expect(await resolveCategory(USER, 'ร้านป้าแดง', 'expense')).toBeNull();
  });

  it('สอนแล้ว → คำเดิมครั้งหน้าได้หมวดที่สอน', async () => {
    vi.mocked(findLearnedKeyword).mockImplementation(async (_user, keyword) =>
      keyword === 'ร้านป้าแดง'
        ? { categoryId: 'c-food', categoryName: 'อาหาร', categoryType: 'expense', hitCount: 1 }
        : null
    );
    expect(await resolveCategory(USER, 'ร้านป้าแดง', 'expense')).toEqual({ name: 'อาหาร', source: 'learned' });
  });
});

describe('updateTransactionForUser — การเปลี่ยนหมวดทุกทางสอนระบบ', () => {
  beforeEach(() => {
    vi.mocked(getTransactionDetail).mockResolvedValue({
      id: 'tx-1', type: 'expense', category_id: 'c-other', occurred_at: '2026-11-15T05:00:00Z', note: 'ร้านป้าแดง',
    });
    vi.mocked(findOrCreateCategory).mockResolvedValue('c-food');
    vi.mocked(updateTransaction).mockResolvedValue({
      id: 'tx-1', amount: '50.00', type: 'expense', occurred_at: '2026-11-15T05:00:00Z',
    } as never);
  });

  it('เปลี่ยนหมวด → จำชื่อรายการเดิมกับหมวดใหม่', async () => {
    await updateTransactionForUser(USER, 'tx-1', { categoryName: 'อาหาร' });
    expect(upsertLearnedKeyword).toHaveBeenCalledWith(USER, 'ร้านป้าแดง', 'c-food');
  });

  it('แก้ชื่อรายการพร้อมหมวดในครั้งเดียว → จำชื่อใหม่', async () => {
    await updateTransactionForUser(USER, 'tx-1', { categoryName: 'อาหาร', note: 'ข้าวป้าแดง' });
    expect(upsertLearnedKeyword).toHaveBeenCalledWith(USER, 'ข้าวป้าแดง', 'c-food');
  });

  it('แก้แค่ยอด ไม่แตะหมวด → ไม่จำอะไร', async () => {
    await updateTransactionForUser(USER, 'tx-1', { amountSatang: 6000 });
    expect(upsertLearnedKeyword).not.toHaveBeenCalled();
  });

  it('ล้างหมวด (categoryName: null) → ไม่จำ', async () => {
    await updateTransactionForUser(USER, 'tx-1', { categoryName: null });
    expect(upsertLearnedKeyword).not.toHaveBeenCalled();
  });

  it('จำไม่สำเร็จ → การแก้ยังสำเร็จ', async () => {
    vi.mocked(upsertLearnedKeyword).mockRejectedValue(new Error('DB ล่ม'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(updateTransactionForUser(USER, 'tx-1', { categoryName: 'อาหาร' })).resolves.toMatchObject({ id: 'tx-1' });
    spy.mockRestore();
  });
});
