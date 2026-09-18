// ไฟล์นี้ทำหน้าที่อะไร: test การโอนเงินเข้าแผนออม (S5.6)
// ใครรับผิดชอบ: ③ AI (ไม่มี AI ในเส้นทางนี้)
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G3, G6, G7

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/supabase', () => ({ supabase: {} }));
vi.mock('../src/db/queries/plans', () => ({
  findPlanOwnedByUser: vi.fn(),
  listPlanTransferRows: vi.fn(),
  transitionPlanStatus: vi.fn(),
  listPlansByUser: vi.fn(),
  insertDraftPlans: vi.fn(),
  cancelDraftPlans: vi.fn(),
  listActivePlansAllUsers: vi.fn(),
  listTransferRowsForPlans: vi.fn(),
}));
vi.mock('../src/services/transaction.service', () => ({ createTransaction: vi.fn() }));

import {
  findPlanOwnedByUser,
  listPlanTransferRows,
  transitionPlanStatus,
} from '../src/db/queries/plans';
import { createTransaction } from '../src/services/transaction.service';
import { PlanError, transferToPlan } from '../src/services/plan.service';

const USER = 'user-1';
const PLAN = 'plan-1';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN,
    title: 'iPhone',
    target_amount: '30000.00',
    target_date: '2027-06-14',
    monthly_save: '3000.00',
    status: 'active',
    confidence: 'high',
    created_at: '2026-08-18T00:00:00Z',
    confirmed_at: '2026-08-18T00:00:00Z',
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findPlanOwnedByUser).mockResolvedValue(plan());
  vi.mocked(listPlanTransferRows).mockResolvedValue([{ plan_id: PLAN, amount: '3000.00' }]);
  vi.mocked(transitionPlanStatus).mockResolvedValue(plan({ status: 'completed' }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createTransaction).mockResolvedValue({ id: 'tx-1' } as any);
});

describe('transferToPlan — การตรวจก่อนเขียน', () => {
  it('G3: ปฏิเสธยอด 0 ติดลบ หรือไม่ใช่จำนวนเต็ม และไม่แตะ DB', async () => {
    for (const amount of [0, -100, 1.5]) {
      await expect(transferToPlan(USER, PLAN, amount)).rejects.toBeInstanceOf(PlanError);
    }
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('ปฏิเสธยอดเกินเพดานของตาราง', async () => {
    await expect(transferToPlan(USER, PLAN, 1_000_000_001)).rejects.toMatchObject({ status: 400 });
  });

  it('G6: แผนที่ไม่ใช่ของผู้ใช้คนนี้ → 404 และไม่สร้างรายการ', async () => {
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(null);
    await expect(transferToPlan(USER, PLAN, 100000)).rejects.toMatchObject({ status: 404 });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('แผน draft ที่ยังไม่ยืนยัน → บอกให้ยืนยันก่อน', async () => {
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(plan({ status: 'draft' }));
    await expect(transferToPlan(USER, PLAN, 100000)).rejects.toMatchObject({ status: 409 });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('แผนที่ปิดไปแล้ว → โอนเข้าไม่ได้', async () => {
    for (const status of ['completed', 'cancelled']) {
      vi.mocked(findPlanOwnedByUser).mockResolvedValue(plan({ status }));
      await expect(transferToPlan(USER, PLAN, 100000)).rejects.toMatchObject({ status: 409 });
    }
  });
});

describe('transferToPlan — รายการที่บันทึก', () => {
  it('⚖️ G7: บันทึกเป็น transfer ผูก plan_id ไม่ใช่ expense', async () => {
    await transferToPlan(USER, PLAN, 150000);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        type: 'transfer',
        amountSatang: 150000,
        planId: PLAN,
      })
    );
  });

  it('ไม่ส่ง categoryName ไปด้วย — transfer ไม่เข้าหมวดไหน', async () => {
    await transferToPlan(USER, PLAN, 150000);
    const input = vi.mocked(createTransaction).mock.calls[0]![0];
    expect(input.categoryName).toBeUndefined();
  });

  it('ใส่ note บอกว่าโอนเข้าแผนไหน เพื่อให้รายการอ่านรู้เรื่อง', async () => {
    await transferToPlan(USER, PLAN, 150000);
    expect(vi.mocked(createTransaction).mock.calls[0]![0].note).toContain('iPhone');
  });
});

describe('transferToPlan — ความคืบหน้าหลังโอน', () => {
  it('อ่านยอดสะสมใหม่จาก DB ไม่ใช่บวกเอาเองจากยอดเดิม', async () => {
    vi.mocked(listPlanTransferRows).mockResolvedValue([
      { plan_id: PLAN, amount: '3000.00' },
      { plan_id: PLAN, amount: '1500.50' },
    ]);
    const result = await transferToPlan(USER, PLAN, 150050);
    expect(listPlanTransferRows).toHaveBeenCalledWith(USER);
    expect(result.progress.savedSatang).toBe(450050);
  });

  it('นับเฉพาะยอดของแผนนี้ ไม่ปนกับแผนอื่นของคนเดียวกัน', async () => {
    vi.mocked(listPlanTransferRows).mockResolvedValue([
      { plan_id: PLAN, amount: '3000.00' },
      { plan_id: 'plan-อื่น', amount: '99999.00' },
    ]);
    const result = await transferToPlan(USER, PLAN, 100000);
    expect(result.progress.savedSatang).toBe(300000);
  });

  it('ยังไม่ครบเป้า → justCompleted = false และไม่ปิดแผน', async () => {
    const result = await transferToPlan(USER, PLAN, 100000);
    expect(result.justCompleted).toBe(false);
    expect(transitionPlanStatus).not.toHaveBeenCalled();
  });

  it('ครบเป้าพอดี → ปิดแผนทันที ไม่ต้องรอ job รอบเช้า', async () => {
    vi.mocked(listPlanTransferRows).mockResolvedValue([{ plan_id: PLAN, amount: '30000.00' }]);
    const result = await transferToPlan(USER, PLAN, 3000000);
    expect(result.justCompleted).toBe(true);
    expect(result.progress.status).toBe('completed');
    expect(transitionPlanStatus).toHaveBeenCalledWith(USER, PLAN, 'active', 'completed');
  });

  it('🔴 แพ้การแข่งกับ job ที่ปิดแผนไปก่อน → justCompleted = false จะได้ไม่ยินดีซ้ำ', async () => {
    vi.mocked(listPlanTransferRows).mockResolvedValue([{ plan_id: PLAN, amount: '30000.00' }]);
    vi.mocked(transitionPlanStatus).mockResolvedValue(null);
    const result = await transferToPlan(USER, PLAN, 3000000);
    expect(result.justCompleted).toBe(false);
  });

  it('โอนเกินเป้าก็ยังถือว่าครบ ไม่ใช่ error', async () => {
    vi.mocked(listPlanTransferRows).mockResolvedValue([{ plan_id: PLAN, amount: '35000.00' }]);
    const result = await transferToPlan(USER, PLAN, 500000);
    expect(result.justCompleted).toBe(true);
    expect(result.progress.remainingSatang).toBe(0);
  });
});
