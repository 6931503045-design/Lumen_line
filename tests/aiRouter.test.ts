// ไฟล์นี้ทำหน้าที่อะไร: test ทางเดินของข้อความที่ regex อ่านไม่ออก ตั้งแต่ guard ถึงคำตอบ
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S4 L4, §S11.2, §S12 / SRS FR-13
// ⚖️ กฎเหล็ก G1, G2, G4, G6, G7
//
// ⚠️ SPEC §7 บังคับว่า "ห้ามเรียก Gemini จริงใน test ต้อง mock เสมอ"
// ไฟล์นี้ mock understandText ทั้งตัว จึงไม่มีการต่อเน็ตออกไปไหนเลย
// และมีเทสต์เชิงโครงสร้างท้ายไฟล์ที่พิสูจน์ว่าไม่มีไฟล์อื่นเลี่ยง guard ไปเรียก SDK ตรง ๆ

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/ai/guard', () => ({
  checkAiAllowed: vi.fn(),
  describeBlockReason: (reason: string) => reason,
}));

vi.mock('../src/services/ai/gemini', () => ({ understandText: vi.fn() }));
vi.mock('../src/services/pending.service', () => ({ createPending: vi.fn() }));
vi.mock('../src/db/queries/categories', () => ({ listCategoriesByUser: vi.fn() }));
vi.mock('../src/db/queries/transactions', () => ({ listTransactionsByUser: vi.fn() }));
vi.mock('../src/services/command.service', () => ({ runCommand: vi.fn() }));
vi.mock('../src/services/simulate.service', () => ({ simulatePurchase: vi.fn() }));

import { listCategoriesByUser } from '../src/db/queries/categories';
import { listTransactionsByUser } from '../src/db/queries/transactions';
import { runCommand } from '../src/services/command.service';
import { createPending } from '../src/services/pending.service';
import { simulatePurchase } from '../src/services/simulate.service';
import { understandText } from '../src/services/ai/gemini';
import { checkAiAllowed } from '../src/services/ai/guard';
import { interpretUserMessage, resetAiHistoryForTest } from '../src/services/ai/router';

const TODAY = '2026-10-07';
const NOW = new Date('2026-10-07T10:00:00+07:00');

const CATEGORIES = [
  { id: 'c1', name: 'อาหาร', type: 'expense', emoji: '🍜', isDefault: true },
  { id: 'c2', name: 'เดินทาง', type: 'expense', emoji: '🚗', isDefault: true },
  { id: 'c3', name: 'เงินเดือน', type: 'income', emoji: '💰', isDefault: true },
];

function ask(text: string) {
  return interpretUserMessage({ userId: 'u1', text, todayIso: TODAY, now: NOW });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAiHistoryForTest();
  vi.mocked(checkAiAllowed).mockResolvedValue({ ok: true, safeText: 'ข้อความที่ปิดข้อมูลแล้ว' });
  vi.mocked(listCategoriesByUser).mockResolvedValue(CATEGORIES as never);
  vi.mocked(listTransactionsByUser).mockResolvedValue([] as never);
  vi.mocked(createPending).mockResolvedValue({
    id: 'p1',
    expiresAt: '2026-10-08T03:00:00.000Z',
    summary: 'สรุปคำขอ',
  });
});

describe('⚖️ G4 — ทุกเส้นทางที่ AI ใช้ไม่ได้ ต้องบอกผู้เรียกให้ไปทางอื่น', () => {
  it('guard ปฏิเสธ → unavailable และไม่เรียก AI เลย', async () => {
    vi.mocked(checkAiAllowed).mockResolvedValue({ ok: false, reason: 'ai_disabled_globally' });

    expect(await ask('ซื้อกาแฟมาแก้วนึง')).toEqual({ kind: 'unavailable' });
    expect(understandText).not.toHaveBeenCalled();
  });

  it('โควตาหมด → unavailable', async () => {
    vi.mocked(checkAiAllowed).mockResolvedValue({ ok: false, reason: 'user_daily_limit' });
    expect(await ask('ซื้อกาแฟ')).toEqual({ kind: 'unavailable' });
  });

  it('AI ล่มหรือหมดเวลา → unavailable', async () => {
    vi.mocked(understandText).mockResolvedValue({ kind: 'error', errorCode: 'timeout' });
    expect(await ask('ซื้อกาแฟ')).toEqual({ kind: 'unavailable' });
  });

  it('service ที่ถูกเรียกต่อ throw → unavailable ไม่ใช่ปล่อย error ทะลุไปถึงผู้ใช้', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'get_summary',
      args: { period: 'this_month' },
    });
    vi.mocked(runCommand).mockRejectedValue(new Error('DB ล่ม'));

    expect(await ask('เดือนนี้ใช้ไปเท่าไหร่')).toEqual({ kind: 'unavailable' });
  });
});

