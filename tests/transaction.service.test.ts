// ไฟล์นี้ทำหน้าที่อะไร: test การแก้ไข/ลบ/กู้คืนรายการเงินจากหน้าเว็บ
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G3, G6
//
// mock ชั้น db ทิ้งทั้งหมด เพราะสิ่งที่ต้องพิสูจน์คือ "ตรวจค่าก่อนเขียนครบไหม"
// และ "ส่ง patch ไปถูกไหม" ไม่ใช่ "Supabase อัปเดตได้ไหม"

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/transactions', () => ({
  insertTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  getTransactionDetail: vi.fn(),
  softDeleteTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
}));
vi.mock('../src/db/queries/categories', () => ({
  findOrCreateCategory: vi.fn(),
}));
vi.mock('../src/services/budget.service', () => ({
  evaluateBudgetAlert: vi.fn(),
}));

import {
  getTransactionDetail,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
} from '../src/db/queries/transactions';
import { findOrCreateCategory } from '../src/db/queries/categories';
import { evaluateBudgetAlert } from '../src/services/budget.service';
import {
  deleteTransactionForUser,
  restoreTransactionForUser,
  TransactionError,
  updateTransactionForUser,
} from '../src/services/transaction.service';

const USER = 'user-1';
const TX = 'tx-1';

function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: TX,
    type: 'expense',
    category_id: 'cat-food',
    occurred_at: '2026-09-17T03:00:00Z',
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function updated(overrides: Record<string, unknown> = {}) {
  return {
    id: TX,
    amount: '80.00',
    type: 'expense',
    occurred_at: '2026-09-17T03:00:00Z',
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTransactionDetail).mockResolvedValue(existing());
  vi.mocked(updateTransaction).mockResolvedValue(updated());
  vi.mocked(evaluateBudgetAlert).mockResolvedValue(null);
  vi.mocked(findOrCreateCategory).mockResolvedValue('cat-new');
});

