// ไฟล์นี้ทำหน้าที่อะไร: test parser อีเมลแจ้งเตือนของ K PLUS
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8
// ⚖️ กฎเหล็ก G1, G3
//
// ⚠️ ข้อความตัวอย่างในไฟล์นี้เป็นข้อความที่แต่งขึ้นเอง ไม่ใช่อีเมลจริงของธนาคาร
// (SPEC §S8 บังคับว่าตัวอย่างใน repo ต้องไม่มีเลขบัญชี ชื่อ หรือยอดเงินจริง)
// เมื่อได้อีเมล K PLUS ของจริงมาแล้ว ให้เพิ่มเป็น fixture แล้วปรับ pattern ใน kbank.ts

import { describe, expect, it } from 'vitest';
import { kbankParser } from '../src/services/email/banks/kbank';

describe('kbankParser.matches', () => {
  it('จับอีเมลจากโดเมนกสิกร', () => {
    expect(kbankParser.matches('no-reply@kasikornbank.com', 'แจ้งเตือน', '')).toBe(true);
  });

  it('จับจากเนื้อความภาษาไทย', () => {
    expect(kbankParser.matches('a@b.com', '', 'ธนาคารกสิกรไทย แจ้งเตือน')).toBe(true);
  });

  it('ไม่จับอีเมลทั่วไป', () => {
    expect(kbankParser.matches('friend@gmail.com', 'กินข้าวกัน', 'ว่างไหม')).toBe(false);
  });
});

describe('kbankParser.parse — อ่านได้', () => {
  it('เงินออก: อ่านยอด ทิศทาง เลขอ้างอิง และเวลาได้ครบ', () => {
    const text = [
      'ธนาคารกสิกรไทย แจ้งเตือนรายการ',
      'ชำระเงิน ร้านตัวอย่าง',
      'จำนวนเงิน 1,250.50 บาท',
      'วันที่ 14/09/2569 10:30',
      'เลขที่รายการ KB1234567890',
    ].join('\n');

    expect(kbankParser.parse(text)).toEqual({
      amountSatang: 125050,
      type: 'expense',
      occurredAt: new Date('2026-09-14T10:30:00+07:00'),
      refNumber: 'KB1234567890',
    });
  });

  it('เงินเข้า: ทิศทางเป็น income', () => {
    const text = 'เงินเข้าบัญชี\nจำนวนเงิน 500.00 บาท\nวันที่ 01/09/2569 08:00';
    expect(kbankParser.parse(text)?.type).toBe('income');
  });

  it('แปลงปี ค.ศ. 4 หลักได้', () => {
    const text = 'เงินเข้า\nจำนวนเงิน 100.00 บาท\nวันที่ 14/09/2026 09:00';
    expect(kbankParser.parse(text)?.occurredAt).toEqual(new Date('2026-09-14T09:00:00+07:00'));
  });

  it('แปลงปี พ.ศ. 2 หลักได้ (69 = 2569 = ค.ศ. 2026)', () => {
    const text = 'เงินเข้า\nจำนวนเงิน 100.00 บาท\nวันที่ 14/09/69 09:00';
    expect(kbankParser.parse(text)?.occurredAt).toEqual(new Date('2026-09-14T09:00:00+07:00'));
  });

  it('ไม่มีเลขอ้างอิงก็ยังอ่านได้ แค่ refNumber เป็น null', () => {
    const text = 'ชำระเงิน\nจำนวนเงิน 80.00 บาท';
    const result = kbankParser.parse(text);
    expect(result?.amountSatang).toBe(8000);
    expect(result?.refNumber).toBeNull();
  });

  it('ไม่มีวันเวลาก็ยังอ่านได้ แค่ occurredAt เป็น null', () => {
    const text = 'ชำระเงิน\nจำนวนเงิน 80.00 บาท';
    expect(kbankParser.parse(text)?.occurredAt).toBeNull();
  });

  it('เก็บทศนิยมสตางค์ไว้ครบ ไม่ปัดทิ้ง', () => {
    const text = 'ชำระเงิน\nจำนวนเงิน 45.50 บาท';
    expect(kbankParser.parse(text)?.amountSatang).toBe(4550);
  });
});

describe('kbankParser.parse — ต้องคืน null (ห้ามเดา)', () => {
  it('ไม่มีคำบอกทิศทางเงิน', () => {
    expect(kbankParser.parse('จำนวนเงิน 100.00 บาท')).toBeNull();
  });

  it('ไม่มีจำนวนเงิน', () => {
    expect(kbankParser.parse('ชำระเงิน ร้านตัวอย่าง เรียบร้อย')).toBeNull();
  });

  it('ข้อความว่าง', () => {
    expect(kbankParser.parse('')).toBeNull();
  });

  it('ยอดเกินเพดาน MAX_AMOUNT_SATANG ต้องไม่ผ่าน', () => {
    // 10,000,001 บาท เกินเพดาน 10 ล้านบาทของตาราง transactions
    expect(kbankParser.parse('ชำระเงิน\nจำนวนเงิน 10000001.00 บาท')).toBeNull();
  });

  it('ยอดเป็นศูนย์ต้องไม่ผ่าน (G3 เงินต้องมากกว่า 0)', () => {
    expect(kbankParser.parse('ชำระเงิน\nจำนวนเงิน 0.00 บาท')).toBeNull();
  });
});
