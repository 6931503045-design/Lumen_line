// ไฟล์นี้ทำหน้าที่อะไร: test การแปลงคำบอกวันที่เป็นวันที่จริง
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.2 "date_text → thaiDate ได้ null → ถามกลับ" + Sanity check
// ⚖️ กฎเหล็ก G1
//
// 🔴 เทสต์ชุดนี้ให้น้ำหนักกับ "ทางที่ต้องคืน null" มากกว่าทางที่อ่านออก
// เพราะความเสียหายไม่สมมาตร: อ่านไม่ออกแล้วถามกลับ = ผู้ใช้เสียเวลา 1 ข้อความ
// แต่เดาผิดแล้วบันทึกไป = ยอดของวันนั้นเพี้ยนถาวรโดยผู้ใช้ไม่มีทางรู้

import { describe, expect, it } from 'vitest';
import { isoDateToBangkokNoon, parseThaiDateText } from '../src/utils/thaiDateText';

// 7 ต.ค. 2026 เป็นวันพุธ — ใช้เป็นวันอ้างอิงของทุกเคสในไฟล์นี้
const TODAY = '2026-10-07';

describe('คำบอกวันแบบตรงตัว', () => {
  it('วันนี้', () => {
    expect(parseThaiDateText('วันนี้', TODAY)).toBe('2026-10-07');
  });

  it('เมื่อวาน และรูปเขียนอื่นที่หมายถึงเมื่อวาน', () => {
    expect(parseThaiDateText('เมื่อวาน', TODAY)).toBe('2026-10-06');
    expect(parseThaiDateText('เมื่อวานนี้', TODAY)).toBe('2026-10-06');
    expect(parseThaiDateText('วานนี้', TODAY)).toBe('2026-10-06');
  });

  it('เมื่อวานซืน = ถอย 2 วัน', () => {
    expect(parseThaiDateText('เมื่อวานซืน', TODAY)).toBe('2026-10-05');
  });

  it('พรุ่งนี้รับได้ เพราะยังไม่เกินเพดานอนาคต 1 วัน', () => {
    expect(parseThaiDateText('พรุ่งนี้', TODAY)).toBe('2026-10-08');
  });

  it('เว้นวรรคแปลก ๆ ก็ยังอ่านออก', () => {
    expect(parseThaiDateText('  เมื่อ วาน  ', TODAY)).toBe('2026-10-06');
  });
});

describe('นับย้อนหลังเป็นจำนวน', () => {
  it('N วันก่อน / N วันที่แล้ว', () => {
    expect(parseThaiDateText('3 วันก่อน', TODAY)).toBe('2026-10-04');
    expect(parseThaiDateText('3 วันที่แล้ว', TODAY)).toBe('2026-10-04');
    expect(parseThaiDateText('เมื่อ 10 วันก่อน', TODAY)).toBe('2026-09-27');
  });

  it('N สัปดาห์ก่อน', () => {
    expect(parseThaiDateText('2 สัปดาห์ก่อน', TODAY)).toBe('2026-09-23');
    expect(parseThaiDateText('1 อาทิตย์ที่แล้ว', TODAY)).toBe('2026-09-30');
  });
});

describe('ชื่อวันในสัปดาห์ — ย้อนไปครั้งล่าสุด', () => {
  it('วันจันทร์ จากวันพุธ = ถอย 2 วัน', () => {
    expect(parseThaiDateText('วันจันทร์', TODAY)).toBe('2026-10-05');
  });

  it('ชื่อวันเดียวกับวันนี้ = วันนี้ ไม่ใช่สัปดาห์ก่อน', () => {
    expect(parseThaiDateText('วันพุธ', TODAY)).toBe('2026-10-07');
  });

  it('วันอาทิตย์ จากวันพุธ = ถอย 3 วัน', () => {
    expect(parseThaiDateText('วันอาทิตย์', TODAY)).toBe('2026-10-04');
  });

  it('พฤหัสบดี ต้องไม่ถูกอ่านเป็นคำอื่น', () => {
    expect(parseThaiDateText('วันพฤหัสบดี', TODAY)).toBe('2026-10-01');
    expect(parseThaiDateText('วันพฤหัส', TODAY)).toBe('2026-10-01');
  });
});