describe('updateTransactionForUser — การตรวจก่อนเขียน', () => {
  it('G3: ปฏิเสธจำนวนเงิน 0 หรือติดลบ และไม่แตะ DB', async () => {
    await expect(updateTransactionForUser(USER, TX, { amountSatang: 0 }))
      .rejects.toBeInstanceOf(TransactionError);
    await expect(updateTransactionForUser(USER, TX, { amountSatang: -1 }))
      .rejects.toBeInstanceOf(TransactionError);
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('G3: ปฏิเสธจำนวนเงินที่ไม่ใช่จำนวนเต็มสตางค์', async () => {
    await expect(updateTransactionForUser(USER, TX, { amountSatang: 80.5 }))
      .rejects.toBeInstanceOf(TransactionError);
  });

  it('ปฏิเสธจำนวนเงินเกินเพดานของตาราง', async () => {
    await expect(updateTransactionForUser(USER, TX, { amountSatang: 1_000_000_001 }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('ยังไม่รองรับการเปลี่ยนเป็น transfer', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(updateTransactionForUser(USER, TX, { type: 'transfer' as any }))
      .rejects.toMatchObject({ status: 400 });
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('G6: รายการที่ไม่ใช่ของผู้ใช้คนนี้ → 404 และไม่แตะ DB', async () => {
    vi.mocked(getTransactionDetail).mockResolvedValue(null);
    await expect(updateTransactionForUser(USER, TX, { amountSatang: 8000 }))
      .rejects.toMatchObject({ status: 404 });
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('แถวหายไประหว่างทาง (แข่งกับการลบ) → 404 ไม่ใช่ครash', async () => {
    vi.mocked(updateTransaction).mockResolvedValue(null);
    await expect(updateTransactionForUser(USER, TX, { amountSatang: 8000 }))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('updateTransactionForUser — patch ที่ส่งไปถึง DB', () => {
  it('ส่งเฉพาะฟิลด์ที่ขอแก้ ไม่ไปทับฟิลด์อื่นด้วย undefined', async () => {
    await updateTransactionForUser(USER, TX, { amountSatang: 12000 });
    expect(updateTransaction).toHaveBeenCalledWith(TX, USER, { amountSatang: 12000 });
  });

  it('categoryName: null = ล้างหมวด ไม่ใช่ไปสร้างหมวดชื่อ "null"', async () => {
    await updateTransactionForUser(USER, TX, { categoryName: null });
    expect(findOrCreateCategory).not.toHaveBeenCalled();
    expect(updateTransaction).toHaveBeenCalledWith(TX, USER, { categoryId: null });
  });

  it('เปลี่ยนหมวด → สร้าง/หาหมวดของผู้ใช้คนนั้นก่อน', async () => {
    await updateTransactionForUser(USER, TX, { categoryName: 'กาแฟ' });
    expect(findOrCreateCategory).toHaveBeenCalledWith(USER, 'กาแฟ', 'expense');
    expect(updateTransaction).toHaveBeenCalledWith(TX, USER, { categoryId: 'cat-new' });
  });

  it('🔴 ย้ายรายจ่ายเป็นรายรับ → หมวดต้องเป็นหมวด "รายรับ" ไม่ใช่ประเภทเดิม', async () => {
    // เคยเขียนเป็น `input.type ?? existing.type === 'income' ? ... : ...` ซึ่ง
    // ลำดับการคำนวณทำให้กลายเป็น (type ?? boolean) แล้วได้ 'income' เสมอ
    vi.mocked(updateTransaction).mockResolvedValue(updated({ type: 'income' }));
    await updateTransactionForUser(USER, TX, { type: 'income', categoryName: 'เงินเดือน' });
    expect(findOrCreateCategory).toHaveBeenCalledWith(USER, 'เงินเดือน', 'income');
  });

  it('ไม่ได้ส่ง type มาแต่เปลี่ยนหมวด → ใช้ประเภทเดิมของรายการ', async () => {
    vi.mocked(getTransactionDetail).mockResolvedValue(existing({ type: 'income' }));
    await updateTransactionForUser(USER, TX, { categoryName: 'รายได้เสริม' });
    expect(findOrCreateCategory).toHaveBeenCalledWith(USER, 'รายได้เสริม', 'income');
  });

  it('แปลงวันที่เป็น ISO ก่อนส่งลง DB', async () => {
    const when = new Date('2026-09-01T10:00:00+07:00');
    await updateTransactionForUser(USER, TX, { occurredAt: when });
    expect(updateTransaction).toHaveBeenCalledWith(TX, USER, { occurredAt: when.toISOString() });
  });

  it('G3: คืนยอดเป็นสตางค์ ไม่ใช่ numeric string จาก DB', async () => {
    vi.mocked(updateTransaction).mockResolvedValue(updated({ amount: '1250.50' }));
    const result = await updateTransactionForUser(USER, TX, { amountSatang: 125050 });
    expect(result.amountSatang).toBe(125050);
  });
});

describe('updateTransactionForUser — การเตือนงบหลังแก้', () => {
  it('แก้ยอดจนข้ามเกณฑ์ → คืน budgetAlert มาด้วย', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(evaluateBudgetAlert).mockResolvedValue({ threshold: 80 } as any);
    const result = await updateTransactionForUser(USER, TX, { amountSatang: 250000 });
    expect(result.budgetAlert).toMatchObject({ threshold: 80 });
  });

  it('เช็คงบด้วยหมวดใหม่ ไม่ใช่หมวดเดิม', async () => {
    await updateTransactionForUser(USER, TX, { categoryName: 'ช้อปปิ้ง' });
    expect(evaluateBudgetAlert).toHaveBeenCalledWith(USER, 'cat-new', expect.any(Date));
  });

  it('ไม่ได้แตะหมวด → เช็คงบด้วยหมวดเดิม', async () => {
    await updateTransactionForUser(USER, TX, { amountSatang: 9000 });
    expect(evaluateBudgetAlert).toHaveBeenCalledWith(USER, 'cat-food', expect.any(Date));
  });

  it('เช็คงบพังต้องไม่ทำให้การแก้ไขพัง (แก้ไปแล้วจริง)', async () => {
    vi.mocked(evaluateBudgetAlert).mockRejectedValue(new Error('DB ล่ม'));
    const result = await updateTransactionForUser(USER, TX, { amountSatang: 9000 });
    expect(result.budgetAlert).toBeNull();
    expect(result.id).toBe(TX);
  });
});

describe('deleteTransactionForUser / restoreTransactionForUser', () => {
  it('ลบสำเร็จ', async () => {
    vi.mocked(softDeleteTransaction).mockResolvedValue(true);
    await expect(deleteTransactionForUser(USER, TX)).resolves.toBeUndefined();
    expect(softDeleteTransaction).toHaveBeenCalledWith(TX, USER);
  });

  it('G6: ไม่เจอ หรือไม่ใช่ของผู้ใช้ หรือถูกลบไปแล้ว → 404', async () => {
    vi.mocked(softDeleteTransaction).mockResolvedValue(false);
    await expect(deleteTransactionForUser(USER, TX)).rejects.toMatchObject({ status: 404 });
  });

  it('กู้คืนสำเร็จ', async () => {
    vi.mocked(restoreTransaction).mockResolvedValue(true);
    await expect(restoreTransactionForUser(USER, TX)).resolves.toBeUndefined();
  });

  it('กู้คืนรายการที่ไม่มีอยู่ → 404', async () => {
    vi.mocked(restoreTransaction).mockResolvedValue(false);
    await expect(restoreTransactionForUser(USER, TX)).rejects.toMatchObject({ status: 404 });
  });
});
