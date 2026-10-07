// ไฟล์นี้ทำหน้าที่อะไร: test ด่าน Zod + sanity check ของ args ที่ AI ส่งมา
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.2 Tool catalog + "การแปลง args เป็นข้อมูลจริง" + Sanity check
// ⚖️ กฎเหล็ก G1, G3
//
// 🔴 เทสต์ชุดนี้คือหลักฐานของ G1
// สมมติฐานของทุกเคสคือ "โมเดลส่งอะไรมาก็ได้ รวมทั้งของที่ผิด" แล้วพิสูจน์ว่า
// ของที่ผิดไปถึงฐานข้อมูลไม่ได้ และตัวเลขที่ไปถึงฐานข้อมูลถูกแปลงด้วย money.ts เท่านั้น

import { describe, expect, it } from 'vitest';
import {
  AI_TOOL_NAMES,
  geminiToolDeclarations,
  isWriteTool,
  MAX_QUERY_LIMIT,
  validateToolCall,
} from '../src/services/ai/tools';

const TODAY = '2026-10-07';

/** ดึง call ออกมาโดยยืนยันว่าผ่านด่าน — ให้เทสต์ล้มที่บรรทัดที่เกี่ยวข้องจริง */
function expectOk(result: ReturnType<typeof validateToolCall>) {
  if (!result.ok) {
    throw new Error(`คาดว่าจะผ่านด่าน แต่ตกด่าน: ${result.errorCode} — ${result.askUser}`);
  }
  return result.call;
}

function expectFail(result: ReturnType<typeof validateToolCall>) {
  if (result.ok) {
    throw new Error(`คาดว่าจะตกด่าน แต่ผ่าน: ${JSON.stringify(result.call)}`);
  }
  return result;
}

describe('ทะเบียน tool', () => {
  it('ประกาศให้ Gemini ครบทั้ง 8 ตัวและชื่อตรงกับทะเบียน', () => {
    expect(AI_TOOL_NAMES).toHaveLength(8);
    expect(geminiToolDeclarations).toHaveLength(8);
    expect(geminiToolDeclarations.map((tool) => tool.name).sort()).toEqual(
      [...AI_TOOL_NAMES].sort()
    );
  });

  it('tool ที่เขียนข้อมูลถูกจัดเป็น write ครบ และ tool อ่านไม่ถูกจัดผิด', () => {
    expect(AI_TOOL_NAMES.filter(isWriteTool)).toEqual([
      'create_transaction',
      'create_transaction_batch',
      'update_transaction',
      'delete_transaction',
      'create_recurring',
    ]);
    expect(isWriteTool('get_summary')).toBe(false);
    expect(isWriteTool('query_transactions')).toBe(false);
    expect(isWriteTool('simulate_purchase')).toBe(false);
  });

  it('ทุก tool มี parameters เป็น object (ไม่งั้น SDK ปฏิเสธตอนส่ง)', () => {
    for (const tool of geminiToolDeclarations) {
      expect(tool.parameters?.type).toBe('OBJECT');
    }
  });
});

describe('create_transaction — แปลงหน่วยเงินด้วย money.ts เท่านั้น (G1, G3)', () => {
  it('80 บาท → 8000 สตางค์', () => {
    const call = expectOk(
      validateToolCall('create_transaction', { type: 'expense', amount: 80, item: 'กาแฟ' }, TODAY)
    );
    expect(call).toEqual({
      name: 'create_transaction',
      entry: {
        type: 'expense',
        amountSatang: 8000,
        totalSatang: 8000,
        splitCount: 1,
        item: 'กาแฟ',
        occurredAtIso: null,
        categoryHint: null,
      },
    });
  });

  it('ยอดที่มีสตางค์ไม่เพี้ยนเพราะ float', () => {
    const call = expectOk(
      validateToolCall('create_transaction', { type: 'expense', amount: 125.5, item: 'ข้าว' }, TODAY)
    );
    expect(call.name === 'create_transaction' && call.entry.amountSatang).toBe(12550);
  });

  it('โมเดลส่งยอดมาเป็น string ก็ยังอ่านออก', () => {
    const call = expectOk(
      validateToolCall('create_transaction', { type: 'expense', amount: '60', item: 'ข้าว' }, TODAY)
    );
    expect(call.name === 'create_transaction' && call.entry.amountSatang).toBe(6000);
  });

  it('หารบิล: ส่งยอดเต็ม + จำนวนคน แล้วโค้ดหารให้ ไม่ใช่โมเดลหาร', () => {
    const call = expectOk(
      validateToolCall(
        'create_transaction',
        { type: 'expense', amount: 300, item: 'ค่าข้าว', split_count: 3 },
        TODAY
      )
    );
    if (call.name !== 'create_transaction') throw new Error('tool ผิดตัว');
    expect(call.entry.totalSatang).toBe(30000);
    expect(call.entry.amountSatang).toBe(10000);
    expect(call.entry.splitCount).toBe(3);
  });

  it('หารไม่ลงตัว — ผู้ใช้ได้ก้อนที่รวมเศษ ไม่ใช่ก้อนที่น้อยกว่าที่จ่ายจริง', () => {
    // 100 บาท หาร 3 = 3334 + 3333 + 3333 (รวม 10000 เป๊ะ)
    const call = expectOk(
      validateToolCall(
        'create_transaction',
        { type: 'expense', amount: 100, item: 'ค่าข้าว', split_count: 3 },
        TODAY
      )
    );
    expect(call.name === 'create_transaction' && call.entry.amountSatang).toBe(3334);
  });

  it('date_text ถูกแปลงเป็นวันที่จริง ไม่ใช่เก็บคำดิบไว้', () => {
    const call = expectOk(
      validateToolCall(
        'create_transaction',
        { type: 'expense', amount: 80, item: 'กาแฟ', date_text: 'เมื่อวาน' },
        TODAY
      )
    );
    expect(call.name === 'create_transaction' && call.entry.occurredAtIso).toBe('2026-10-06');
  });

  it('category_hint ถูกส่งต่อแบบคำดิบ (การจับคู่หมวดจริงเป็นงานของ router)', () => {
    const call = expectOk(
      validateToolCall(
        'create_transaction',
        { type: 'expense', amount: 80, item: 'กาแฟ', category_hint: ' อาหาร ' },
        TODAY
      )
    );
    expect(call.name === 'create_transaction' && call.entry.categoryHint).toBe('อาหาร');
  });
});

