// ไฟล์นี้ทำหน้าที่อะไร: test วงจรอ่านสลิปทั้งเส้น ตั้งแต่รับรูปถึงเสนอให้กดยืนยัน
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S9 (ผังวงจร) + §S10 Dedup / SRS FR-15
// ⚖️ กฎเหล็ก G2, G5, G6
//
// ⚠️ ไม่เรียก Gemini จริงและไม่เรียก LINE จริง — mock ทั้ง readSlip และ blob client
//
// 🔴 สองข้อที่เทสต์ชุดนี้ต้องพิสูจน์ให้ได้:
//   1. ส่งรูปมาแล้วต้องไม่มีรายการเงินถูกบันทึกเลย จนกว่าผู้ใช้จะกดยืนยัน (G2)
//   2. สลิปใบเดิมส่งซ้ำต้องไม่ได้รายการที่สอง (S10)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/users', () => ({ getUserIdByLineUserId: vi.fn() }));
vi.mock('../src/line/client', () => ({
  lineClient: { showLoadingAnimation: vi.fn() },
  lineBlobClient: { getMessageContent: vi.fn() },
}));
vi.mock('../src/line/reply', () => ({
  replyText: vi.fn(),
  replyTextWithQuickReply: vi.fn(),
}));
vi.mock('../src/services/ai/vision', () => ({ readSlip: vi.fn() }));
vi.mock('../src/services/dedup.service', () => ({ checkDuplicate: vi.fn() }));
vi.mock('../src/services/pending.service', () => ({ createPending: vi.fn() }));
vi.mock('../src/services/ai/router', () => ({
  resolveCategoryName: vi.fn(),
  FALLBACK_EXPENSE_CATEGORY: 'อื่นๆ',
}));

import { getUserIdByLineUserId } from '../src/db/queries/users';
import { lineBlobClient, lineClient } from '../src/line/client';
import { replyText, replyTextWithQuickReply } from '../src/line/reply';
import { readSlip } from '../src/services/ai/vision';
import { checkDuplicate } from '../src/services/dedup.service';
import { createPending } from '../src/services/pending.service';
import { resolveCategoryName } from '../src/services/ai/router';
import { handleImage } from '../src/handlers/imageHandler';

const SLIP = {
  amountSatang: 350000,
  occurredAtIso: '2026-10-06T07:32:00.000Z',
  receiver: 'หอพักสุขสันต์',
  bank: 'KBank',
  refNumber: '0123456789',
};

const EVENT = {
  replyToken: 'rt1',
  source: { userId: 'Uline123' },
  message: { type: 'image', id: 'msg1' },
};

/** ข้อความที่ถูกส่งกลับไป ไม่ว่าจะผ่าน replyText หรือ replyTextWithQuickReply */
function repliedText(): string {
  const plain = vi.mocked(replyText).mock.calls.map((call) => call[1]);
  const withButtons = vi.mocked(replyTextWithQuickReply).mock.calls.map((call) => call[1]);
  return [...plain, ...withButtons].join('\n---\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserIdByLineUserId).mockResolvedValue('u1');
  vi.mocked(lineClient.showLoadingAnimation).mockResolvedValue({} as never);
  vi.mocked(lineBlobClient.getMessageContent).mockResolvedValue(
    Readable.from([Buffer.from('รูปปลอมสำหรับเทสต์')]) as never
  );
  vi.mocked(readSlip).mockResolvedValue({ kind: 'slip', slip: SLIP });
  vi.mocked(checkDuplicate).mockResolvedValue({ kind: 'unique' });
  vi.mocked(resolveCategoryName).mockResolvedValue('ที่พัก/บิล');
  vi.mocked(createPending).mockResolvedValue({
    id: 'p1',
    expiresAt: '2026-10-08T03:00:00.000Z',
    summary: 'รายจ่าย "หอพักสุขสันต์" ฿3,500.00 หมวด ที่พัก/บิล',
  });
});

