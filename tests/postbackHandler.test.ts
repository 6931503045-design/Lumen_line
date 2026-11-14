// ไฟล์นี้ทำหน้าที่อะไร: test ปุ่มในแชท LINE (postback) — undo / restore / save_to_plan / ai_confirm / ai_cancel
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G2, G6
//
// สิ่งที่ต้องพิสูจน์: postback data มาจากเครื่องผู้ใช้ ปลอมได้ทุกตัว
//   - user_id ต้องมาจาก LINE user id ของ event เท่านั้น ไม่ใช่จาก data
//   - id ของรายการคนอื่นต้องแตะไม่ได้
//   - กดซ้ำต้องไม่เกิดผลซ้ำ

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/users', () => ({ getUserIdByLineUserId: vi.fn() }));
vi.mock('../src/db/queries/transactions', () => ({
  getTransactionOwnedByUser: vi.fn(),
  softDeleteTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
}));
vi.mock('../src/line/reply', () => ({
  replyText: vi.fn(),
  replyFlex: vi.fn(),
  replyTextWithQuickReply: vi.fn(),
}));
vi.mock('../src/line/recordedView', () => ({ buildRecordedCardFor: vi.fn(() => ({ type: 'flex' })) }));
vi.mock('../src/services/pending.service', () => ({
  confirmPending: vi.fn(),
  cancelPending: vi.fn(),
}));
vi.mock('../src/services/plan.service', async (importOriginal) => ({
  PlanError: (await importOriginal<typeof import('../src/services/plan.service')>()).PlanError,
  transferToPlan: vi.fn(),
}));

vi.mock('../src/services/transaction.service', async (importOriginal) => ({
  TransactionError: (await importOriginal<typeof import('../src/services/transaction.service')>()).TransactionError,
  listCategoryChoices: vi.fn(),
  changeTransactionCategory: vi.fn(),
}));

import { handlePostback } from '../src/handlers/postbackHandler';
import {
  changeTransactionCategory,
  listCategoryChoices,
  TransactionError,
} from '../src/services/transaction.service';
import { buildRecordedCardFor } from '../src/line/recordedView';
import { getUserIdByLineUserId } from '../src/db/queries/users';
import {
  getTransactionOwnedByUser,
  restoreTransaction,
  softDeleteTransaction,
} from '../src/db/queries/transactions';
import { replyFlex, replyText, replyTextWithQuickReply } from '../src/line/reply';
import { cancelPending, confirmPending } from '../src/services/pending.service';
import { PlanError, transferToPlan } from '../src/services/plan.service';

const USER = 'user-1';

function postback(data: string, lineUserId = 'Uline-1') {
  return { replyToken: 'reply-1', source: { userId: lineUserId }, postback: { data } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(getUserIdByLineUserId).mockResolvedValue(USER);
});

describe('การหา user (G6)', () => {
  it('ใช้ LINE user id ของ event หา user — ไม่เชื่อ user ที่แอบใส่มาใน data', async () => {
    vi.mocked(getTransactionOwnedByUser).mockResolvedValue(null);

    await handlePostback(postback('action=undo&id=tx-1&userId=victim'));

    expect(getUserIdByLineUserId).toHaveBeenCalledWith('Uline-1');
    expect(getTransactionOwnedByUser).toHaveBeenCalledWith('tx-1', USER);
  });

  it('ยังไม่เคยแอดบอท → บอกให้แอดใหม่ ไม่แตะข้อมูลอะไร', async () => {
    vi.mocked(getUserIdByLineUserId).mockResolvedValue(null);

    await handlePostback(postback('action=undo&id=tx-1'));

    expect(getTransactionOwnedByUser).not.toHaveBeenCalled();
    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('แอดเพื่อน'));
  });

  it('data ไม่ครบ → ไม่ทำอะไรเลย', async () => {
    await handlePostback(postback('action=undo'));
    expect(getUserIdByLineUserId).not.toHaveBeenCalled();
  });
});