describe('ทางที่ผิดของ create_transaction', () => {
  it('ยอด 0 ไม่ใช่รายการเงิน', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: 0, item: 'x' }, TODAY)
    ).errorCode).toBe('bad_amount');
  });

  it('ยอดติดลบ — ทิศทางเงินใช้ฟิลด์ type ไม่ใช่เครื่องหมายลบ (G3)', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: -50, item: 'x' }, TODAY)
    ).errorCode).toBe('bad_amount');
  });

  it('ยอดเกินเพดาน 10 ล้านบาท', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: 20_000_000, item: 'x' }, TODAY)
    ).errorCode).toBe('bad_amount');
  });

  it('ยอดเป็นข้อความที่ไม่ใช่ตัวเลข', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: 'แปดสิบ', item: 'x' }, TODAY)
    ).errorCode).toBe('bad_amount');
  });

  it('ยอดเป็น NaN หรือ Infinity ถูกปฏิเสธ (ต่างด่านกัน แต่ไปต่อไม่ได้ทั้งคู่)', () => {
    // NaN ตกที่ Zod เพราะ z.number() ไม่รับ NaN
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: NaN, item: 'x' }, TODAY)
    ).errorCode).toBe('invalid_args');
    // Infinity ผ่าน Zod ได้ (z.number() ไม่ได้ห้าม) แล้วตกที่ด่านแปลงหน่วยเงิน
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: Infinity, item: 'x' }, TODAY)
    ).errorCode).toBe('bad_amount');
  });

  it('ขาดฟิลด์บังคับ', () => {
    expect(expectFail(validateToolCall('create_transaction', { amount: 80 }, TODAY)).errorCode).toBe(
      'invalid_args'
    );
  });

  it('type ที่ไม่มีในระบบ (รวมทั้ง transfer ซึ่งต้องไปทางคำสั่ง ออม — G7)', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'transfer', amount: 80, item: 'x' }, TODAY)
    ).errorCode).toBe('invalid_args');
  });

  it('หาร 1 คนไม่ใช่การหาร และหารเกิน 50 คนไม่สมเหตุผล', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: 300, item: 'x', split_count: 1 }, TODAY)
    ).errorCode).toBe('bad_split_count');
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: 300, item: 'x', split_count: 51 }, TODAY)
    ).errorCode).toBe('bad_split_count');
  });

  it('หารด้วยจำนวนที่ไม่ใช่จำนวนเต็ม', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: 300, item: 'x', split_count: 2.5 }, TODAY)
    ).errorCode).toBe('bad_split_count');
  });

  it('date_text ที่อ่านไม่ออก → ถามกลับ ไม่ใช่ลงเป็นวันนี้', () => {
    const failed = expectFail(
      validateToolCall(
        'create_transaction',
        { type: 'expense', amount: 80, item: 'กาแฟ', date_text: 'สักพักก่อน' },
        TODAY
      )
    );
    expect(failed.errorCode).toBe('bad_date_text');
    expect(failed.askUser).toContain('สักพักก่อน');
  });

  it('ชื่อรายการว่างเปล่า', () => {
    expect(expectFail(
      validateToolCall('create_transaction', { type: 'expense', amount: 80, item: '   ' }, TODAY)
    ).errorCode).toBe('invalid_args');
  });
});

