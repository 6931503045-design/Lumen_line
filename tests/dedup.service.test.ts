// ไฟล์นี้ทำหน้าที่อะไร: test กฎกันรายการซ้ำตาม SPEC §S10
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// ⚖️ กฎเหล็ก G1 (ห้ามมี AI ในการตัดสิน)
//
// SPEC ปิดท้าย §S10 ว่า "ห้ามรวมรายการอัตโนมัติด้วยเงื่อนไขอื่นนอกจากนี้
// การรวมผิดทำให้ข้อมูลหายแบบไม่มีร่องรอย" — เทสชุดนี้จึงพิสูจน์ทั้งสองทาง:
// ที่ควรจับว่าซ้ำต้องจับได้ และที่ไม่ควรจับต้องปล่อยผ่าน

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/transactions', () => ({
  findTransactionByRefNumber: vi.fn(),
  findSimilarTransaction: vi.fn(),
}));

import {
  findSimilarTransaction,
  findTransactionByRefNumber,
} from '../src/db/queries/transactions';
import { checkDuplicate } from '../src/services/dedup.service';

const BASE = {
  userId: 'u1',
  type: 'expense' as const,
  amountSatang: 12550,
  occurredAt: new Date('2026-09-14T10:00:00+07:00'),
  refNumber: null as string | null,
};

beforeEach(() => {
  // ต้องล้างประวัติการเรียกด้วย ไม่ใช่แค่ตั้งค่าที่จะคืน ไม่งั้นเทสที่เช็ค
  // "ไม่ถูกเรียก" จะเห็นการเรียกที่ค้างมาจากเทสก่อนหน้า
  vi.clearAllMocks();
  vi.mocked(findTransactionByRefNumber).mockResolvedValue(null);
  vi.mocked(findSimilarTransaction).mockResolvedValue(null);
});

describe('เงื่อนไขที่ 1 — ref_number เท่ากัน = ซ้ำแน่นอน', () => {
  it('เจอ ref_number เดิมแล้วตอบ exact', async () => {
    vi.mocked(findTransactionByRefNumber).mockResolvedValue({
      id: 'tx-เดิม', amount: '125.50', type: 'expense',
      occurred_at: '2026-09-14T03:00:00Z', ref_number: 'KB999',
    });

    const verdict = await checkDuplicate({ ...BASE, refNumber: 'KB999' });
    expect(verdict).toEqual({ kind: 'exact', transactionId: 'tx-เดิม' });
  });

  it('ไม่มี ref_number ส่งมาก็ไม่ต้องไปถาม DB เรื่องนี้', async () => {
    await checkDuplicate({ ...BASE, refNumber: null });
    expect(findTransactionByRefNumber).not.toHaveBeenCalled();
  });

  it('ตรวจ ref_number ก่อนเงื่อนไขเวลาเสมอ เพราะแม่นกว่า', async () => {
    vi.mocked(findTransactionByRefNumber).mockResolvedValue({
      id: 'tx-ref', amount: '125.50', type: 'expense',
      occurred_at: '2026-09-14T03:00:00Z', ref_number: 'KB999',
    });

    const verdict = await checkDuplicate({ ...BASE, refNumber: 'KB999' });
    expect(verdict.kind).toBe('exact');
    expect(findSimilarTransaction).not.toHaveBeenCalled();
  });
});

describe('เงื่อนไขที่ 2 — ยอด + ประเภท + ภายใน 30 นาที = น่าจะซ้ำ', () => {
  it('เจอรายการใกล้เคียงแล้วตอบ probable พร้อมบอกว่ารายการเดิมมี ref หรือยัง', async () => {
    vi.mocked(findSimilarTransaction).mockResolvedValue({
      id: 'tx-ใกล้เคียง', amount: '125.50', type: 'expense',
      occurred_at: '2026-09-14T02:50:00Z', ref_number: null,
    });

    const verdict = await checkDuplicate(BASE);
    expect(verdict).toEqual({
      kind: 'probable',
      transactionId: 'tx-ใกล้เคียง',
      existingRefNumber: null,
    });
  });

  it('ค้นหาด้วยยอดในรูป numeric(12,2) ไม่ใช่สตางค์ดิบ', async () => {
    await checkDuplicate({ ...BASE, amountSatang: 8000 });
    expect(findSimilarTransaction).toHaveBeenCalledWith(
      'u1', 'expense', '80.00', expect.any(String), expect.any(String)
    );
  });

  it('ช่วงเวลาที่ค้นกว้าง 30 นาทีทั้งก่อนและหลัง', async () => {
    await checkDuplicate(BASE);
    const [, , , fromIso, toIso] = vi.mocked(findSimilarTransaction).mock.calls[0]!;
    expect(new Date(fromIso).toISOString()).toBe('2026-09-14T02:30:00.000Z');
    expect(new Date(toIso).toISOString()).toBe('2026-09-14T03:30:00.000Z');
  });
});

describe('ไม่ซ้ำ', () => {
  it('ไม่เจออะไรเลยตอบ unique', async () => {
    expect(await checkDuplicate(BASE)).toEqual({ kind: 'unique' });
  });

  it('ยอดต่างกันแม้แค่สตางค์เดียวก็ไม่ใช่ซ้ำ — DB หาไม่เจอเพราะเทียบเป๊ะ', async () => {
    await checkDuplicate({ ...BASE, amountSatang: 12551 });
    expect(findSimilarTransaction).toHaveBeenCalledWith(
      'u1', 'expense', '125.51', expect.any(String), expect.any(String)
    );
    expect(await checkDuplicate({ ...BASE, amountSatang: 12551 })).toEqual({ kind: 'unique' });
  });

  it('ประเภทต่างกันถูกส่งไปค้นแยก ไม่ปนกัน', async () => {
    await checkDuplicate({ ...BASE, type: 'income' });
    expect(findSimilarTransaction).toHaveBeenCalledWith(
      'u1', 'income', expect.any(String), expect.any(String), expect.any(String)
    );
  });
});
