// ไฟล์นี้ทำหน้าที่อะไร: ทดสอบ src/utils/money.ts ให้ครบตามที่ SPEC.md §7 บังคับไว้
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W1
// อ้างอิง: SPEC.md §7 "Test (vitest)" — บังคับต้องมี test: money
//   ต้องผ่าน 2 เคสหลักที่ SPEC ระบุชื่อไว้ตรงๆ:
//   1. "บวก ฿0.10 จำนวน 10,000 ครั้ง ต้องได้ ฿1,000.00 เป๊ะ"
//   2. ทุกฟังก์ชันต้องให้ผลเหมือนเดิมทุกครั้งเมื่ออินพุตเดิม (ไม่มี state ค้าง)

import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  add,
  assertValidTransactionAmount,
  formatBaht,
  fromSatang,
  roundDownToSatang,
  roundDownToTenBaht,
  roundHalfUpToSatang,
  splitEvenly,
  toSatang,
} from '../src/utils/money';
import { MAX_AMOUNT_SATANG } from '../src/config/constants';

describe('toSatang: แปลงบาท -> สตางค์', () => {
  it('แปลงจำนวนเต็มบาทได้ถูกต้อง', () => {
    expect(toSatang('80')).toBe(8000);
    expect(toSatang(80)).toBe(8000);
  });

  it('แปลงทศนิยม 2 ตำแหน่งได้ถูกต้อง', () => {
    expect(toSatang('80.50')).toBe(8050);
    expect(toSatang('0.10')).toBe(10);
    expect(toSatang('0.01')).toBe(1);
  });

  it('ปัดครึ่งขึ้นถ้าทศนิยมเกิน 2 ตำแหน่ง (หลักที่ 3 >= 5)', () => {
    expect(toSatang('1250.995')).toBe(125100); // 99.5 -> ปัดขึ้นเป็น 100 สตางค์
    expect(toSatang('1250.999')).toBe(125100);
  });

  it('ปัดลงถ้าทศนิยมเกิน 2 ตำแหน่ง (หลักที่ 3 < 5)', () => {
    expect(toSatang('1250.994')).toBe(125099);
  });

  it('ปฏิเสธเงินติดลบตามกฎ G3', () => {
    expect(() => toSatang('-50')).toThrow(MoneyError);
  });

  it('ปฏิเสธรูปแบบตัวเลขที่ไม่ถูกต้อง', () => {
    expect(() => toSatang('abc')).toThrow(MoneyError);
    expect(() => toSatang('')).toThrow(MoneyError);
    expect(() => toSatang('1,250')).toThrow(MoneyError); // ห้ามมี comma หลุดเข้ามาถึงจุดนี้ (ต้องกรองที่ thaiNumber ก่อน)
  });

  it('ปฏิเสธค่าที่เกิน MAX_AMOUNT_SATANG', () => {
    expect(() => toSatang('10000000.01')).toThrow(MoneyError);
  });
});

describe('fromSatang: แปลงสตางค์ -> string บาท (สำหรับเขียนลง DB)', () => {
  it('แปลงกลับได้ถูกต้อง', () => {
    expect(fromSatang(8000)).toBe('80.00');
    expect(fromSatang(10)).toBe('0.10');
    expect(fromSatang(0)).toBe('0.00');
  });

  it('roundtrip กับ toSatang ต้องได้ค่าเดิมเป๊ะ', () => {
    const original = '12345.67';
    expect(fromSatang(toSatang(original))).toBe(original);
  });

  it('ปฏิเสธค่าที่ไม่ใช่จำนวนเต็ม', () => {
    expect(() => fromSatang(10.5)).toThrow(MoneyError);
  });

  it('ปฏิเสธค่าติดลบ', () => {
    expect(() => fromSatang(-100)).toThrow(MoneyError);
  });
});

describe('formatBaht: จัดรูปแบบแสดงผล', () => {
  it('ใส่ comma คั่นหลักพันถูกต้อง', () => {
    expect(formatBaht(125000)).toBe('฿1,250.00');
    expect(formatBaht(100000000)).toBe('฿1,000,000.00');
  });

  it('แสดงค่าติดลบได้ (สำหรับกรณีใช้เกินตาม S5.2)', () => {
    expect(formatBaht(-25000)).toBe('-฿250.00');
  });

  it('ตัวเลขน้อยกว่า 1000 ไม่มี comma', () => {
    expect(formatBaht(8000)).toBe('฿80.00');
  });
});