describe('create_transaction_batch', () => {
  it('หลายรายการในข้อความเดียว', () => {
    const call = expectOk(
      validateToolCall(
        'create_transaction_batch',
        {
          items: [
            { type: 'expense', amount: 80, item: 'กาแฟ' },
            { type: 'expense', amount: 60, item: 'ข้าว' },
          ],
        },
        TODAY
      )
    );
    expect(call.name === 'create_transaction_batch' && call.entries).toHaveLength(2);
  });

  it('เกิน 10 รายการไม่รับ', () => {
    const items = Array.from({ length: 11 }, (_, index) => ({
      type: 'expense' as const,
      amount: 10,
      item: `รายการ ${index}`,
    }));
    expect(expectFail(validateToolCall('create_transaction_batch', { items }, TODAY)).errorCode).toBe(
      'invalid_args'
    );
  });

  it('รายการเดียวที่ผิด ทำให้ตกทั้งชุด — ไม่บันทึกบางส่วน', () => {
    const failed = expectFail(
      validateToolCall(
        'create_transaction_batch',
        {
          items: [
            { type: 'expense', amount: 80, item: 'กาแฟ' },
            { type: 'expense', amount: 0, item: 'ของพัง' },
          ],
        },
        TODAY
      )
    );
    expect(failed.errorCode).toBe('bad_amount');
  });

  it('รายการว่างเปล่าไม่รับ', () => {
    expect(expectFail(validateToolCall('create_transaction_batch', { items: [] }, TODAY)).errorCode).toBe(
      'invalid_args'
    );
  });
});

describe('update_transaction / delete_transaction', () => {
  it('แก้ยอดอย่างเดียว', () => {
    const call = expectOk(
      validateToolCall('update_transaction', { target: 'last', changes: { amount: 90 } }, TODAY)
    );
    if (call.name !== 'update_transaction') throw new Error('tool ผิดตัว');
    expect(call.target).toBe('last');
    expect(call.changes).toEqual({ amountSatang: 9000 });
  });

  it('แก้หลายอย่างพร้อมกัน', () => {
    const call = expectOk(
      validateToolCall(
        'update_transaction',
        { target: 'last', changes: { amount: 90, item: 'ลาเต้', date_text: 'เมื่อวาน' } },
        TODAY
      )
    );
    if (call.name !== 'update_transaction') throw new Error('tool ผิดตัว');
    expect(call.changes).toEqual({
      amountSatang: 9000,
      item: 'ลาเต้',
      occurredAtIso: '2026-10-06',
    });
  });

  it('ไม่มีอะไรจะแก้', () => {
    expect(expectFail(
      validateToolCall('update_transaction', { target: 'last', changes: {} }, TODAY)
    ).errorCode).toBe('invalid_args');
  });

  it('แก้ยอดเป็นค่าที่ใช้ไม่ได้', () => {
    expect(expectFail(
      validateToolCall('update_transaction', { target: 'last', changes: { amount: -1 } }, TODAY)
    ).errorCode).toBe('bad_amount');
  });

  it('ลบต้องระบุ target', () => {
    expect(expectOk(validateToolCall('delete_transaction', { target: 'last' }, TODAY))).toEqual({
      name: 'delete_transaction',
      target: 'last',
    });
    expect(expectFail(validateToolCall('delete_transaction', {}, TODAY)).errorCode).toBe(
      'invalid_args'
    );
  });
});

describe('tool อ่านข้อมูล', () => {
  it('get_summary รับเฉพาะ period ที่มีอยู่จริง', () => {
    expect(expectOk(validateToolCall('get_summary', { period: 'remaining' }, TODAY))).toEqual({
      name: 'get_summary',
      period: 'remaining',
    });
    expect(expectFail(validateToolCall('get_summary', { period: 'เดือนหน้า' }, TODAY)).errorCode).toBe(
      'invalid_args'
    );
  });

  it('query_transactions ไม่ส่ง limit มา ใช้ค่าสูงสุด', () => {
    const call = expectOk(validateToolCall('query_transactions', {}, TODAY));
    expect(call.name === 'query_transactions' && call.limit).toBe(MAX_QUERY_LIMIT);
  });

  it('query_transactions limit ที่เพี้ยนถูกหนีบ ไม่ใช่ตกด่าน', () => {
    // limit เป็นเรื่องการแสดงผล ไม่ใช่เรื่องความถูกต้องของเงิน จึงหนีบแล้วเดินต่อ
    const tooBig = expectOk(validateToolCall('query_transactions', { limit: 999 }, TODAY));
    expect(tooBig.name === 'query_transactions' && tooBig.limit).toBe(MAX_QUERY_LIMIT);

    const tooSmall = expectOk(validateToolCall('query_transactions', { limit: 0 }, TODAY));
    expect(tooSmall.name === 'query_transactions' && tooSmall.limit).toBe(1);

    const garbage = expectOk(validateToolCall('query_transactions', { limit: 'เยอะ ๆ' }, TODAY));
    expect(garbage.name === 'query_transactions' && garbage.limit).toBe(MAX_QUERY_LIMIT);
  });

  it('simulate_purchase แปลงราคาเป็นสตางค์', () => {
    const call = expectOk(
      validateToolCall('simulate_purchase', { item_name: 'หูฟัง', price: '1500' }, TODAY)
    );
    expect(call).toEqual({ name: 'simulate_purchase', itemName: 'หูฟัง', priceSatang: 150000 });
  });

  it('simulate_purchase ราคาที่ใช้ไม่ได้', () => {
    expect(expectFail(
      validateToolCall('simulate_purchase', { item_name: 'หูฟัง', price: 0 }, TODAY)
    ).errorCode).toBe('bad_amount');
  });
});

