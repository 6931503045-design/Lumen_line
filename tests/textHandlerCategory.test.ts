// ไฟล์นี้ทำหน้าที่อะไร: test ว่าทางด่วน (L1) เลือกหมวดกับทิศทางเงินถูก
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §S4 Router 4 ชั้น · §S11.2 "ไม่เจอ = อื่นๆ"
// ⚖️ กฎเหล็ก G1, G3
//
// 🔴 สองบั๊กที่เจอจากการทดสอบจริง ซึ่งเทสต์ชุดนี้กันไม่ให้กลับมา:
//   1. พิมพ์ "มะม่วง 500" แล้วได้หมวดใหม่ชื่อ "มะม่วง" เพิ่มมา — จดไม่กี่วันก็มีหมวดเป็นสิบ
//      แล้วหน้าสรุปรายหมวดใช้ไม่ได้อีกเลย
//   2. พิมพ์ "ได้เงินค่าขนม 500" แล้วถูกบันทึกเป็นรายจ่าย — ยอดคงเหลือผิดไปสองเท่า
//      ของจำนวนนั้น และผู้ใช้สังเกตยากเพราะตัวเลขถูก แค่ทิศทางผิด

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
  suggestCategoryForItem: vi.fn(),
  FALLBACK_EXPENSE_CATEGORY: 'อื่นๆ',
}));

import { getUserIdByLineUserId } from '../src/db/queries/users';
import { createTransaction } from '../src/services/transaction.service';
import { resolveCategory, suggestCategoryForItem } from '../src/services/ai/router';
import { replyFlex } from '../src/line/reply';
import { handleText } from '../src/handlers/textHandler';

const USER = 'user-1';

function send(text: string) {
  return handleText({
    replyToken: 'tok',
    source: { userId: 'U1' },
    message: { type: 'text', text },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserIdByLineUserId).mockResolvedValue(USER);
  vi.mocked(createTransaction).mockResolvedValue({
    id: 't1',
    amountSatang: 50000,
    type: 'expense',
    occurredAt: '2026-10-12T05:00:00.000Z',
    budgetAlert: null,
    budgetStatus: null,
  });
});

describe('ทางด่วนต้องไม่สร้างหมวดใหม่จากคำที่ผู้ใช้พิมพ์', () => {
  it('คำที่ไม่ตรงหมวดไหนเลย ลง "อื่นๆ" ไม่ใช่สร้างหมวดชื่อนั้น', async () => {
    vi.mocked(resolveCategory).mockResolvedValue(null);

    await send('มะม่วง 500');

    const arg = vi.mocked(createTransaction).mock.calls[0]![0];
    expect(arg.categoryName).toBe('อื่นๆ');
    expect(arg.categoryName).not.toBe('มะม่วง');
  });

  it('คำที่พิมพ์ยังถูกเก็บเป็นชื่อรายการ ไม่หายไปเฉย ๆ', async () => {
    vi.mocked(resolveCategory).mockResolvedValue(null);

    await send('มะม่วง 500');

    expect(vi.mocked(createTransaction).mock.calls[0]![0].note).toBe('มะม่วง');
  });

  it('หมวดจากพจนานุกรมส่วนตัว → บันทึก parsed_by=learned (SPEC §S4 L3)', async () => {
    vi.mocked(resolveCategory).mockResolvedValue({ name: 'อาหาร', source: 'learned' });

    await send('ร้านป้าแดง 50');

    const arg = vi.mocked(createTransaction).mock.calls[0]![0];
    expect(arg.categoryName).toBe('อาหาร');
    expect(arg.parsedBy).toBe('learned');
  });

  it('จับคู่หมวดไม่ได้ → parsed_by=regex เหมือนเดิม', async () => {
    vi.mocked(resolveCategory).mockResolvedValue(null);
    await send('ร้านป้าแดง 50');
    expect(vi.mocked(createTransaction).mock.calls[0]![0].parsedBy).toBe('regex');
  });

  it('ถ้าตรงกับหมวดที่ผู้ใช้มีอยู่แล้ว ใช้หมวดนั้น', async () => {
    vi.mocked(resolveCategory).mockResolvedValue({ name: 'อาหาร', source: 'dictionary' });

    await send('ข้าว 60');

    expect(vi.mocked(createTransaction).mock.calls[0]![0].categoryName).toBe('อาหาร');
  });

  it('รายรับที่จับคู่ไม่ได้ ปล่อยว่าง ไม่โยนเข้า "อื่นๆ"', async () => {
    // ฝั่งรายรับไม่มีหมวด "อื่นๆ" และการโยนเงินเดือนเข้า "รายได้เสริม"
    // คือการติดป้ายผิด ไม่ใช่ค่าเริ่มต้นที่ปลอดภัย
    vi.mocked(resolveCategory).mockResolvedValue(null);

    await send('ได้เงินค่าขนม 500');

    expect(vi.mocked(createTransaction).mock.calls[0]![0].categoryName).toBeUndefined();
  });
});

