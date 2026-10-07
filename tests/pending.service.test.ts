// ไฟล์นี้ทำหน้าที่อะไร: test วงจรคำขอรอยืนยัน — หัวใจของกฎ G2
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S12 ข้อกำหนดทั้ง 6 ข้อ
// ⚖️ กฎเหล็ก G2, G6
//
// 🔴 สิ่งที่เทสต์ชุดนี้ต้องพิสูจน์ให้ได้ มี 3 ข้อ:
//   1. ไม่กดยืนยัน = ไม่มีอะไรถูกเขียนลงฐานข้อมูลเลย (G2)
//   2. กดยืนยันสองครั้ง = บันทึกครั้งเดียว (ไม่เกิดรายการซ้ำ)
//   3. บันทึกจริงล้มเหลวหลังจองแถว = แถวต้องกลับเป็น waiting ให้กดใหม่ได้
//      ข้อนี้สำคัญที่สุด เพราะถ้าพลาด เงินของผู้ใช้จะ "หาย" คือเขาคิดว่าจดแล้ว
//      แต่ไม่มีรายการ และกดยืนยันอีกครั้งก็ไม่ได้เพราะสถานะค้าง

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/pending', () => ({
  insertPendingAction: vi.fn(),
  claimPendingAction: vi.fn(),
  cancelPendingAction: vi.fn(),
  releasePendingAction: vi.fn(),
  getPendingActionOwnedByUser: vi.fn(),
}));

vi.mock('../src/services/transaction.service', () => ({
  createTransaction: vi.fn(),
  updateTransactionForUser: vi.fn(),
  deleteTransactionForUser: vi.fn(),
  TransactionError: class TransactionError extends Error {},
}));

vi.mock('../src/services/recurring.service', () => ({
  createRecurringRule: vi.fn(),
  RecurringError: class RecurringError extends Error {},
}));

import {
  cancelPendingAction,
  claimPendingAction,
  insertPendingAction,
  releasePendingAction,
} from '../src/db/queries/pending';
import {
  createTransaction,
  deleteTransactionForUser,
  updateTransactionForUser,
} from '../src/services/transaction.service';
import { createRecurringRule } from '../src/services/recurring.service';
import {
  cancelPending,
  confirmPending,
  createPending,
  describePending,
  PendingError,
} from '../src/services/pending.service';

const NOW = new Date('2026-10-07T10:00:00+07:00');

const ENTRY = {
  type: 'expense' as const,
  amountSatang: 8000,
  totalSatang: 8000,
  splitCount: 1,
  item: 'กาแฟ',
  occurredAtIso: null,
  categoryName: 'อาหาร',
};

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    user_id: 'u1',
    action: 'create_transaction',
    payload: ENTRY,
    source: 'chat',
    status: 'waiting',
    expires_at: '2026-10-08T10:00:00+07:00',
    created_at: '2026-10-07T10:00:00+07:00',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(insertPendingAction).mockImplementation(async (input) =>
    pendingRow({
      action: input.action,
      payload: input.payload,
      expires_at: input.expiresAt,
    }) as never
  );
  vi.mocked(createTransaction).mockResolvedValue({
    id: 'tx1',
    amountSatang: 8000,
    type: 'expense',
    occurredAt: '2026-10-07T03:00:00Z',
    budgetAlert: null,
  } as never);
});