describe('undo / restore', () => {
  it('รายการไม่ใช่ของเรา (หรือไม่มีอยู่) → ตอบว่าไม่พบ และไม่ลบ', async () => {
    vi.mocked(getTransactionOwnedByUser).mockResolvedValue(null);

    await handlePostback(postback('action=undo&id=someone-elses-tx'));

    expect(softDeleteTransaction).not.toHaveBeenCalled();
    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('ไม่พบ'));
  });

  it('รายการของเรา → soft delete พร้อมปุ่มเอากลับคืน', async () => {
    vi.mocked(getTransactionOwnedByUser).mockResolvedValue({ id: 'tx-1', deleted_at: null } as never);

    await handlePostback(postback('action=undo&id=tx-1'));

    expect(softDeleteTransaction).toHaveBeenCalledWith('tx-1', USER);
    expect(replyTextWithQuickReply).toHaveBeenCalledTimes(1);
    const [, , items] = vi.mocked(replyTextWithQuickReply).mock.calls[0]!;
    expect(items[0]!.action).toMatchObject({ data: 'action=restore&id=tx-1' });
  });

  it('กดยกเลิกซ้ำ → ไม่ลบซ้ำ', async () => {
    vi.mocked(getTransactionOwnedByUser).mockResolvedValue({
      id: 'tx-1',
      deleted_at: '2026-10-31T00:00:00Z',
    } as never);

    await handlePostback(postback('action=undo&id=tx-1'));

    expect(softDeleteTransaction).not.toHaveBeenCalled();
    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('ยกเลิกไปแล้ว'));
  });

  it('restore รายการที่ยังไม่ถูกลบ → ไม่ทำอะไร', async () => {
    vi.mocked(getTransactionOwnedByUser).mockResolvedValue({ id: 'tx-1', deleted_at: null } as never);

    await handlePostback(postback('action=restore&id=tx-1'));

    expect(restoreTransaction).not.toHaveBeenCalled();
  });

  it('restore รายการที่ถูกลบ → เอากลับคืน', async () => {
    vi.mocked(getTransactionOwnedByUser).mockResolvedValue({
      id: 'tx-1',
      deleted_at: '2026-10-31T00:00:00Z',
    } as never);

    await handlePostback(postback('action=restore&id=tx-1'));

    expect(restoreTransaction).toHaveBeenCalledWith('tx-1', USER);
  });
});

describe('save_to_plan — จำนวนเงินใน data ปลอมได้', () => {
  it.each([
    ['ทศนิยม', '10.5'],
    ['ติดลบ', '-500'],
    ['ศูนย์', '0'],
    ['ไม่ใช่ตัวเลข', 'abc'],
    ['ไม่มี', null],
  ])('ยอด%sถูกปฏิเสธ ไม่โอน (G3)', async (_label, amt) => {
    const data = amt === null ? 'action=save_to_plan&id=plan-1' : `action=save_to_plan&id=plan-1&amt=${amt}`;

    await handlePostback(postback(data));

    expect(transferToPlan).not.toHaveBeenCalled();
    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('ไม่ถูกต้อง'));
  });

  it('ยอดถูกต้อง → โอนด้วย user ของ event', async () => {
    vi.mocked(transferToPlan).mockResolvedValue({
      justCompleted: false,
      progress: { title: 'เที่ยว', savedSatang: 200000, targetSatang: 1000000, percentComplete: 20 },
    } as never);

    await handlePostback(postback('action=save_to_plan&id=plan-1&amt=200000'));

    expect(transferToPlan).toHaveBeenCalledWith(USER, 'plan-1', 200000);
  });

  it('PlanError (เช่น แผนไม่ใช่ของเรา) → ส่งเหตุผลภาษาไทยกลับไป', async () => {
    vi.mocked(transferToPlan).mockRejectedValue(new PlanError('ไม่พบแผนนี้', 404));

    await handlePostback(postback('action=save_to_plan&id=plan-x&amt=100'));

    expect(replyText).toHaveBeenCalledWith('reply-1', 'ไม่พบแผนนี้');
  });
});

describe('ai_confirm / ai_cancel (G2)', () => {
  it('ยืนยันคำขอของ AI ด้วย user ของ event', async () => {
    vi.mocked(confirmPending).mockResolvedValue({ kind: 'already', text: 'ดำเนินการไปแล้ว' } as never);

    await handlePostback(postback('action=ai_confirm&id=pending-1'));

    expect(confirmPending).toHaveBeenCalledWith(USER, 'pending-1');
    expect(replyText).toHaveBeenCalledWith('reply-1', 'ดำเนินการไปแล้ว');
  });

  it('ยืนยันพัง → บอกให้กดใหม่ ไม่เงียบ', async () => {
    vi.mocked(confirmPending).mockRejectedValue(new Error('db down'));

    await handlePostback(postback('action=ai_confirm&id=pending-1'));

    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('ยืนยันไม่สำเร็จ'));
  });

  it('ยกเลิกคำขอของ AI ด้วย user ของ event', async () => {
    vi.mocked(cancelPending).mockResolvedValue({ kind: 'cancelled', text: 'ยกเลิกแล้ว' } as never);

    await handlePostback(postback('action=ai_cancel&id=pending-1'));

    expect(cancelPending).toHaveBeenCalledWith(USER, 'pending-1');
  });
});

describe('ปุ่มที่ไม่รู้จัก', () => {
  it('ตอบผู้ใช้ทุกครั้ง ไม่ปล่อยให้กดแล้วเงียบ', async () => {
    await handlePostback(postback('action=edit&id=tx-1'));
    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('ยังใช้ไม่ได้'));
  });
});