describe('add: ความแม่นยำของการบวกเงิน (เคสบังคับตาม SPEC §7)', () => {
  it('บวก ฿0.10 จำนวน 10,000 ครั้ง ต้องได้ ฿1,000.00 เป๊ะ', () => {
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      sum = add(sum, toSatang('0.10'));
    }
    expect(sum).toBe(100_000); // 100,000 สตางค์ = 1,000 บาท
    expect(formatBaht(sum)).toBe('฿1,000.00');
  });

  it('บวกหลายค่าพร้อมกันในเรียกเดียวได้', () => {
    expect(add(toSatang('10'), toSatang('20'), toSatang('30'))).toBe(6000);
  });

  it('รับค่าติดลบได้ (ใช้คำนวณผลต่างระหว่างทาง เช่น safe-to-spend)', () => {
    expect(add(10000, -3000)).toBe(7000);
  });

  it('ปฏิเสธ input ที่ไม่ใช่จำนวนเต็มสตางค์', () => {
    expect(() => add(10.5)).toThrow(MoneyError);
  });
});

describe('splitEvenly: หารเงินเท่าๆ กัน (S4 กรณี "หารค่าข้าว")', () => {
  it('หารลงตัวพอดี', () => {
    expect(splitEvenly(32000, 4)).toEqual([8000, 8000, 8000, 8000]);
  });

  it('หารไม่ลงตัว ต้องแจกเศษสตางค์ให้คนแรกๆ และรวมกลับเท่าเดิมเป๊ะ', () => {
    const parts = splitEvenly(32000, 3);
    expect(parts).toEqual([10667, 10667, 10666]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(32000);
  });

  it('ทดสอบสุ่มหลายค่า ผลรวมต้องเท่าของเดิมเสมอ (property-based เบื้องต้น)', () => {
    for (let amount = 1; amount <= 500; amount += 37) {
      for (let count = 1; count <= 7; count++) {
        const parts = splitEvenly(amount, count);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(amount);
        expect(parts).toHaveLength(count);
      }
    }
  });

  it('ปฏิเสธจำนวนเงินหรือจำนวนคนที่ไม่ถูกต้อง', () => {
    expect(() => splitEvenly(0, 3)).toThrow(MoneyError);
    expect(() => splitEvenly(100, 0)).toThrow(MoneyError);
  });
});

describe('rounding: ปัดเศษตามกฎ S5 (ปัดครึ่งขึ้น เว้นแต่ระบุปัดลง)', () => {
  it('roundHalfUpToSatang ปัดครึ่งขึ้น', () => {
    expect(roundHalfUpToSatang(10.5)).toBe(11);
    expect(roundHalfUpToSatang(10.4)).toBe(10);
    expect(roundHalfUpToSatang(10.49999)).toBe(10);
  });

  it('roundDownToSatang ปัดลงเสมอ (ใช้กับ S5.2 safe-to-spend)', () => {
    expect(roundDownToSatang(10.99)).toBe(10);
    expect(roundDownToSatang(10.01)).toBe(10);
  });

  it('roundDownToTenBaht ปัดลงหลักสิบบาท (ใช้กับ S5.4 monthly_save)', () => {
    expect(roundDownToTenBaht(1999)).toBe(1000); // 19.99 บาท -> 10 บาท
    expect(roundDownToTenBaht(2500)).toBe(2000); // 25 บาท -> 20 บาท
    expect(roundDownToTenBaht(999)).toBe(0); // ต่ำกว่า 10 บาท -> 0
  });
});

describe('assertValidTransactionAmount: ตรวจก่อนบันทึกรายการ (ตรงกับ CHECK ใน 001_init.sql)', () => {
  it('ผ่านสำหรับค่าที่ถูกต้อง', () => {
    expect(() => assertValidTransactionAmount(8000)).not.toThrow();
    expect(() => assertValidTransactionAmount(MAX_AMOUNT_SATANG)).not.toThrow(); // ขอบเขตบนต้องผ่านพอดี
  });

  it('ปฏิเสธ 0 และค่าติดลบ', () => {
    expect(() => assertValidTransactionAmount(0)).toThrow(MoneyError);
    expect(() => assertValidTransactionAmount(-100)).toThrow(MoneyError);
  });

  it('ปฏิเสธค่าที่เกินเพดาน 10 ล้านบาท', () => {
    expect(() => assertValidTransactionAmount(MAX_AMOUNT_SATANG + 1)).toThrow(MoneyError);
  });
});

describe('ความสม่ำเสมอ: เรียกซ้ำด้วยอินพุตเดิมต้องได้ผลเหมือนเดิมทุกครั้ง', () => {
  it('toSatang ไม่มี state ค้างระหว่างการเรียก', () => {
    const results = Array.from({ length: 100 }, () => toSatang('1234.56'));
    expect(new Set(results).size).toBe(1); // ทุกค่าต้องเหมือนกันหมด
  });

  it('splitEvenly ไม่มี state ค้างระหว่างการเรียก', () => {
    const results = Array.from({ length: 100 }, () => JSON.stringify(splitEvenly(10000, 3)));
    expect(new Set(results).size).toBe(1);
  });
});