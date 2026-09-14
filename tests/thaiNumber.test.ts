// ไฟล์นี้ทำหน้าที่อะไร: ทดสอบ src/utils/thaiNumber.ts ให้ครบตามรูปแบบที่ SPEC.md §S4 ระบุไว้
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W1

import { describe, expect, it } from 'vitest';
import { parseThaiNumber } from '../src/utils/thaiNumber';

describe('parseThaiNumber: รูปแบบตัวเลขอารบิก (เคสบังคับตาม SPEC §S4)', () => {
  it.each([
    ['50', 5000],
    ['1,500', 150000],
    ['1.2k', 120000],
    ['50บ', 5000],
    ['50฿', 5000],
    ['50บาท', 5000],
  ])('parseThaiNumber(%s) -> %i สตางค์', (input, expected) => {
    expect(parseThaiNumber(input)).toBe(expected);
  });

  it('ตัด whitespace รอบข้อความได้', () => {
    expect(parseThaiNumber('  80  ')).toBe(8000);
  });

  it('รองรับหน่วย k กับทศนิยมอื่นๆ', () => {
    expect(parseThaiNumber('0.5k')).toBe(50_000);
  });

  it('รองรับเว้นวรรคก่อนหน่วยเงิน', () => {
    expect(parseThaiNumber('2,500 บาท')).toBe(250_000);
  });
});

describe('parseThaiNumber: เลขไทยเป็นคำ (เคสบังคับตาม SPEC §S4)', () => {
  it.each([
    ['ห้าสิบ', 5000],
    ['สองร้อยห้าสิบ', 25000],
    ['หนึ่งพันสอง', 120000], // colloquial: 1,200 บาท ไม่ใช่ 1,002
  ])('parseThaiNumber(%s) -> %i สตางค์', (input, expected) => {
    expect(parseThaiNumber(input)).toBe(expected);
  });
});

describe('parseThaiNumber: ไวยากรณ์เลขไทยมาตรฐาน (เคสเสริมนอกเหนือจาก SPEC)', () => {
  it.each([
    ['สิบ', 1000], // 10 บาท
    ['สิบเอ็ด', 1100], // 11 บาท — "เอ็ด" แทน "หนึ่ง" หลัง "สิบ"
    ['ยี่สิบ', 2000], // 20 บาท — "ยี่" แทน "สอง" หน้า "สิบ"
    ['ยี่สิบเอ็ด', 2100], // 21 บาท
    ['หนึ่งร้อย', 10000], // 100 บาท
    ['เก้าร้อยเก้าสิบเก้า', 99900], // 999 บาท
    ['ร้อยห้า', 10500], // 105 บาท — ไวยากรณ์ปกติ (ไม่ใช่ shorthand แบบ พัน/หมื่น)
  ])('parseThaiNumber(%s) -> %i สตางค์', (input, expected) => {
    expect(parseThaiNumber(input)).toBe(expected);
  });
});

describe('parseThaiNumber: shorthand ภาษาพูดเรื่องเงิน (เลขท้ายประโยคหลังหน่วยใหญ่)', () => {
  it.each([
    ['พันห้า', 150_000], // 1,500 บาท
    ['สองพันสาม', 230_000], // 2,300 บาท
    ['หมื่นสอง', 1_200_000], // 12,000 บาท
  ])('parseThaiNumber(%s) -> %i สตางค์ (ตีความเป็นอันดับถัดลงมาหนึ่งขั้น)', (input, expected) => {
    expect(parseThaiNumber(input)).toBe(expected);
  });
});

describe('parseThaiNumber: ต้องคืน null เมื่อไม่เข้าใจ (ห้ามเดา)', () => {
  it.each([
    [''],
    ['abc'],
    ['กาแฟ 80'], // ประโยคเต็มปนคำอื่น ต้องให้ regexParser ตัดมาก่อนแล้วค่อยส่งมา
    ['50.5.5'], // รูปแบบเลขผิด (ทศนิยม 2 จุด)
    ['แมว'], // ไม่ใช่คำเลขไทยเลย
    ['ห้าสิบแมว'], // เลขไทยปนคำที่ไม่รู้จัก
    ['-50'], // เงินติดลบไม่ได้ตามกฎ G3
  ])('parseThaiNumber(%s) -> null', (input) => {
    expect(parseThaiNumber(input)).toBeNull();
  });
});

describe('ความสม่ำเสมอ: เรียกซ้ำด้วยอินพุตเดิมต้องได้ผลเหมือนเดิมทุกครั้ง', () => {
  it('ไม่มี state ค้างระหว่างการเรียกซ้ำ', () => {
    const results = Array.from({ length: 50 }, () => parseThaiNumber('หนึ่งพันสอง'));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(120_000);
  });
});