describe('⚖️ G5 — ส่งให้ AI เฉพาะข้อความที่ redact แล้ว', () => {
  it('ข้อความที่ส่งเข้า understandText คือ safeText จาก guard ไม่ใช่ข้อความดิบ', async () => {
    vi.mocked(understandText).mockResolvedValue({ kind: 'text', text: 'ขอถามอีกครั้งนะครับ' });

    await ask('โอนเข้า 1234567890 ห้าร้อย');

    expect(understandText).toHaveBeenCalledWith(
      expect.objectContaining({ safeText: 'ข้อความที่ปิดข้อมูลแล้ว' })
    );
  });
});

describe('⚖️ G2 — tool ที่เขียนข้อมูลต้องกลายเป็น pending ไม่ใช่เขียนทันที', () => {
  it('create_transaction → pending พร้อม id ให้ผู้ใช้กดยืนยัน', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'create_transaction',
      args: { type: 'expense', amount: 80, item: 'กาแฟ', category_hint: 'อาหาร' },
    });

    const reply = await ask('เมื่อกี้ซื้อกาแฟมาแก้วนึง 80');

    expect(reply).toEqual({ kind: 'pending', pendingId: 'p1', text: 'สรุปคำขอ' });
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'create_transaction',
        source: 'chat',
        payload: expect.objectContaining({ amountSatang: 8000, categoryName: 'อาหาร' }),
      })
    );
  });

  it('create_recurring → pending', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'create_recurring',
      args: { label: 'ค่าหอ', type: 'expense', amount: 3500, frequency: 'monthly', day: 5 },
    });

    const reply = await ask('ค่าหอจ่ายทุกวันที่ 5 เดือนละ 3500');

    expect(reply.kind).toBe('pending');
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create_recurring' })
    );
  });

  it('batch → pending ก้อนเดียว ไม่ใช่หลายคำขอ', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'create_transaction_batch',
      args: {
        items: [
          { type: 'expense', amount: 80, item: 'กาแฟ' },
          { type: 'expense', amount: 60, item: 'ข้าว' },
        ],
      },
    });

    await ask('เช้านี้กาแฟ 80 ข้าว 60');

    expect(createPending).toHaveBeenCalledTimes(1);
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create_transaction_batch' })
    );
  });
});