describe('ทางปกติ — อ่านสลิปได้แล้วเสนอให้กดยืนยัน', () => {
  it('🔴 G2: ส่งรูปมาแล้วยังไม่มีรายการเงินถูกบันทึก มีแค่คำขอรอยืนยัน', async () => {
    await handleImage(EVENT);

    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'create_transaction',
        source: 'image',
      })
    );
  });

  it('payload มียอด เวลาแบบเต็ม และเลขอ้างอิงครบ', async () => {
    await handleImage(EVENT);

    const payload = vi.mocked(createPending).mock.calls[0]?.[0].payload;
    expect(payload).toEqual({
      type: 'expense',
      amountSatang: 350000,
      totalSatang: 350000,
      splitCount: 1,
      item: 'หอพักสุขสันต์',
      occurredAtIso: '2026-10-06T07:32:00.000Z',
      categoryName: 'ที่พัก/บิล',
      refNumber: '0123456789',
    });
  });

  it('สลิปคือเงินออก → type=expense เป็นค่าเริ่มต้น (SPEC §S9)', async () => {
    await handleImage(EVENT);
    const payload = vi.mocked(createPending).mock.calls[0]?.[0].payload as { type: string };
    expect(payload.type).toBe('expense');
  });

  it('ตอบพร้อมปุ่มยืนยันและปุ่มไม่ใช่', async () => {
    await handleImage(EVENT);

    const items = vi.mocked(replyTextWithQuickReply).mock.calls[0]?.[2];
    expect(items?.map((item) => item.action.label)).toEqual(['ยืนยัน', 'ไม่ใช่']);
    expect(items?.[0]?.action.data).toBe('action=ai_confirm&id=p1');
    expect(items?.[1]?.action.data).toBe('action=ai_cancel&id=p1');
  });

  it('โชว์ loading animation ก่อน เพราะ Vision ใช้เวลาหลายวินาที', async () => {
    await handleImage(EVENT);
    expect(lineClient.showLoadingAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 'Uline123' })
    );
  });

  it('อ่านชื่อผู้รับไม่ได้ → ใช้ชื่อสำรอง ไม่ปล่อยว่าง', async () => {
    vi.mocked(readSlip).mockResolvedValue({ kind: 'slip', slip: { ...SLIP, receiver: null } });
    vi.mocked(resolveCategoryName).mockResolvedValue(null);

    await handleImage(EVENT);

    const payload = vi.mocked(createPending).mock.calls[0]?.[0].payload as {
      item: string;
      categoryName: string;
    };
    expect(payload.item).toBe('สลิปโอนเงิน');
    expect(payload.categoryName).toBe('อื่นๆ');
  });

  it('เดาหมวดจากชื่อผู้รับด้วยกฎเดียวกับฝั่งข้อความ', async () => {
    await handleImage(EVENT);
    expect(resolveCategoryName).toHaveBeenCalledWith('u1', 'หอพักสุขสันต์', 'expense');
  });
});

describe('⚖️ S10 Dedup — กันสลิปใบเดิมซ้ำ', () => {
  it('🔴 ref_number ตรงกัน = ใบเดิมเป๊ะ → ไม่สร้างคำขอเลย', async () => {
    vi.mocked(checkDuplicate).mockResolvedValue({ kind: 'exact', transactionId: 'tx-เดิม' });

    await handleImage(EVENT);

    expect(createPending).not.toHaveBeenCalled();
    expect(repliedText()).toContain('บันทึกไว้แล้ว');
  });

  it('น่าจะซ้ำ → ยังเสนอให้กดยืนยัน แต่ต้องมีคำเตือน (SPEC §S9)', async () => {
    // คนโอนยอดเดิมสองครั้งติดกันก็มีจริง ระบบไม่ควรตัดสินใจแทน
    vi.mocked(checkDuplicate).mockResolvedValue({
      kind: 'probable',
      transactionId: 'tx-ใกล้เคียง',
      existingRefNumber: null,
    });

    await handleImage(EVENT);

    expect(createPending).toHaveBeenCalled();
    const text = repliedText();
    expect(text).toContain('ยอดเท่ากันในช่วงเวลาใกล้กัน');
    expect(text).toContain('ไม่ใช่');
  });

  it('เช็คซ้ำด้วยยอด เวลา และเลขอ้างอิงจากสลิป (⚖️ G6 ส่ง userId ไปด้วย)', async () => {
    await handleImage(EVENT);

    expect(checkDuplicate).toHaveBeenCalledWith({
      userId: 'u1',
      type: 'expense',
      amountSatang: 350000,
      occurredAt: new Date('2026-10-06T07:32:00.000Z'),
      refNumber: '0123456789',
    });
  });

  it('เช็คซ้ำต้องเกิดก่อนสร้างคำขอ ไม่ใช่หลัง', async () => {
    const order: string[] = [];
    vi.mocked(checkDuplicate).mockImplementation(async () => {
      order.push('dedup');
      return { kind: 'unique' };
    });
    vi.mocked(createPending).mockImplementation(async () => {
      order.push('pending');
      return { id: 'p1', expiresAt: 'x', summary: 's' };
    });

    await handleImage(EVENT);

    expect(order).toEqual(['dedup', 'pending']);
  });
});

