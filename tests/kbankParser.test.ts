// ไฟล์นี้ทำหน้าที่อะไร: test parser อีเมลแจ้งเตือนของ K PLUS กับตัวอย่างรูปแบบจริง
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 / tests/fixtures/kplus/
// ⚖️ กฎเหล็ก G1, G3
//
// fixture คัดโครงสร้างจากอีเมลจริง แต่ลบเลขบัญชี ชื่อ และยอดเงินจริงออกแล้วตามที่ SPEC บังคับ
// ดูรายละเอียดการลบข้อมูลได้ที่ tests/fixtures/kplus/README.md

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kbankParser } from '../src/services/email/banks/kbank';

const FIXTURES = join(__dirname, 'fixtures', 'kplus');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

const billPayment = load('bill-payment-success.txt');
const promptPay = load('promptpay-transfer-success.txt');
const wallet = load('promptpay-wallet-success.txt');

describe('kbankParser.matches', () => {
  it('จับอีเมลจากที่อยู่ของ K PLUS', () => {
    expect(kbankParser.matches('K PLUS <KPLUS@kasikornbank.com>', '', '')).toBe(true);
  });

  it('จับจากเนื้อความภาษาไทย', () => {
    expect(kbankParser.matches('a@b.com', '', 'บมจ. ธนาคารกสิกรไทย')).toBe(true);
  });

  it('ไม่จับอีเมลทั่วไป', () => {
    expect(kbankParser.matches('friend@gmail.com', 'กินข้าวกัน', 'ว่างไหม')).toBe(false);
  });
});

describe('kbankParser.parse — ชำระค่าสินค้าและบริการ', () => {
  it('อ่านครบทุกฟิลด์', () => {
    expect(kbankParser.parse(billPayment)).toEqual({
      amountSatang: 12550,
      type: 'expense',
      occurredAt: new Date('2026-09-14T09:36:15+07:00'),
      refNumber: '019900000000CPM00000',
    });
  });
});

describe('kbankParser.parse — โอนเงินพร้อมเพย์', () => {
  it('โอนไปเบอร์พร้อมเพย์ = เงินออก', () => {
    expect(kbankParser.parse(promptPay)).toEqual({
      amountSatang: 25000,
      type: 'expense',
      occurredAt: new Date('2026-09-13T16:36:11+07:00'),
      refNumber: '019900000000CPP00000',
    });
  });

  it('โอนไป Wallet และยอดมี comma คั่นหลักพัน', () => {
    expect(kbankParser.parse(wallet)).toEqual({
      amountSatang: 108025,
      type: 'expense',
      occurredAt: new Date('2026-09-07T11:57:40+07:00'),
      refNumber: '019900000000DPP00000',
    });
  });
});

describe('kbankParser.parse — ต้องไม่หยิบตัวเลขผิดตัว', () => {
  // อีเมลจริงมีตัวเลขหน่วยบาท 3 ตัววางติดกัน นี่คือจุดที่ regex กว้างเกินจะพลาด
  it('ไม่เอา "ค่าธรรมเนียม (บาท): 0.00" มาเป็นยอดรายการ', () => {
    expect(kbankParser.parse(billPayment)?.amountSatang).not.toBe(0);
  });

  it('ไม่เอา "ยอดถอนได้ (บาท): 1,234.56" (ยอดคงเหลือ) มาเป็นยอดรายการ', () => {
    expect(kbankParser.parse(billPayment)?.amountSatang).not.toBe(123456);
  });

  it('ยอดที่ได้ต้องตรงกับบรรทัด "จำนวนเงิน" เท่านั้น', () => {
    expect(kbankParser.parse(wallet)?.amountSatang).toBe(108025); // ไม่ใช่ 234515 ของยอดถอนได้
  });

  it('ไม่เอาเลขวันที่หรือเบอร์โทรมาเป็นยอด', () => {
    const amount = kbankParser.parse(promptPay)?.amountSatang;
    expect(amount).toBe(25000);
  });
});

describe('kbankParser.parse — รายการที่ไม่สำเร็จต้องไม่ถูกบันทึก', () => {
  it('อีเมลที่มีคำว่า "ไม่สำเร็จ" ต้องคืน null', () => {
    const failed = billPayment.replace('(สำเร็จ)', '(ไม่สำเร็จ)');
    expect(kbankParser.parse(failed)).toBeNull();
  });

  it('อีเมลภาษาอังกฤษที่ Unsuccessful ต้องคืน null', () => {
    const failed = billPayment
      .replace('(สำเร็จ)', '(ไม่สำเร็จ)')
      .replace('(Success)', '(Unsuccessful)');
    expect(kbankParser.parse(failed)).toBeNull();
  });

  it('ไม่มีคำยืนยันว่าสำเร็จเลยก็ต้องคืน null (fail closed)', () => {
    const unclear = billPayment.replaceAll('สำเร็จ', '').replaceAll('Success', '');
    expect(kbankParser.parse(unclear)).toBeNull();
  });
});

describe('kbankParser.parse — ต้องคืน null (ห้ามเดา)', () => {
  it('ไม่มีบรรทัดบอกบัญชีต้นทาง = อ่านทิศทางไม่ได้', () => {
    const noDirection = billPayment.replace('ชำระเงินจากบัญชี', 'ข้อมูลอื่น')
      .replace('Paid From Account', 'Other Info');
    expect(kbankParser.parse(noDirection)).toBeNull();
  });

  it('ไม่มีบรรทัดจำนวนเงิน', () => {
    const noAmount = billPayment
      .replace('จำนวนเงิน (บาท): 125.50', '')
      .replace('Amount (THB): 125.50', '');
    expect(kbankParser.parse(noAmount)).toBeNull();
  });

  it('ข้อความว่าง', () => {
    expect(kbankParser.parse('')).toBeNull();
  });

  it('ยอดเกินเพดาน 10 ล้านบาทต้องไม่ผ่าน', () => {
    const huge = billPayment.replace('125.50', '10000001.00');
    expect(kbankParser.parse(huge)).toBeNull();
  });

  it('ยอดเป็นศูนย์ต้องไม่ผ่าน (G3)', () => {
    const zero = billPayment
      .replace('จำนวนเงิน (บาท): 125.50', 'จำนวนเงิน (บาท): 0.00')
      .replace('Amount (THB): 125.50', 'Amount (THB): 0.00');
    expect(kbankParser.parse(zero)).toBeNull();
  });
});

describe('kbankParser.parse — อ่านจากภาษาอังกฤษได้ถ้าส่วนไทยหาย', () => {
  it('เหลือแต่ส่วนอังกฤษก็ยังอ่านออก', () => {
    const englishOnly = [
      'Subject: Result of Payment (Success)',
      '        Transaction Date: 14/09/2026  09:36:15',
      '        Transaction Number: 019900000000CPM00000',
      '        Paid From Account: xxx-x-x0000-x',
      '        Amount (THB): 125.50',
      '        Fee (THB): 0.00',
      '        Available Balance (THB): 1,234.56',
    ].join('\n');

    expect(kbankParser.parse(englishOnly)).toEqual({
      amountSatang: 12550,
      type: 'expense',
      occurredAt: new Date('2026-09-14T09:36:15+07:00'),
      refNumber: '019900000000CPM00000',
    });
  });
});