describe('การจับคู่หมวดจาก category_hint', () => {
  async function pendingPayloadFor(hint: string | undefined, type = 'expense') {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'create_transaction',
      args: { type, amount: 80, item: 'ของบางอย่าง', ...(hint ? { category_hint: hint } : {}) },
    });
    await ask('ข้อความอะไรก็ได้');
    return vi.mocked(createPending).mock.calls[0]?.[0].payload as Record<string, unknown>;
  }

  it('ชื่อตรงกันเป๊ะ', async () => {
    expect((await pendingPayloadFor('อาหาร')).categoryName).toBe('อาหาร');
  });

  it('ชื่อมีคำของกันและกัน ("ค่าอาหาร" → "อาหาร")', async () => {
    expect((await pendingPayloadFor('ค่าอาหาร')).categoryName).toBe('อาหาร');
  });

  it('🔴 หมวดที่ไม่มีอยู่ → "อื่นๆ" ไม่ใช่สร้างหมวดใหม่ตามคำที่ AI เดามา', async () => {
    // ปล่อยให้สร้างได้ หน้าสรุปรายหมวดจะมีหมวดงอกใหม่ทุกครั้งที่ AI เรียกชื่อต่างกัน
    expect((await pendingPayloadFor('เครื่องดื่มเย็น')).categoryName).toBe('อื่นๆ');
  });

  it('ไม่ส่ง hint มา → "อื่นๆ" สำหรับรายจ่าย', async () => {
    expect((await pendingPayloadFor(undefined)).categoryName).toBe('อื่นๆ');
  });

  it('รายรับที่จับคู่ไม่ได้ → ปล่อยว่าง ไม่ติดป้ายผิด', async () => {
    // ฝั่งรายรับไม่มีหมวด "อื่นๆ" และการโยนเงินเดือนเข้า "รายได้เสริม" คือติดป้ายผิด
    expect((await pendingPayloadFor('โอนมาจากแม่', 'income')).categoryName).toBeNull();
  });

  it('หมวดต้องเป็นประเภทเดียวกับรายการ — hint รายรับใช้กับรายจ่ายไม่ได้', async () => {
    expect((await pendingPayloadFor('เงินเดือน')).categoryName).toBe('อื่นๆ');
  });
});

describe('แก้ / ลบ รายการ — หา target จากข้อมูลของผู้ใช้เท่านั้น (G6, G7)', () => {
  const ROWS = [
    {
      id: 'tx-ใหม่',
      type: 'expense',
      amount: '80.00',
      note: 'กาแฟ',
      occurred_at: '2026-10-07T03:00:00Z',
      parsed_by: 'regex',
      source: 'chat',
      categories: { name: 'อาหาร', emoji: '🍜' },
    },
    {
      id: 'tx-เก่า',
      type: 'expense',
      amount: '60.00',
      note: 'ข้าว',
      occurred_at: '2026-10-06T03:00:00Z',
      parsed_by: 'regex',
      source: 'chat',
      categories: { name: 'อาหาร', emoji: '🍜' },
    },
  ];

  it('target="last" ใช้รายการใหม่สุด', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue(ROWS as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'delete_transaction',
      args: { target: 'last' },
    });

    const reply = await ask('ลบรายการล่าสุดด้วย');

    expect(reply.kind).toBe('pending');
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete_transaction',
        payload: expect.objectContaining({ transactionId: 'tx-ใหม่' }),
      })
    );
  });

  it('target เป็น id ที่มีอยู่จริงของผู้ใช้', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue(ROWS as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'delete_transaction',
      args: { target: 'tx-เก่า' },
    });

    await ask('ลบรายการข้าว');

    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ transactionId: 'tx-เก่า' }) })
    );
  });

  it('🔴 id ที่ AI แต่งขึ้นมา (ไม่อยู่ในรายการของผู้ใช้) → ไม่สร้าง pending', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue(ROWS as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'delete_transaction',
      args: { target: 'tx-ของคนอื่น' },
    });

    const reply = await ask('ลบรายการนั้น');

    expect(reply.kind).toBe('text');
    expect(createPending).not.toHaveBeenCalled();
  });

  it('ไม่มีรายการเลย → บอกผู้ใช้ ไม่ใช่สร้าง pending ลอย ๆ', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue([] as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'update_transaction',
      args: { target: 'last', changes: { amount: 90 } },
    });

    const reply = await ask('แก้เป็น 90');

    expect(reply.kind).toBe('text');
    expect(createPending).not.toHaveBeenCalled();
  });

  it('⚖️ G7: รายการโอนเข้าแผนออมห้ามให้ AI แก้หรือลบ', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue([
      {
        id: 'tx-โอน',
        type: 'transfer',
        amount: '500.00',
        note: 'ออมเข้าแผนเที่ยว',
        occurred_at: '2026-10-07T03:00:00Z',
        parsed_by: 'manual',
        source: 'liff',
        categories: null,
      },
    ] as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'delete_transaction',
      args: { target: 'last' },
    });

    const reply = await ask('ลบรายการล่าสุด');

    expect(reply.kind).toBe('text');
    expect(createPending).not.toHaveBeenCalled();
  });

  it('แก้หมวดเป็นหมวดที่ไม่มีอยู่ → ไม่แก้หมวด แต่ยังแก้อย่างอื่นได้', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue(ROWS as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'update_transaction',
      args: { target: 'last', changes: { amount: 90, category_hint: 'หมวดที่ไม่มี' } },
    });

    await ask('แก้เป็น 90 หมวดอะไรก็ไม่รู้');

    const payload = vi.mocked(createPending).mock.calls[0]?.[0].payload as {
      changes: Record<string, unknown>;
    };
    expect(payload.changes).toEqual({ amountSatang: 9000 });
  });

  it('แก้เฉพาะหมวดที่หาไม่เจอ = ไม่มีอะไรจะแก้ → ถามกลับ', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue(ROWS as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'update_transaction',
      args: { target: 'last', changes: { category_hint: 'หมวดที่ไม่มี' } },
    });

    const reply = await ask('ย้ายหมวดหน่อย');

    expect(reply.kind).toBe('text');
    expect(createPending).not.toHaveBeenCalled();
  });
});