describe('create_recurring', () => {
  it('รายเดือนพร้อมวันที่ของเดือน', () => {
    const call = expectOk(
      validateToolCall(
        'create_recurring',
        { label: 'ค่าหอ', type: 'expense', amount: 3500, frequency: 'monthly', day: 5 },
        TODAY
      )
    );
    expect(call).toEqual({
      name: 'create_recurring',
      label: 'ค่าหอ',
      type: 'expense',
      amountSatang: 350000,
      frequency: 'monthly',
      dayOfMonth: 5,
      dayOfWeek: null,
    });
  });

  it('รายสัปดาห์ day ลงช่อง dayOfWeek ไม่ใช่ dayOfMonth', () => {
    const call = expectOk(
      validateToolCall(
        'create_recurring',
        { label: 'ค่ารถ', type: 'expense', amount: 100, frequency: 'weekly', day: 1 },
        TODAY
      )
    );
    if (call.name !== 'create_recurring') throw new Error('tool ผิดตัว');
    expect(call.dayOfWeek).toBe(1);
    expect(call.dayOfMonth).toBeNull();
  });

  it('รายวันส่ง day มาด้วยก็ทิ้งไป ไม่ต้องรบกวนผู้ใช้', () => {
    const call = expectOk(
      validateToolCall(
        'create_recurring',
        { label: 'ค่ากาแฟ', type: 'expense', amount: 50, frequency: 'daily', day: 9 },
        TODAY
      )
    );
    if (call.name !== 'create_recurring') throw new Error('tool ผิดตัว');
    expect(call.dayOfMonth).toBeNull();
    expect(call.dayOfWeek).toBeNull();
  });

  it('วันที่ของเดือนนอกช่วง 1-31', () => {
    expect(expectFail(
      validateToolCall(
        'create_recurring',
        { label: 'x', type: 'expense', amount: 10, frequency: 'monthly', day: 32 },
        TODAY
      )
    ).errorCode).toBe('bad_day');
  });

  it('วันในสัปดาห์นอกช่วง 0-6', () => {
    expect(expectFail(
      validateToolCall(
        'create_recurring',
        { label: 'x', type: 'expense', amount: 10, frequency: 'weekly', day: 7 },
        TODAY
      )
    ).errorCode).toBe('bad_day');
  });

  it('ความถี่ที่ไม่มีในระบบ', () => {
    expect(expectFail(
      validateToolCall(
        'create_recurring',
        { label: 'x', type: 'expense', amount: 10, frequency: 'ทุกสองเดือน' },
        TODAY
      )
    ).errorCode).toBe('invalid_args');
  });
});

describe('ทางที่ผิดระดับบนสุด', () => {
  it('ชื่อ tool ที่ระบบไม่รู้จัก (โมเดลแต่งชื่อขึ้นมา)', () => {
    const failed = expectFail(validateToolCall('transfer_all_money', { amount: 999 }, TODAY));
    expect(failed.errorCode).toBe('unknown_tool');
  });

  it('args เป็น null หรือ undefined', () => {
    expect(expectFail(validateToolCall('create_transaction', null, TODAY)).errorCode).toBe(
      'invalid_args'
    );
    expect(expectFail(validateToolCall('create_transaction', undefined, TODAY)).errorCode).toBe(
      'invalid_args'
    );
  });

  it('args เป็นชนิดที่ไม่ใช่ object', () => {
    expect(expectFail(validateToolCall('create_transaction', 'กาแฟ 80', TODAY)).errorCode).toBe(
      'invalid_args'
    );
  });

  it('ทุกข้อความตอบผู้ใช้ต้องบอกทางไปต่อ ไม่ใช่แค่บอกว่าผิด', () => {
    const failed = expectFail(validateToolCall('create_transaction', {}, TODAY));
    expect(failed.askUser.length).toBeGreaterThan(10);
  });
});