describe('เปลี่ยนหมวดในแชท (FR-01) — edit_category → set_category', () => {
  // เดิมปุ่มนี้ตอบ "ฟีเจอร์แก้หมวดยังไม่เปิดใช้งาน" ทั้งที่ Charter จัดเป็น P0
  function category(id: string, name: string, emoji: string | null = null) {
    return { id, name, type: 'expense', emoji, is_essential: false, is_default: false };
  }

  it('กด "เปลี่ยนหมวด" → ได้ปุ่มหมวดของตัวเองให้เลือก และบอกหมวดปัจจุบัน', async () => {
    vi.mocked(listCategoryChoices).mockResolvedValue({
      transaction: {} as never,
      currentCategoryName: 'อาหาร',
      choices: [category('c-travel', 'เดินทาง', '🚗'), category('c-shop', 'ช้อปปิ้ง')] as never,
    });

    await handlePostback(postback('action=edit_category&id=tx-1'));

    expect(listCategoryChoices).toHaveBeenCalledWith(USER, 'tx-1');
    const [, text, items] = vi.mocked(replyTextWithQuickReply).mock.calls[0]!;
    expect(text).toContain('อาหาร');
    expect(items.map((item) => item.action.label)).toEqual(['🚗 เดินทาง', 'ช้อปปิ้ง']);
    expect(items[0]!.action).toMatchObject({ type: 'postback', data: 'action=set_category&id=tx-1&cat=c-travel' });
  });

  it('หมวดเกิน 13 (เพดานของ LINE) → แสดง 12 หมวด + ปุ่มเปิดเว็บ ไม่ให้ LINE ปฏิเสธทั้งข้อความ', async () => {
    vi.mocked(listCategoryChoices).mockResolvedValue({
      transaction: {} as never,
      currentCategoryName: null,
      choices: Array.from({ length: 20 }, (_, i) => category(`c${i}`, `หมวด ${i}`)) as never,
    });

    await handlePostback(postback('action=edit_category&id=tx-1'));

    const items = vi.mocked(replyTextWithQuickReply).mock.calls[0]![2];
    expect(items).toHaveLength(13);
    expect(items[12]!.action).toMatchObject({ type: 'uri' });
    expect(items.every((item) => item.action.label.length <= 20)).toBe(true);
  });

  it('รายการไม่ใช่ของเรา → ตอบเหตุผล ไม่ส่งปุ่ม', async () => {
    vi.mocked(listCategoryChoices).mockRejectedValue(new TransactionError('ไม่พบรายการนี้ อาจถูกลบไปแล้ว', 404));

    await handlePostback(postback('action=edit_category&id=someone-elses'));

    expect(replyTextWithQuickReply).not.toHaveBeenCalled();
    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('ไม่พบรายการนี้'));
  });

  it('เลือกหมวด → ย้ายด้วย user ของ event แล้วตอบการ์ดบันทึกแล้วใบใหม่ด้วยหมวดใหม่', async () => {
    vi.mocked(changeTransactionCategory).mockResolvedValue({
      categoryName: 'เดินทาง',
      title: 'กาแฟเย็น',
      updated: {
        id: 'tx-1', amountSatang: 8000, type: 'expense', occurredAt: '2026-11-14T05:00:00Z',
        budgetAlert: null, budgetStatus: null,
      },
    });

    await handlePostback(postback('action=set_category&id=tx-1&cat=c-travel'));

    expect(changeTransactionCategory).toHaveBeenCalledWith(USER, 'tx-1', 'c-travel');
    expect(vi.mocked(buildRecordedCardFor).mock.calls[0]![0][0]).toMatchObject({
      transactionId: 'tx-1', categoryName: 'เดินทาง', title: 'กาแฟเย็น', amountSatang: 8000,
    });
    expect(replyFlex).toHaveBeenCalledTimes(1);
  });

  it('หมวดผิดชนิดหรือไม่ใช่ของเรา → ตอบเหตุผลจาก service', async () => {
    vi.mocked(changeTransactionCategory).mockRejectedValue(
      new TransactionError('รายการนี้เป็นรายจ่าย ต้องเลือกหมวดรายจ่ายครับ', 400)
    );

    await handlePostback(postback('action=set_category&id=tx-1&cat=c-salary'));

    expect(replyFlex).not.toHaveBeenCalled();
    expect(replyText).toHaveBeenCalledWith('reply-1', expect.stringContaining('หมวดรายจ่าย'));
  });

  it('data ไม่มี cat (ปุ่มเพี้ยน) → ไม่เรียก service', async () => {
    await handlePostback(postback('action=set_category&id=tx-1'));
    expect(changeTransactionCategory).not.toHaveBeenCalled();
    expect(replyText).toHaveBeenCalled();
  });
});