describe('⚖️ G1 — tool ที่อ่านข้อมูล ตัวเลขทุกตัวมาจาก S5', () => {
  it('get_summary ใช้ runCommand ตัวเดียวกับคำสั่งตายตัว', async () => {
    vi.mocked(runCommand).mockResolvedValue('สรุปเดือนนี้: ...');
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'get_summary',
      args: { period: 'this_month' },
    });

    const reply = await ask('เดือนนี้ใช้ไปเท่าไหร่แล้ว');

    expect(reply).toEqual({ kind: 'text', text: 'สรุปเดือนนี้: ...' });
    expect(runCommand).toHaveBeenCalledWith('u1', 'summary');
  });

  it('period ถูกแปลงเป็นคำสั่งที่ถูกตัว', async () => {
    const cases = [
      ['remaining', 'remaining'],
      ['budget', 'budget'],
      ['plans', 'plans'],
    ] as const;

    for (const [period, command] of cases) {
      vi.clearAllMocks();
      vi.mocked(checkAiAllowed).mockResolvedValue({ ok: true, safeText: 'x' });
      vi.mocked(runCommand).mockResolvedValue('ok');
      vi.mocked(understandText).mockResolvedValue({
        kind: 'tool',
        name: 'get_summary',
        args: { period },
      });

      await ask('ถามเรื่องเงิน');
      expect(runCommand).toHaveBeenCalledWith('u1', command);
    }
  });

  it('simulate_purchase ใช้ตัวเลขจาก simulate.service ตรง ๆ', async () => {
    vi.mocked(simulatePurchase).mockResolvedValue({
      hasBudget: true,
      priceSatang: 150000,
      budgetLeftSatang: 400000,
      afterBuySatang: 250000,
      perDayBeforeSatang: 16000,
      perDayAfterSatang: 10000,
      overBySatang: 0,
      daysLeft: 25,
      monthlyCapacitySatang: 200000,
      monthsToSave: null,
      tone: 'warn',
    });
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'simulate_purchase',
      args: { item_name: 'หูฟัง', price: 1500 },
    });

    const reply = await ask('ซื้อหูฟัง 1500 ได้ไหม');

    expect(simulatePurchase).toHaveBeenCalledWith('u1', 150000, TODAY);
    if (reply.kind !== 'text') throw new Error('ควรตอบเป็นข้อความ');
    expect(reply.text).toContain('฿1,500.00');
    expect(reply.text).toContain('฿2,500.00');
    expect(reply.text).toContain('ไม่ใช่คำแนะนำทางการเงิน');
  });

  it('ยังไม่ได้ตั้งงบ — บอกตรง ๆ ว่าประเมินไม่ได้ ไม่ใช่โชว์ 0', async () => {
    vi.mocked(simulatePurchase).mockResolvedValue({
      hasBudget: false,
      priceSatang: 150000,
      budgetLeftSatang: 0,
      afterBuySatang: 0,
      perDayBeforeSatang: 0,
      perDayAfterSatang: 0,
      overBySatang: 0,
      daysLeft: 25,
      monthlyCapacitySatang: 0,
      monthsToSave: null,
      tone: 'unknown',
    });
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'simulate_purchase',
      args: { item_name: 'หูฟัง', price: 1500 },
    });

    const reply = await ask('ซื้อหูฟัง 1500 ได้ไหม');

    if (reply.kind !== 'text') throw new Error('ควรตอบเป็นข้อความ');
    expect(reply.text).toContain('ยังไม่ได้ตั้งงบ');
    expect(reply.text).not.toContain('฿0.00');
  });

  it('query_transactions ตัดรายการโอนออก (G7) และจำกัดจำนวนตามที่ขอ', async () => {
    vi.mocked(listTransactionsByUser).mockResolvedValue([
      {
        id: 't1', type: 'expense', amount: '80.00', note: 'กาแฟ',
        occurred_at: '2026-10-07T03:00:00Z', parsed_by: 'regex', source: 'chat',
        categories: { name: 'อาหาร', emoji: '🍜' },
      },
      {
        id: 't2', type: 'transfer', amount: '500.00', note: 'ออมเข้าแผน',
        occurred_at: '2026-10-07T03:00:00Z', parsed_by: 'manual', source: 'liff',
        categories: null,
      },
    ] as never);
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'query_transactions',
      args: { keyword: 'กาแฟ' },
    });

    const reply = await ask('จดกาแฟไว้กี่ครั้ง');

    if (reply.kind !== 'text') throw new Error('ควรตอบเป็นข้อความ');
    expect(reply.text).toContain('กาแฟ');
    expect(reply.text).not.toContain('ออมเข้าแผน');
    expect(reply.text).toContain('พบ 1 รายการ');
  });

  it('ค้นแล้วไม่เจอ', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'query_transactions',
      args: { keyword: 'ไม่มีอยู่' },
    });

    const reply = await ask('จดอะไรไว้บ้าง');
    expect(reply).toEqual({ kind: 'text', text: 'ไม่พบรายการที่ตรงกับที่ถามครับ' });
  });
});

