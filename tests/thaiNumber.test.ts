// ไฟล์นี้ทำหน้าที่อะไร: ทดสอบ parser ตัวเลขไทยและคำจำกัดคำสำหรับแปลงเงินก่อนส่งเข้าฟังก์ชัน money.ts
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// ⚖️ กฎเหล็ก G1, G3

import { describe, expect, it } from 'vitest';
import { normalizeThaiNumber } from '../src/utils/thaiNumber';

describe('normalizeThaiNumber', () => {
  it.each([
    ['50', 50],
    ['1,500', 1500],
    ['1.2k', 1200],
    ['50บ', 50],
    ['50฿', 50],
    ['50บาท', 50],
    ['ห้าสิบ', 50],
    ['สองร้อยห้าสิบ', 250],
    ['หนึ่งพันสอง', 1200],
    ['๓๐๐', 300],
    ['30,000', 30000],
    ['350.50', 350.5],
  ])('parses %s as %s', (input, expected) => {
    expect(normalizeThaiNumber(input)).toBe(expected);
  });
});