describe('createPending — สร้างคำขอโดยไม่แตะข้อมูลจริง (G2)', () => {
  it('คืน id และวันหมดอายุ 24 ชั่วโมงถัดไป', async () => {
    const created = await createPending({
      userId: 'u1',
      action: 'create_transaction',
      payload: ENTRY,
      source: 'chat',
      now: NOW,
    });

    expect(created.id).toBe('p1');
    expect(created.expiresAt).toBe('2026-10-08T03:00:00.000Z');
  });

  it('🔴 สร้างคำขอแล้วต้องไม่มีการเขียนรายการเงินเลย', async () => {
    await createPending({
      userId: 'u1',
      action: 'create_transaction',
      payload: ENTRY,
      source: 'chat',
      now: NOW,
    });

    expect(createTransaction).not.toHaveBeenCalled();
    expect(updateTransactionForUser).not.toHaveBeenCalled();
    expect(deleteTransactionForUser).not.toHaveBeenCalled();
    expect(createRecurringRule).not.toHaveBeenCalled();
  });

  it('⚖️ G6: userId ถูกส่งต่อไปที่ชั้น query', async () => {
    await createPending({
      userId: 'u-เฉพาะคนนี้',
      action: 'create_transaction',
      payload: ENTRY,
      source: 'chat',
      now: NOW,
    });
    expect(insertPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-เฉพาะคนนี้' })
    );
  });

  it('payload ที่รูปร่างผิดถูกปฏิเสธก่อนเขียนลง DB', async () => {
    await expect(
      createPending({
        userId: 'u1',
        action: 'create_transaction',
        payload: { type: 'expense', amountSatang: -1 },
        source: 'chat',
        now: NOW,
      })
    ).rejects.toBeInstanceOf(PendingError);
    expect(insertPendingAction).not.toHaveBeenCalled();
  });

  it('payload ที่มียอดเป็นทศนิยม (ไม่ใช่สตางค์เต็ม) ถูกปฏิเสธ — G3', async () => {
    await expect(
      createPending({
        userId: 'u1',
        action: 'create_transaction',
        payload: { ...ENTRY, amountSatang: 80.5 },
        source: 'chat',
        now: NOW,
      })
    ).rejects.toBeInstanceOf(PendingError);
  });
});

describe('confirmPending — จุดเดียวที่คำขอกลายเป็นข้อมูลจริง', () => {
  it('จองได้แล้วบันทึกจริง', async () => {
    vi.mocked(claimPendingAction).mockResolvedValue(pendingRow() as never);

    const outcome = await confirmPending('u1', 'p1', NOW);

    expect(outcome.kind).toBe('done');
    expect(outcome.kind === 'done' && outcome.transactionId).toBe('tx1');
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        amountSatang: 8000,
        categoryName: 'อาหาร',
        note: 'กาแฟ',
        source: 'chat',
        parsedBy: 'ai',
      })
    );
  });

  it('🔴 กดซ้ำ — จองไม่ได้ครั้งที่สอง จึงบันทึกครั้งเดียว', async () => {
    vi.mocked(claimPendingAction)
      .mockResolvedValueOnce(pendingRow() as never)
      .mockResolvedValueOnce(null);

    const first = await confirmPending('u1', 'p1', NOW);
    const second = await confirmPending('u1', 'p1', NOW);

    expect(first.kind).toBe('done');
    expect(second.kind).toBe('already');
    expect(createTransaction).toHaveBeenCalledTimes(1);
  });

  it('คำขอหมดอายุ — claim คืน null เพราะเงื่อนไข expires_at ไม่ผ่าน', async () => {
    vi.mocked(claimPendingAction).mockResolvedValue(null);

    const outcome = await confirmPending('u1', 'p1', NOW);

    expect(outcome.kind).toBe('already');
    expect(outcome.text).toContain('24 ชั่วโมง');
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('⚖️ G6: ส่ง userId และเวลาปัจจุบันลงไปให้ claim ตรวจเจ้าของพร้อมกัน', async () => {
    vi.mocked(claimPendingAction).mockResolvedValue(pendingRow() as never);
    await confirmPending('u1', 'p1', NOW);
    expect(claimPendingAction).toHaveBeenCalledWith('p1', 'u1', NOW.toISOString());
  });

  it('🔴 บันทึกจริงล้มเหลวหลังจอง → คืนสถานะเป็น waiting ให้กดใหม่ได้', async () => {
    vi.mocked(claimPendingAction).mockResolvedValue(pendingRow() as never);
    vi.mocked(createTransaction).mockRejectedValue(new Error('DB ล่ม'));

    const outcome = await confirmPending('u1', 'p1', NOW);

    expect(outcome.kind).toBe('failed');
    expect(releasePendingAction).toHaveBeenCalledWith('p1', 'u1');
  });

  it('payload ที่เสียหายไม่ทำให้ระบบพัง — ตอบเป็น failed', async () => {
    vi.mocked(claimPendingAction).mockResolvedValue(
      pendingRow({ payload: { ไม่มีอะไรเลย: true } }) as never
    );

    const outcome = await confirmPending('u1', 'p1', NOW);

    expect(outcome.kind).toBe('failed');
    expect(createTransaction).not.toHaveBeenCalled();
    expect(releasePendingAction).toHaveBeenCalled();
  });
});