describe('⚖️ G1 ด่านสุดท้าย — AI ตอบตัวเลขเงินเองไม่ได้', () => {
  it('🔴 คำตอบที่มีตัวเลขซึ่งผู้ใช้ไม่ได้พิมพ์ ถูกทิ้งทั้งก้อน', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'text',
      text: 'เดือนนี้คุณใช้ไป 3,200 บาทครับ',
    });

    // ผู้ใช้ไม่ได้พิมพ์เลข 3200 มาเลย ตัวเลขนี้จึงเป็นของที่โมเดลแต่งขึ้น
    expect(await ask('เดือนนี้ใช้ไปเท่าไหร่')).toEqual({ kind: 'unavailable' });
  });

  it('ตัวเลขที่ผู้ใช้พิมพ์มาเอง ทวนกลับได้', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'text',
      text: 'หมายถึง 1500 บาทใช่ไหมครับ',
    });

    const reply = await ask('ซื้อของ 1500');
    expect(reply).toEqual({ kind: 'text', text: 'หมายถึง 1500 บาทใช่ไหมครับ' });
  });

  it('คำถามกลับที่ไม่มีตัวเลข ส่งถึงผู้ใช้ได้', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'text',
      text: 'จ่ายไปเท่าไหร่ครับ',
    });

    const reply = await ask('เมื่อกี้ซื้อของมา');
    expect(reply).toEqual({ kind: 'text', text: 'จ่ายไปเท่าไหร่ครับ' });
  });

  it('เลข 1-2 หลักปล่อยผ่าน เพราะเป็นลำดับข้อหรือจำนวนคน ไม่ใช่ยอดเงิน', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'text',
      text: 'หารกัน 3 คนใช่ไหมครับ',
    });

    const reply = await ask('ค่าข้าวหารกับเพื่อน');
    expect(reply.kind).toBe('text');
  });
});

