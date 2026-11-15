// ไฟล์นี้ทำหน้าที่อะไร: test การบันทึกหลายรายการจากข้อความเดียวในทางด่วน (ไม่ผ่าน AI)
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G2, G3, G4
//
// "ข้าว 50 กาแฟ 40" ยอดชัดทุกตัว ผู้ใช้พิมพ์เองทั้งหมด → บันทึกเลยเหมือนรายการเดียว (ไม่ต้องรอยืนยัน)
// สิ่งที่ต้องพิสูจน์: บันทึกครบทุกรายการ, พังบางรายการต้องบอกผู้ใช้, พังหมดต้องไม่บอกว่าสำเร็จ

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/users', () => ({ getUserIdByLineUserId: vi.fn() }));
vi.mock('../src/line/client', () => ({ lineClient: { showLoadingAnimation: vi.fn() } }));
vi.mock('../src/line/reply', () => ({
  replyText: vi.fn(),
  replyTextWithQuickReply: vi.fn(),
  replyFlex: vi.fn(),
}));
vi.mock('../src/services/transaction.service', () => ({ createTransaction: vi.fn() }));
vi.mock('../src/services/ai/router', () => ({
  interpretUserMessage: vi.fn(),
  resolveCategory: vi.fn(),
  FALLBACK_EXPENSE_CATEGORY: 'อื่นๆ',
}));
vi.mock('../src/services/category.service', () => ({ listTopCategories: vi.fn() }));

import { getUserIdByLineUserId } from '../src/db/queries/users';
import { createTransaction } from '../src/services/transaction.service';
import { interpretUserMessage, resolveCategory } from '../src/services/ai/router';
import { replyFlex } from '../src/line/reply';
import { handleText } from '../src/handlers/textHandler';

function send(text: string) {
  return handleText({ replyToken: 'tok', source: { userId: 'U1' }, message: { type: 'text', text } });
}

let seq = 0;
beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  vi.mocked(getUserIdByLineUserId).mockResolvedValue('user-1');
  vi.mocked(resolveCategory).mockImplementation(async (_u, item) =>
    item === 'ข้าว' || item === 'กาแฟ' ? { name: 'อาหาร', source: 'dictionary' } : null
  );
  vi.mocked(createTransaction).mockImplementation(async (input) => ({
    id: `t${++seq}`,
    amountSatang: input.amountSatang,
    type: input.type,
    occurredAt: '2026-11-15T05:00:00.000Z',
    budgetAlert: null,
    budgetStatus: null,
  }));
});

describe('หลายรายการในข้อความเดียว', () => {
  it('บันทึกครบทุกรายการตามลำดับ ไม่ส่งให้ AI และตอบการ์ดใบเดียว', async () => {
    await send('ข้าว 50 กาแฟ 40 มะม่วง 30');

    const calls = vi.mocked(createTransaction).mock.calls.map(([input]) => [input.note, input.amountSatang, input.categoryName]);
    expect(calls).toEqual([
      ['ข้าว', 5000, 'อาหาร'],
      ['กาแฟ', 4000, 'อาหาร'],
      ['มะม่วง', 3000, 'อื่นๆ'],
    ]);
    expect(interpretUserMessage).not.toHaveBeenCalled();
    expect(replyFlex).toHaveBeenCalledTimes(1);
    expect(vi.mocked(replyFlex).mock.calls[0]![2]).toBeUndefined();
  });

  it('พังบางรายการ → ยังบันทึกที่เหลือ และบอกผู้ใช้ว่าขาดไปกี่รายการ', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createTransaction)
      .mockImplementationOnce(async (input) => ({
        id: 't1', amountSatang: input.amountSatang, type: input.type,
        occurredAt: '2026-11-15T05:00:00.000Z', budgetAlert: null, budgetStatus: null,
      }))
      .mockRejectedValueOnce(new Error('DB ล่ม'));

    await send('ข้าว 50 กาแฟ 40');

    expect(vi.mocked(replyFlex).mock.calls[0]![2]).toContain('บันทึกไม่สำเร็จ 1 รายการ');
    spy.mockRestore();
  });

  it('พังทุกรายการ → การ์ดบันทึกไม่สำเร็จ ไม่ใช่การ์ดบันทึกแล้ว', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createTransaction).mockRejectedValue(new Error('DB ล่ม'));

    await send('ข้าว 50 กาแฟ 40');

    expect(JSON.stringify(vi.mocked(replyFlex).mock.calls[0]![1])).toContain('ไม่สำเร็จ');
    spy.mockRestore();
  });
});
