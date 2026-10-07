// ไฟล์นี้ทำหน้าที่อะไร: test การตรวจผลที่ Gemini Vision ส่งกลับจากการอ่านสลิป
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S9 ตาราง "ฟิลด์ที่อ่าน" + sanity check
// ⚖️ กฎเหล็ก G1, G5
//
// ⚠️ SPEC §7 บังคับว่า "ห้ามเรียก Gemini จริงใน test" — ไฟล์นี้เทสต์ validateSlipJson()
// ซึ่งเป็นฟังก์ชันบริสุทธิ์ที่รับ JSON ดิบ จึงไม่ต้องแตะ provider เลยแม้แต่น้อย
//
// 🔴 น้ำหนักของเทสต์ชุดนี้อยู่ที่ "ของที่ต้องไม่ผ่าน"
// สลิปที่อ่านผิดแล้วบันทึกไป = ยอดเงินของผู้ใช้เพี้ยนถาวร
// ยอมบอกว่า "อ่านไม่ชัด ลองพิมพ์เอง" ดีกว่าเดาแล้วบันทึก

import { describe, expect, it } from 'vitest';
import { validateSlipJson } from '../src/services/ai/vision';

const NOW = new Date('2026-10-07T10:00:00+07:00');

function good(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    is_slip: true,
    amount: 3500,
    datetime: '2026-10-06 14:32',
    receiver: 'หอพักสุขสันต์',
    bank: 'KBank',
    ref_number: '0123456789',
    ...overrides,
  });
}

function expectSlip(result: ReturnType<typeof validateSlipJson>) {
  if (result.kind !== 'slip') {
    throw new Error(`คาดว่าจะอ่านสลิปได้ แต่ได้ ${result.kind}`);
  }
  return result.slip;
}

function expectUnreadable(result: ReturnType<typeof validateSlipJson>) {
  if (result.kind !== 'unreadable') {
    throw new Error(`คาดว่าจะอ่านไม่ได้ แต่ได้ ${result.kind}`);
  }
  return result;
}

describe('สลิปที่อ่านได้ครบ', () => {
  it('แปลงยอดเป็นสตางค์ด้วย money.ts (G1, G3)', () => {
    expect(expectSlip(validateSlipJson(good(), NOW)).amountSatang).toBe(350000);
  });

  it('ยอดที่มีสตางค์ไม่เพี้ยน', () => {
    expect(expectSlip(validateSlipJson(good({ amount: 125.5 }), NOW)).amountSatang).toBe(12550);
  });

  it('ยอดที่พิมพ์มาแบบมี comma คั่นหลักพัน (สลิปจริงเขียนแบบนี้)', () => {
    expect(expectSlip(validateSlipJson(good({ amount: '12,500.75' }), NOW)).amountSatang).toBe(
      1250075
    );
  });

  it('🔴 เวลาบนสลิปถูกตีความเป็นเวลาไทย ไม่ใช่ UTC', () => {
    // 14:32 เวลาไทย = 07:32 UTC — ถ้าตีความผิดเป็น UTC รายการจะเลื่อนไป 7 ชั่วโมง
    // พอทำให้รายการตอนเช้าตรู่ข้ามไปเป็นวันก่อนหน้าได้
    const slip = expectSlip(validateSlipJson(good(), NOW));
    expect(slip.occurredAtIso).toBe('2026-10-06T07:32:00.000Z');
  });

  it('รับรูป ISO ที่มีเขตเวลาติดมาเองด้วย', () => {
    const slip = expectSlip(
      validateSlipJson(good({ datetime: '2026-10-06T07:32:00Z' }), NOW)
    );
    expect(slip.occurredAtIso).toBe('2026-10-06T07:32:00.000Z');
  });

  it('มีแต่วันไม่มีเวลา → เที่ยงวันไทย (กันวันเลื่อนข้ามเขตเวลา)', () => {
    const slip = expectSlip(validateSlipJson(good({ datetime: '2026-10-06' }), NOW));
    expect(slip.occurredAtIso).toBe('2026-10-06T05:00:00.000Z');
  });

  it('ช่องที่ไม่บังคับเป็น null ได้ ยังอ่านสลิปผ่าน', () => {
    const slip = expectSlip(
      validateSlipJson(good({ receiver: null, bank: null, ref_number: null }), NOW)
    );
    expect(slip.receiver).toBeNull();
    expect(slip.bank).toBeNull();
    expect(slip.refNumber).toBeNull();
    expect(slip.amountSatang).toBe(350000);
  });
});