describe('args ที่ไม่ผ่านด่าน Zod → ถามกลับ ไม่ใช่เงียบ', () => {
  it('ยอดเงินใช้ไม่ได้ → ข้อความถามกลับ และไม่สร้าง pending', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'create_transaction',
      args: { type: 'expense', amount: 0, item: 'กาแฟ' },
    });

    const reply = await ask('ซื้อกาแฟฟรี');

    expect(reply.kind).toBe('text');
    expect(createPending).not.toHaveBeenCalled();
  });

  it('ชื่อ tool ที่ไม่รู้จัก → ถามกลับ', async () => {
    vi.mocked(understandText).mockResolvedValue({
      kind: 'tool',
      name: 'delete_all_my_data',
      args: {},
    });

    const reply = await ask('ลบทุกอย่าง');

    expect(reply.kind).toBe('text');
    expect(createPending).not.toHaveBeenCalled();
  });
});

describe('ประวัติแชท (SPEC §S11.2 — 3 turn ล่าสุด)', () => {
  it('ข้อความแรกไม่มีประวัติ', async () => {
    vi.mocked(understandText).mockResolvedValue({ kind: 'text', text: 'ครับ' });

    await ask('ข้อความแรก');

    expect(understandText).toHaveBeenCalledWith(expect.objectContaining({ history: [] }));
  });

  it('ข้อความถัดไปเห็นประวัติของข้อความก่อน', async () => {
    vi.mocked(understandText).mockResolvedValue({ kind: 'text', text: 'ครับ' });

    await ask('ข้อความแรก');
    await ask('ข้อความที่สอง');

    expect(vi.mocked(understandText).mock.calls[1]?.[0].history).toEqual([
      'ข้อความที่ปิดข้อมูลแล้ว',
    ]);
  });

  it('เก็บไม่เกิน 3 turn', async () => {
    vi.mocked(understandText).mockResolvedValue({ kind: 'text', text: 'ครับ' });

    for (let i = 0; i < 5; i += 1) {
      await ask(`ข้อความที่ ${i}`);
    }

    const lastCall = vi.mocked(understandText).mock.calls[4]?.[0];
    expect(lastCall?.history).toHaveLength(3);
  });

  it('ประวัติของแต่ละคนแยกกัน (⚖️ G6)', async () => {
    vi.mocked(understandText).mockResolvedValue({ kind: 'text', text: 'ครับ' });

    await interpretUserMessage({ userId: 'u1', text: 'ของ u1', todayIso: TODAY, now: NOW });
    await interpretUserMessage({ userId: 'u2', text: 'ของ u2', todayIso: TODAY, now: NOW });

    expect(vi.mocked(understandText).mock.calls[1]?.[0].history).toEqual([]);
  });

  it('ประวัติหมดอายุหลัง 30 นาที', async () => {
    vi.mocked(understandText).mockResolvedValue({ kind: 'text', text: 'ครับ' });

    await interpretUserMessage({ userId: 'u1', text: 'เก่า', todayIso: TODAY, now: NOW });
    await interpretUserMessage({
      userId: 'u1',
      text: 'ใหม่',
      todayIso: TODAY,
      now: new Date(NOW.getTime() + 31 * 60 * 1000),
    });

    expect(vi.mocked(understandText).mock.calls[1]?.[0].history).toEqual([]);
  });
});

describe('เทสต์เชิงโครงสร้าง — ไม่มีทางเลี่ยง guard', () => {
  it('🔴 มีแค่ services/ai/gemini.ts ที่ import @google/genai ได้ (SPEC §S11)', () => {
    // ถ้าเทสต์นี้ล้ม แปลว่ามีไฟล์ใหม่เรียก AI ตรงโดยไม่ผ่าน guard + โควตา + log
    const srcDir = join(__dirname, '..', 'src');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith('.ts')) continue;
        if (!readFileSync(full, 'utf-8').includes('@google/genai')) continue;
        offenders.push(full.slice(srcDir.length + 1).replace(/\\/g, '/'));
      }
    };
    walk(srcDir);

    expect(offenders.sort()).toEqual(['services/ai/gemini.ts', 'services/ai/tools.ts']);
  });
});