describe('confirmPending — ชนิดคำขออื่น', () => {
  it('batch บันทึกทุกรายการ', async () => {
    vi.mocked(claimPendingAction).mockResolvedValue(
      pendingRow({
        action: 'create_transaction_batch',
        payload: { entries: [ENTRY, { ...ENTRY, item: 'ข้าว', amountSatang: 6000, totalSatang: 6000 }] },
      }) as never
    );

    const outcome = await confirmPending('u1', 'p1', NOW);

    expect(outcome.kind).toBe('done');
    expect(createTransaction).toHaveBeenCalledTimes(2);
    expect(outcome.text).toContain('2 รายการ');
  });

  it('แก้รายการ — ชื่อรายการลงช่อง note และวันที่เป็นเที่ยงวันไทย', async () => {
    vi.mocked(updateTransactionForUser).mockResolvedValue({} as never);
    vi.mocked(claimPendingAction).mockResolvedValue(
      pendingRow({
        action: 'update_transaction',
        payload: {
          transactionId: 'tx9',
          changes: { amountSatang: 9000, item: 'ลาเต้', occurredAtIso: '2026-10-06' },
          before: { amountSatang: 8000, item: 'กาแฟ', occurredAtIso: '2026-10-07T03:00:00Z' },
        },
      }) as never
    );

    await confirmPending('u1', 'p1', NOW);

    expect(updateTransactionForUser).toHaveBeenCalledWith('u1', 'tx9', {
      amountSatang: 9000,
      note: 'ลาเต้',
      occurredAt: new Date('2026-10-06T12:00:00+07:00'),
    });
  });

  it('ลบรายการ', async () => {
    vi.mocked(deleteTransactionForUser).mockResolvedValue(undefined as never);
    vi.mocked(claimPendingAction).mockResolvedValue(
      pendingRow({
        action: 'delete_transaction',
        payload: {
          transactionId: 'tx9',
          before: { amountSatang: 8000, item: 'กาแฟ', occurredAtIso: '2026-10-07T03:00:00Z' },
        },
      }) as never
    );

    const outcome = await confirmPending('u1', 'p1', NOW);

    expect(deleteTransactionForUser).toHaveBeenCalledWith('u1', 'tx9');
    expect(outcome.kind === 'done' && outcome.transactionId).toBe('tx9');
  });

  it('ตั้งรายการประจำ', async () => {
    vi.mocked(createRecurringRule).mockResolvedValue({
      label: 'ค่าหอ',
      nextRun: '2026-11-05',
    } as never);
    vi.mocked(claimPendingAction).mockResolvedValue(
      pendingRow({
        action: 'create_recurring',
        payload: {
          label: 'ค่าหอ',
          type: 'expense',
          amountSatang: 350000,
          frequency: 'monthly',
          dayOfMonth: 5,
          dayOfWeek: null,
        },
      }) as never
    );

    const outcome = await confirmPending('u1', 'p1', NOW);

    expect(createRecurringRule).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', label: 'ค่าหอ', amountSatang: 350000 })
    );
    expect(outcome.text).toContain('2026-11-05');
  });
});