describe('ชื่อเดือนไทย', () => {
  it('ย่อและเต็ม ให้ผลเดียวกัน', () => {
    expect(parseThaiDateText('1 ต.ค.', TODAY)).toBe('2026-10-01');
    expect(parseThaiDateText('1 ตุลาคม', TODAY)).toBe('2026-10-01');
  });

  it('ไม่บอกปี และวัน-เดือนนั้นยังไม่มาถึงปีนี้ → ถอยไปปีก่อน', () => {
    // 25 ธ.ค. 2026 เป็นอนาคตไกล จึงต้องหมายถึง 25 ธ.ค. 2025
    expect(parseThaiDateText('25 ธ.ค.', TODAY)).toBe('2025-12-25');
  });

  it('ปี พ.ศ. เต็ม', () => {
    expect(parseThaiDateText('1 ตุลาคม 2569', TODAY)).toBe('2026-10-01');
  });

  it('ปี ค.ศ. เต็ม', () => {
    expect(parseThaiDateText('1 ตุลาคม 2026', TODAY)).toBe('2026-10-01');
  });

  it('เดือนที่ชื่อขึ้นต้นคล้ายกันต้องไม่สลับกัน (มี.ค. กับ มิ.ย.)', () => {
    expect(parseThaiDateText('5 มี.ค.', TODAY)).toBe('2026-03-05');
    expect(parseThaiDateText('5 มิ.ย.', TODAY)).toBe('2026-06-05');
  });
});

describe('วันที่แบบตัวเลข', () => {
  it('D/M ไม่บอกปี', () => {
    expect(parseThaiDateText('1/10', TODAY)).toBe('2026-10-01');
  });

  it('D/M/Y พ.ศ. และ ค.ศ.', () => {
    expect(parseThaiDateText('1/10/2569', TODAY)).toBe('2026-10-01');
    expect(parseThaiDateText('1-10-2026', TODAY)).toBe('2026-10-01');
  });

  it('รูป ISO เต็ม', () => {
    expect(parseThaiDateText('2026-10-01', TODAY)).toBe('2026-10-01');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ทางที่ผิด — ต้องคืน null ทุกเคส
// ────────────────────────────────────────────────────────────────────────────

describe('ทางที่ผิด: อ่านไม่ออกต้องคืน null ไม่ใช่เดาเป็นวันนี้', () => {
  it('คำที่ไม่เกี่ยวกับวันที่', () => {
    expect(parseThaiDateText('สักพักก่อน', TODAY)).toBeNull();
    expect(parseThaiDateText('ตอนนั้น', TODAY)).toBeNull();
    expect(parseThaiDateText('กาแฟ', TODAY)).toBeNull();
  });

  it('string ว่าง', () => {
    expect(parseThaiDateText('', TODAY)).toBeNull();
    expect(parseThaiDateText('   ', TODAY)).toBeNull();
  });

  it('"อาทิตย์ที่แล้ว" แบบไม่มีจำนวน กำกวมเกินไป', () => {
    // คนไทยใช้ทั้งความหมาย "สัปดาห์ก่อน" และ "วันอาทิตย์ที่ผ่านมา" ซึ่งต่างกันได้ 6 วัน
    expect(parseThaiDateText('อาทิตย์ที่แล้ว', TODAY)).toBeNull();
    expect(parseThaiDateText('สัปดาห์ที่แล้ว', TODAY)).toBeNull();
  });

  it('วันในอนาคตที่ไม่ใช่พรุ่งนี้', () => {
    expect(parseThaiDateText('จันทร์หน้า', TODAY)).toBeNull();
    expect(parseThaiDateText('2026-12-31', TODAY)).toBeNull();
  });

  it('ย้อนเกิน 1 ปี', () => {
    expect(parseThaiDateText('400 วันก่อน', TODAY)).toBeNull();
    expect(parseThaiDateText('1 ตุลาคม 2024', TODAY)).toBeNull();
  });

  it('วันที่ที่ไม่มีอยู่จริง', () => {
    expect(parseThaiDateText('31 ก.พ.', TODAY)).toBeNull();
    expect(parseThaiDateText('32/10', TODAY)).toBeNull();
    expect(parseThaiDateText('1/13', TODAY)).toBeNull();
  });

  it('ชื่อเดือนแต่ไม่มีวันนำหน้า', () => {
    expect(parseThaiDateText('ตุลาคม', TODAY)).toBeNull();
  });

  it('ค่าที่ไม่ใช่ string', () => {
    expect(parseThaiDateText(undefined as unknown as string, TODAY)).toBeNull();
    expect(parseThaiDateText(123 as unknown as string, TODAY)).toBeNull();
  });
});

describe('isoDateToBangkokNoon — กันวันเลื่อนเพราะเขตเวลา', () => {
  it('เที่ยงวันไทยคือ 05:00 UTC ของวันเดียวกัน', () => {
    expect(isoDateToBangkokNoon('2026-10-06').toISOString()).toBe('2026-10-06T05:00:00.000Z');
  });

  it('อ่านกลับเป็นวันเดิมไม่ว่าจะอ่านด้วย UTC หรือเวลาไทย', () => {
    const date = isoDateToBangkokNoon('2026-10-01');
    expect(date.toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});