describe('⚖️ G5 — ปิดเลขบัญชีในผลลัพธ์ (SPEC §S9)', () => {
  it('🔴 เลขบัญชีที่หลุดมาในชื่อผู้รับถูกปิด', () => {
    // prompt สั่งห้ามส่งเลขบัญชีแล้ว แต่โมเดลอาจไม่ทำตาม ต้องมีด่านบังคับอีกชั้น
    const slip = expectSlip(
      validateSlipJson(good({ receiver: 'นายสมชาย 1234567890' }), NOW)
    );
    expect(slip.receiver).toBe('นายสมชาย [REDACTED]');
    expect(slip.receiver).not.toContain('1234567890');
  });

  it('🔴 เลขอ้างอิงต้องไม่ถูกปิด ไม่งั้นกุญแจกันซ้ำของ S10 ใช้ไม่ได้', () => {
    // redactSensitiveText ปิดเลข 9 หลักขึ้นไป ซึ่งคลุมเลขอ้างอิงพอดี
    // ถ้าเผลอ redact ช่องนี้ สลิปใบเดิมจะถูกบันทึกซ้ำได้
    const slip = expectSlip(validateSlipJson(good({ ref_number: '0123456789' }), NOW));
    expect(slip.refNumber).toBe('0123456789');
  });

  it('เลขอ้างอิงถูก normalize ให้เหลือตัวอักษรกับตัวเลข', () => {
    // ธนาคารแต่ละแห่งพิมพ์คนละรูป สลิปใบเดิมถ่ายสองครั้งต้องได้ ref เดียวกัน
    expect(expectSlip(validateSlipJson(good({ ref_number: '0123 4567 89' }), NOW)).refNumber).toBe(
      '0123456789'
    );
    expect(expectSlip(validateSlipJson(good({ ref_number: 'Ref-0123456789' }), NOW)).refNumber).toBe(
      'Ref0123456789'
    );
  });

  it('เลขอ้างอิงสั้นเกินกว่าจะเป็นของจริง → null', () => {
    expect(expectSlip(validateSlipJson(good({ ref_number: '12' }), NOW)).refNumber).toBeNull();
  });
});

describe('ทางที่ผิด — ต้องไม่ยอมอ่าน', () => {
  it('รูปที่ไม่ใช่สลิป', () => {
    const failed = expectUnreadable(validateSlipJson(good({ is_slip: false }), NOW));
    expect(failed.reason).toContain('ไม่ใช่สลิป');
    // ต้องบอกทางไปต่อด้วย ไม่ใช่แค่บอกว่าผิด (G4)
    expect(failed.reason).toContain('ค่าข้าว 60');
  });

  it('JSON ที่พังอ่านไม่ออก', () => {
    expectUnreadable(validateSlipJson('{ อันนี้ไม่ใช่ JSON', NOW));
    expectUnreadable(validateSlipJson('', NOW));
    expectUnreadable(validateSlipJson('```json\n{"is_slip":true}\n```', NOW));
  });

  it('ขาด is_slip (ไม่ตรง schema)', () => {
    expectUnreadable(validateSlipJson(JSON.stringify({ amount: 100 }), NOW));
  });

  it('อ่านยอดไม่ได้ → ขอให้พิมพ์เอง', () => {
    const failed = expectUnreadable(validateSlipJson(good({ amount: null }), NOW));
    expect(failed.reason).toContain('พิมพ์ยอด');
  });

  it('ยอด 0 หรือติดลบ', () => {
    expectUnreadable(validateSlipJson(good({ amount: 0 }), NOW));
    expectUnreadable(validateSlipJson(good({ amount: -500 }), NOW));
  });

  it('ยอดเกินเพดาน 10 ล้านบาท', () => {
    expectUnreadable(validateSlipJson(good({ amount: 20_000_000 }), NOW));
  });

  it('ยอดเป็นข้อความที่ไม่ใช่ตัวเลข', () => {
    expectUnreadable(validateSlipJson(good({ amount: 'สามพันห้า' }), NOW));
  });

  it('อ่านวันเวลาไม่ได้', () => {
    expectUnreadable(validateSlipJson(good({ datetime: null }), NOW));
    expectUnreadable(validateSlipJson(good({ datetime: '' }), NOW));
    expectUnreadable(validateSlipJson(good({ datetime: 'เมื่อวาน' }), NOW));
    expectUnreadable(validateSlipJson(good({ datetime: '06/10/2026' }), NOW));
  });

  it('🔴 สลิปลงวันอนาคต = อ่านผิด ไม่ใช่สลิปจริง (SPEC §S9)', () => {
    // เคสจริงที่เจอบ่อย: อ่านปี พ.ศ. 2569 เป็น ค.ศ. 2569
    const failed = expectUnreadable(validateSlipJson(good({ datetime: '2569-10-06 14:32' }), NOW));
    expect(failed.reason).toContain('อนาคต');
  });

  it('อนาคตแค่ไม่กี่นาทียังรับได้ (นาฬิกาธนาคารเดินเร็วกว่าเซิร์ฟเวอร์)', () => {
    // 10:02 ไทย ขณะที่ now = 10:00 ไทย → ห่าง 2 นาที อยู่ในช่วงผ่อนผัน 5 นาที
    const slip = expectSlip(validateSlipJson(good({ datetime: '2026-10-07 10:02' }), NOW));
    expect(slip.amountSatang).toBe(350000);
  });

  it('อนาคตเกินช่วงผ่อนผัน ไม่รับ', () => {
    expectUnreadable(validateSlipJson(good({ datetime: '2026-10-07 10:30' }), NOW));
  });

  it('วันที่ที่ไม่มีอยู่จริง', () => {
    expectUnreadable(validateSlipJson(good({ datetime: '2026-02-31 10:00' }), NOW));
  });

  it('ทุกข้อความที่ตอบผู้ใช้ต้องอ่านรู้เรื่อง ไม่ใช่รหัส error', () => {
    const cases = [
      good({ amount: null }),
      good({ datetime: null }),
      good({ is_slip: false }),
      'ไม่ใช่ JSON',
    ];
    for (const raw of cases) {
      expect(expectUnreadable(validateSlipJson(raw, NOW)).reason.length).toBeGreaterThan(15);
    }
  });
});

describe('ความคงที่ของผลลัพธ์ (G1 — อ่านเท่าไหร่ต้องได้เท่านั้นทุกครั้ง)', () => {
  it('JSON เดิมให้ผลเดิมเป๊ะ 5 ครั้งติด', () => {
    const results = Array.from({ length: 5 }, () => validateSlipJson(good(), NOW));
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });
});