describe('cancelPending', () => {
  it('ยกเลิกสำเร็จ ไม่มีอะไรถูกบันทึก', async () => {
    vi.mocked(cancelPendingAction).mockResolvedValue(pendingRow({ status: 'cancelled' }) as never);

    const outcome = await cancelPending('u1', 'p1');

    expect(outcome.kind).toBe('done');
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('กดยกเลิกซ้ำไม่เกิดผลซ้ำ', async () => {
    vi.mocked(cancelPendingAction).mockResolvedValue(null);
    const outcome = await cancelPending('u1', 'p1');
    expect(outcome.kind).toBe('already');
  });
});

describe('describePending — ข้อความที่ผู้ใช้อ่านก่อนกดยืนยัน', () => {
  it('🔴 กรณีหารบิล ต้องโชว์ยอดที่จะบันทึกจริง ไม่ใช่ยอดเต็ม', () => {
    // ถ้าโชว์ 300 แต่บันทึก 100 การกดยืนยันของผู้ใช้ไม่มีความหมายตาม G2
    const text = describePending('create_transaction', {
      ...ENTRY,
      amountSatang: 10000,
      totalSatang: 30000,
      splitCount: 3,
      item: 'ค่าข้าว',
    });

    expect(text).toContain('฿100.00');
    expect(text).toContain('หาร 3 คน');
    expect(text).toContain('฿300.00');
  });

  it('รายจ่ายธรรมดาโชว์ยอด หมวด และคำชวนกดยืนยัน', () => {
    const text = describePending('create_transaction', ENTRY);
    expect(text).toContain('รายจ่าย');
    expect(text).toContain('฿80.00');
    expect(text).toContain('อาหาร');
    expect(text).toContain('กดยืนยัน');
  });

  it('แก้รายการโชว์ "ก่อน → หลัง" ตาม §S12', () => {
    const text = describePending('update_transaction', {
      transactionId: 'tx9',
      changes: { amountSatang: 9000 },
      before: { amountSatang: 8000, item: 'กาแฟ', occurredAtIso: '2026-10-07T03:00:00Z' },
    });

    expect(text).toContain('฿80.00');
    expect(text).toContain('฿90.00');
    expect(text).toContain('→');
  });

  it('ลบรายการโชว์ว่าจะลบอะไร และบอกว่ากู้คืนได้', () => {
    const text = describePending('delete_transaction', {
      transactionId: 'tx9',
      before: { amountSatang: 8000, item: 'กาแฟ', occurredAtIso: '2026-10-07T03:00:00Z' },
    });

    expect(text).toContain('กาแฟ');
    expect(text).toContain('฿80.00');
    expect(text).toContain('เอากลับคืนได้');
  });

  it('รายการประจำโชว์ความถี่เป็นภาษาคน', () => {
    const monthly = describePending('create_recurring', {
      label: 'ค่าหอ',
      type: 'expense',
      amountSatang: 350000,
      frequency: 'monthly',
      dayOfMonth: 5,
      dayOfWeek: null,
    });
    expect(monthly).toContain('ทุกวันที่ 5 ของเดือน');

    const weekly = describePending('create_recurring', {
      label: 'ค่ารถ',
      type: 'expense',
      amountSatang: 10000,
      frequency: 'weekly',
      dayOfMonth: null,
      dayOfWeek: 1,
    });
    expect(weekly).toContain('ทุกวันจันทร์');
  });

  it('batch โชว์ทุกรายการ ไม่ใช่แค่จำนวน', () => {
    const text = describePending('create_transaction_batch', {
      entries: [ENTRY, { ...ENTRY, item: 'ข้าว', amountSatang: 6000, totalSatang: 6000 }],
    });
    expect(text).toContain('กาแฟ');
    expect(text).toContain('ข้าว');
  });
});
