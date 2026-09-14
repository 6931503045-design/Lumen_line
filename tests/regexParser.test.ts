// ไฟล์นี้ทำหน้าที่อะไร: เทส utils/regexParser.ts (L1 ทางด่วน) ตาม SPEC §3 S1 ตาราง "คำสั่งในแชท"
// ใครรับผิดชอบ: ③ AI
// อ้างอิง: AIDO.md §9 ("ต้องมี test money + regexParser ผ่านก่อน merge")
//
// ครอบคลุม 4 รูปแบบหลัก + edge case ที่ห้ามผ่าน (เงิน <= 0, ข้อความว่าง, ไม่มีตัวเลข)
// หมายเหตุ: ถ้าไฟล์ regexParser.ts ในเครื่องมีการเปลี่ยนไปใช้ utils/thaiNumber.ts เพิ่ม (เช่น
// รองรับเลขไทย "๘๐" หรือคำอ่าน "แปดสิบบาท") ให้เพิ่มเคสทดสอบส่วนนั้นแยกต่างหาก ไฟล์นี้เทสเฉพาะ
// เวอร์ชัน parseQuickExpenseText ที่รับเฉพาะเลขอารบิกกับ comma คั่นหลักพันเท่านั้น

import { describe, it, expect } from 'vitest';
import { parseQuickExpenseText } from '../src/utils/regexParser';

describe('parseQuickExpenseText — แบบที่ 1: ชื่อ + เว้นวรรค + ตัวเลข', () => {
  it('จับ "กาแฟ 80" ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('กาแฟ 80');
    expect(result.confidence).toBe('high');
    expect(result.amount).toBe(80);
    expect(result.category).toBe('กาแฟ');
    expect(result.type).toBe('expense');
  });

  it('จับ "ค่าไฟ 900" ได้ถูกต้อง (ตัวอย่างจาก README)', () => {
    const result = parseQuickExpenseText('ค่าไฟ 900');
    expect(result.amount).toBe(900);
    expect(result.category).toBe('ค่าไฟ');
  });

  it('รองรับทศนิยม เช่น "ข้าว 45.50"', () => {
    const result = parseQuickExpenseText('ข้าว 45.50');
    expect(result.amount).toBe(45.5);
    expect(result.category).toBe('ข้าว');
  });
});

describe('parseQuickExpenseText — แบบที่ 2: ชื่อติดตัวเลข ไม่มีเว้นวรรค', () => {
  it('จับ "ข้าว60" ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('ข้าว60');
    expect(result.confidence).toBe('high');
    expect(result.amount).toBe(60);
    expect(result.category).toBe('ข้าว');
    expect(result.type).toBe('expense');
  });

  it('จับ "ร้านป้าแดง50" ได้ถูกต้อง (ตัวอย่างจาก README L3)', () => {
    const result = parseQuickExpenseText('ร้านป้าแดง50');
    expect(result.amount).toBe(50);
    expect(result.category).toBe('ร้านป้าแดง');
  });
});

describe('parseQuickExpenseText — แบบที่ 3: ขึ้นต้นด้วย + = รายรับ', () => {
  it('จับ "+เงินเดือน 35000" เป็นรายรับได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('+เงินเดือน 35000');
    expect(result.confidence).toBe('high');
    expect(result.amount).toBe(35000);
    expect(result.category).toBe('เงินเดือน');
    expect(result.type).toBe('income');
  });

  it('ไม่มี + ต้องเป็น expense เสมอ แม้ชื่อจะดูเหมือนรายรับ', () => {
    const result = parseQuickExpenseText('เงินเดือน 35000');
    expect(result.type).toBe('expense');
  });

  it('"+" ติดตัวเลขไม่มีเว้นวรรคก็ต้องจับได้ เช่น "+โบนัส5000"', () => {
    const result = parseQuickExpenseText('+โบนัส5000');
    expect(result.amount).toBe(5000);
    expect(result.category).toBe('โบนัส');
    expect(result.type).toBe('income');
  });
});

describe('parseQuickExpenseText — แบบที่ 4: ตัวเลขขึ้นก่อน (รองรับ comma)', () => {
  it('จับ "1,250 ซื้อของ" ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('1,250 ซื้อของ');
    expect(result.confidence).toBe('high');
    expect(result.amount).toBe(1250);
    expect(result.category).toBe('ซื้อของ');
    expect(result.type).toBe('expense');
  });

  it('จับ "500 ค่าเทอม" (ไม่มี comma) ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('500 ค่าเทอม');
    expect(result.amount).toBe(500);
    expect(result.category).toBe('ค่าเทอม');
  });
});

describe('parseQuickExpenseText — ต้องคืน confidence: none (ห้ามผ่าน)', () => {
  it('ข้อความว่างเปล่า', () => {
    expect(parseQuickExpenseText('').confidence).toBe('none');
  });

  it('ข้อความที่มีแต่ช่องว่าง', () => {
    expect(parseQuickExpenseText('   ').confidence).toBe('none');
  });

  it('ไม่มีตัวเลขเลย เช่น "สรุปเดือนนี้" (เป็นคำสั่งตายตัว ไม่ใช่ทางด่วน)', () => {
    expect(parseQuickExpenseText('สรุปเดือนนี้').confidence).toBe('none');
  });

  it('จำนวนเงินเป็น 0 ห้ามผ่าน (กฎ G3 เงินต้องมากกว่า 0)', () => {
    expect(parseQuickExpenseText('กาแฟ 0').confidence).toBe('none');
  });

  it('มีแต่ + ไม่มีข้อความตามหลัง', () => {
    expect(parseQuickExpenseText('+').confidence).toBe('none');
  });

  it('มีแต่ตัวเลขล้วนๆ ไม่มีชื่อหมวด', () => {
    expect(parseQuickExpenseText('12345').confidence).toBe('none');
  });
});