describe('⚖️ G4 — อ่านไม่ได้ต้องบอกทางไปต่อที่ไม่ต้องใช้ AI', () => {
  it('AI ใช้ไม่ได้ → บอกให้พิมพ์เอง', async () => {
    vi.mocked(readSlip).mockResolvedValue({ kind: 'unavailable' });

    await handleImage(EVENT);

    const text = repliedText();
    expect(text).toContain('อ่านสลิปจากรูปให้ไม่ได้');
    expect(text).toContain('ค่าหอ 3500');
    expect(createPending).not.toHaveBeenCalled();
  });

  it('อ่านแล้วไม่ใช่สลิป → ส่งเหตุผลจาก vision ต่อให้ผู้ใช้', async () => {
    vi.mocked(readSlip).mockResolvedValue({
      kind: 'unreadable',
      reason: 'รูปนี้ดูไม่ใช่สลิปโอนเงินครับ 🙏',
    });

    await handleImage(EVENT);

    expect(repliedText()).toContain('ไม่ใช่สลิปโอนเงิน');
    expect(createPending).not.toHaveBeenCalled();
  });

  it('ดึงรูปจาก LINE ไม่สำเร็จ → ตอบผู้ใช้ ไม่ปล่อย error ทะลุออกไป', async () => {
    vi.mocked(lineBlobClient.getMessageContent).mockRejectedValue(new Error('LINE ล่ม'));

    await expect(handleImage(EVENT)).resolves.toBeUndefined();

    expect(repliedText()).toContain('ดึงรูปไม่สำเร็จ');
    expect(readSlip).not.toHaveBeenCalled();
  });

  it('สร้างคำขอไม่สำเร็จ → ตอบผู้ใช้ ไม่ปล่อย error ทะลุออกไป', async () => {
    vi.mocked(createPending).mockRejectedValue(new Error('DB ล่ม'));

    await expect(handleImage(EVENT)).resolves.toBeUndefined();

    expect(repliedText()).toContain('บันทึกสลิปไม่สำเร็จ');
  });

  it('loading animation ล้มเหลวไม่ทำให้ flow พัง', async () => {
    vi.mocked(lineClient.showLoadingAnimation).mockRejectedValue(new Error('ไม่รองรับ'));

    await handleImage(EVENT);

    expect(createPending).toHaveBeenCalled();
  });
});

describe('⚖️ G6 — ไม่รู้ว่าใครก็ทำอะไรต่อไม่ได้', () => {
  it('หาผู้ใช้ไม่เจอ → ไม่ดึงรูป ไม่เรียก AI', async () => {
    vi.mocked(getUserIdByLineUserId).mockResolvedValue(null);

    await handleImage(EVENT);

    expect(lineBlobClient.getMessageContent).not.toHaveBeenCalled();
    expect(readSlip).not.toHaveBeenCalled();
    expect(repliedText()).toContain('ยังไม่พบบัญชีผู้ใช้');
  });

  it('userId ที่ส่งต่อไปทุกชั้นมาจากการ query ด้วย line_user_id ของ event', async () => {
    await handleImage(EVENT);

    expect(getUserIdByLineUserId).toHaveBeenCalledWith('Uline123');
    expect(readSlip).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });

  it('event ที่ข้อมูลไม่ครบ → ไม่ทำอะไรเลย', async () => {
    await handleImage({ source: { userId: 'U1' }, message: { type: 'image', id: 'm1' } });
    await handleImage({ replyToken: 'rt', message: { type: 'image', id: 'm1' } });
    await handleImage({ replyToken: 'rt', source: { userId: 'U1' }, message: { type: 'image' } });

    expect(getUserIdByLineUserId).not.toHaveBeenCalled();
    expect(readSlip).not.toHaveBeenCalled();
  });
});

describe('⚖️ G5 — รูปอยู่ใน memory เท่านั้น', () => {
  it('รูปถูกส่งเข้า readSlip เป็น Buffer ไม่ใช่ path ของไฟล์', async () => {
    await handleImage(EVENT);

    const arg = vi.mocked(readSlip).mock.calls[0]?.[0];
    expect(Buffer.isBuffer(arg?.image)).toBe(true);
    expect(arg?.image.toString()).toBe('รูปปลอมสำหรับเทสต์');
  });

  it('🔴 ไม่มีบรรทัดไหนในไฟล์เขียนรูปลงดิสก์ (SPEC §S9 MUST NOT)', () => {
    // เทสต์เชิงโครงสร้าง: ถ้าวันหลังมีคนแก้ให้ pipe ลงไฟล์ชั่วคราว "เพื่อประหยัดแรม"
    // จะผิด SPEC ทันที และเทสต์นี้จะจับได้
    const source = readFileSync(
      join(__dirname, '..', 'src', 'handlers', 'imageHandler.ts'),
      'utf-8'
    );

    expect(source).not.toMatch(/writeFile|createWriteStream|\bfs\b|node:fs|tmpdir|\/tmp/);
  });

  it('log ตอนอ่านสลิปไม่มียอดเงินหรือชื่อผู้รับ', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await handleImage(EVENT);

    const logged = spy.mock.calls.flat().join(' | ');
    spy.mockRestore();

    expect(logged).not.toContain('หอพักสุขสันต์');
    expect(logged).not.toContain('3500');
    expect(logged).not.toContain('0123456789');
  });
});