describe('ทิศทางเงินต้องถูกตั้งแต่ทางด่วน', () => {
  beforeEach(() => {
    vi.mocked(resolveCategory).mockResolvedValue(null);
  });

  it('🔴 "ได้เงินค่าขนม 500" ต้องเป็นรายรับ ไม่ใช่รายจ่าย', async () => {
    await send('ได้เงินค่าขนม 500');
    expect(vi.mocked(createTransaction).mock.calls[0]![0].type).toBe('income');
  });

  it('"เงินเดือน 15000" ต้องเป็นรายรับ', async () => {
    await send('เงินเดือน 15000');
    expect(vi.mocked(createTransaction).mock.calls[0]![0].type).toBe('income');
  });

  it('"กาแฟ 80" ยังเป็นรายจ่ายเหมือนเดิม', async () => {
    await send('กาแฟ 80');
    expect(vi.mocked(createTransaction).mock.calls[0]![0].type).toBe('expense');
  });
});

describe('ไม่รู้จักคำนี้ → ให้ AI เสนอหมวด แต่ผู้ใช้ต้องกดยืนยันเอง (⚖️ G2)', () => {
  it('ลง "อื่นๆ" แล้วแนบข้อเสนอพร้อมปุ่ม "ใช่" (set_category) และ "เลือกหมวดเอง"', async () => {
    vi.mocked(resolveCategory).mockResolvedValue(null);
    vi.mocked(suggestCategoryForItem).mockResolvedValue({
      id: 'c-food', name: 'อาหาร', type: 'expense', emoji: null, is_essential: true, is_default: true,
    });

    await send('ร้านป้าแดง 50');

    // ⚖️ G2: บันทึกลง "อื่นๆ" ก่อน — ข้อเสนอของ AI ยังไม่ถูกใช้จนกว่าผู้ใช้จะกด
    expect(vi.mocked(createTransaction).mock.calls[0]![0].categoryName).toBe('อื่นๆ');
    expect(suggestCategoryForItem).toHaveBeenCalledWith(USER, 'ร้านป้าแดง', 'expense');
    const [, , extraText, quickReply] = vi.mocked(replyFlex).mock.calls[0]!;
    expect(extraText).toContain('น่าจะเป็นหมวด อาหาร');
    expect(quickReply?.map((item) => item.action.type === 'postback' ? item.action.data : '')).toEqual([
      expect.stringMatching(/^action=set_category&id=.+&cat=c-food$/),
      expect.stringMatching(/^action=edit_category&id=/),
    ]);
  });

  it('รู้จักคำนี้อยู่แล้ว (พจนานุกรม/ตารางคำ) → ไม่ถาม AI เลย ไม่เปลืองโควตา', async () => {
    vi.mocked(resolveCategory).mockResolvedValue({ name: 'อาหาร', source: 'learned' });

    await send('ร้านป้าแดง 50');

    expect(suggestCategoryForItem).not.toHaveBeenCalled();
    expect(vi.mocked(replyFlex).mock.calls[0]![3]).toBeUndefined();
  });

  it('⚖️ G4: AI ไม่มีข้อเสนอ (ปิด/ล่ม/ช้า) → การ์ดออกเหมือนเดิม ไม่มีข้อความเสริม', async () => {
    vi.mocked(resolveCategory).mockResolvedValue(null);
    vi.mocked(suggestCategoryForItem).mockResolvedValue(null);

    await send('ร้านป้าแดง 50');

    const call = vi.mocked(replyFlex).mock.calls[0]!;
    expect(call[2]).toBeUndefined();
    expect(call[3]).toBeUndefined();
  });

  it('รายรับไม่ถาม AI (ฝั่งรายรับไม่มีหมวด "อื่นๆ" ให้ย้ายออก)', async () => {
    vi.mocked(resolveCategory).mockResolvedValue(null);
    await send('+ค่าจ้างพิเศษ 500');
    expect(suggestCategoryForItem).not.toHaveBeenCalled();
  });
});
