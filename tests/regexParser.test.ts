// ไฟล์นี้ทำหน้าที่อะไร: เทส utils/regexParser.ts (L1 ทางด่วน) ตาม SPEC §3 S1 ตาราง "คำสั่งในแชท"
// ใครรับผิดชอบ: ③ AI
// อ้างอิง: AIDO.md §9 ("ต้องมี test money + regexParser ผ่านก่อน merge")
//
// ครอบคลุม 4 รูปแบบหลัก + edge case ที่ห้ามผ่าน (เงิน <= 0, ข้อความว่าง, ไม่มีตัวเลข)
// 🆕 regexParser.ts เสียบ utils/thaiNumber.ts เข้าไปแล้ว ไฟล์นี้จึงเทสทั้งเลขอารบิก
// (ของเดิม) และรูปแบบที่ thaiNumber.ts เพิ่มให้ (หน่วยเงิน, k, คำอ่านไทย) ในชุดแยกด้านล่าง
//
// ⚠️ ผลลัพธ์เป็น `amountSatang` (สตางค์) แล้ว ไม่ใช่ `amount` (บาท) — 80 บาท = 8000 สตางค์

import { describe, it, expect } from 'vitest';
import { parseQuickExpenseText } from '../src/utils/regexParser';

describe('parseQuickExpenseText — แบบที่ 1: ชื่อ + เว้นวรรค + ตัวเลข', () => {
  it('จับ "กาแฟ 80" ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('กาแฟ 80');
    expect(result.confidence).toBe('high');
    expect(result.amountSatang).toBe(8000);
    expect(result.category).toBe('กาแฟ');
    expect(result.type).toBe('expense');
  });

  it('จับ "ค่าไฟ 900" ได้ถูกต้อง (ตัวอย่างจาก README)', () => {
    const result = parseQuickExpenseText('ค่าไฟ 900');
    expect(result.amountSatang).toBe(90000);
    expect(result.category).toBe('ค่าไฟ');
  });

  it('รองรับทศนิยม เช่น "ข้าว 45.50"', () => {
    const result = parseQuickExpenseText('ข้าว 45.50');
    expect(result.amountSatang).toBe(4550);
    expect(result.category).toBe('ข้าว');
  });
});

describe('parseQuickExpenseText — แบบที่ 2: ชื่อติดตัวเลข ไม่มีเว้นวรรค', () => {
  it('จับ "ข้าว60" ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('ข้าว60');
    expect(result.confidence).toBe('high');
    expect(result.amountSatang).toBe(6000);
    expect(result.category).toBe('ข้าว');
    expect(result.type).toBe('expense');
  });

  it('จับ "ร้านป้าแดง50" ได้ถูกต้อง (ตัวอย่างจาก README L3)', () => {
    const result = parseQuickExpenseText('ร้านป้าแดง50');
    expect(result.amountSatang).toBe(5000);
    expect(result.category).toBe('ร้านป้าแดง');
  });
});

describe('parseQuickExpenseText — แบบที่ 3: ขึ้นต้นด้วย + = รายรับ', () => {
  it('จับ "+เงินเดือน 35000" เป็นรายรับได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('+เงินเดือน 35000');
    expect(result.confidence).toBe('high');
    expect(result.amountSatang).toBe(3500000);
    expect(result.category).toBe('เงินเดือน');
    expect(result.type).toBe('income');
  });

  it('คำที่ดูเหมือนรายรับแต่ไม่ได้ขึ้นต้นประโยค ยังเป็นรายจ่าย', () => {
    // กฎเดิมคือ "ไม่มี + = รายจ่ายเสมอ" ซึ่งทำให้ "ได้เงินค่าขนม 500" ลงผิดฝั่ง
    // ตอนนี้เดาจากคำขึ้นต้นได้ แต่ยังต้องไม่เดามั่วจากคำที่อยู่กลางประโยค
    const result = parseQuickExpenseText('ซื้อของขวัญเงินเดือนพ่อ 350');
    expect(result.type).toBe('expense');
  });

  it('"+" ติดตัวเลขไม่มีเว้นวรรคก็ต้องจับได้ เช่น "+โบนัส5000"', () => {
    const result = parseQuickExpenseText('+โบนัส5000');
    expect(result.amountSatang).toBe(500000);
    expect(result.category).toBe('โบนัส');
    expect(result.type).toBe('income');
  });
});

describe('parseQuickExpenseText — แบบที่ 4: ตัวเลขขึ้นก่อน (รองรับ comma)', () => {
  it('จับ "1,250 ซื้อของ" ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('1,250 ซื้อของ');
    expect(result.confidence).toBe('high');
    expect(result.amountSatang).toBe(125000);
    expect(result.category).toBe('ซื้อของ');
    expect(result.type).toBe('expense');
  });

  it('จับ "500 ค่าเทอม" (ไม่มี comma) ได้ถูกต้อง', () => {
    const result = parseQuickExpenseText('500 ค่าเทอม');
    expect(result.amountSatang).toBe(50000);
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
describe('parseQuickExpenseText — รูปแบบที่ได้มาจาก thaiNumber.ts (SPEC §S4)', () => {
  it('รับหน่วย "บาท" ที่แยกคำ เช่น "กาแฟ 80 บาท"', () => {
    const result = parseQuickExpenseText('กาแฟ 80 บาท');
    expect(result.confidence).toBe('high');
    expect(result.amountSatang).toBe(8000);
    expect(result.category).toBe('กาแฟ');
  });

  it('รับหน่วย "บ" ที่เขียนติด เช่น "ข้าว50บ"', () => {
    const result = parseQuickExpenseText('ข้าว50บ');
    expect(result.amountSatang).toBe(5000);
    expect(result.category).toBe('ข้าว');
  });

  it('รับสัญลักษณ์ ฿ เช่น "ขนม 25฿"', () => {
    const result = parseQuickExpenseText('ขนม 25฿');
    expect(result.amountSatang).toBe(2500);
    expect(result.category).toBe('ขนม');
  });

  it('รับหน่วย k เช่น "ค่าเน็ต 1.2k" = 1,200 บาท', () => {
    const result = parseQuickExpenseText('ค่าเน็ต 1.2k');
    expect(result.amountSatang).toBe(120000);
    expect(result.category).toBe('ค่าเน็ต');
  });

  it('รับคำอ่านไทย เช่น "กาแฟ ห้าสิบ"', () => {
    const result = parseQuickExpenseText('กาแฟ ห้าสิบ');
    expect(result.confidence).toBe('high');
    expect(result.amountSatang).toBe(5000);
    expect(result.category).toBe('กาแฟ');
  });

  it('รับคำอ่านไทยหลายหลัก เช่น "ค่าเช่า สองร้อยห้าสิบ"', () => {
    const result = parseQuickExpenseText('ค่าเช่า สองร้อยห้าสิบ');
    expect(result.amountSatang).toBe(25000);
    expect(result.category).toBe('ค่าเช่า');
  });

  it('ชื่อหมวดหลายคำก็ยังจับได้ เช่น "ค่าข้าว เที่ยง 60"', () => {
    const result = parseQuickExpenseText('ค่าข้าว เที่ยง 60');
    expect(result.amountSatang).toBe(6000);
    expect(result.category).toBe('ค่าข้าว เที่ยง');
  });

  it('รายรับที่ใช้คำอ่านไทย เช่น "+ค่าขนม สองพัน"', () => {
    const result = parseQuickExpenseText('+ค่าขนม สองพัน');
    expect(result.amountSatang).toBe(200000);
    expect(result.category).toBe('ค่าขนม');
    expect(result.type).toBe('income');
  });

  it('จำนวนเงินทะลุเพดานต้องไม่ผ่าน เช่น "ของ 50000k" (50 ล้านบาท)', () => {
    expect(parseQuickExpenseText('ของ 50000k').confidence).toBe('none');
  });

  it('คำอ่านไทยที่แปลว่าศูนย์ต้องไม่ผ่าน (กฎ G3)', () => {
    expect(parseQuickExpenseText('กาแฟ ศูนย์').confidence).toBe('none');
  });

  it('คำอ่านไทยติดชื่อหมวดยังไม่รองรับ — ต้องคืน none ไม่ใช่เดา', () => {
    expect(parseQuickExpenseText('ข้าวห้าสิบ').confidence).toBe('none');
  });
});

describe('ทิศทางเงิน: คำขึ้นต้นที่บอกว่าเงินเข้า', () => {
  // 🔴 บั๊กจากการทดสอบจริง: "ได้เงินค่าขนม 500 บาท" ถูกบันทึกเป็นรายจ่าย
  // เพราะกฎเดิมคือ "ไม่มี + = รายจ่ายเสมอ" แต่คนไทยไม่พิมพ์ + กัน
  // ผลคือยอดคงเหลือผิดไปสองเท่า (ควรบวกแต่กลับลบ) และผู้ใช้สังเกตยากเพราะตัวเลขถูก
  it.each([
    'ได้เงินค่าขนม 500 บาท',
    'ได้ค่าขนม 300',
    'รับเงินจากแม่ 1000',
    'เงินเดือน 15000',
    'เงินเข้า 2000',
    'ขายได้ 450',
    'โบนัส 5000',
    'ทุนการศึกษา 20000',
  ])('%s -> รายรับ', (text) => {
    expect(parseQuickExpenseText(text).type).toBe('income');
  });

  it.each([
    'กาแฟ 80',
    'ข้าว 1.2k',
    'ค่าหอ 3500',
    'มะม่วง 500',
  ])('%s -> รายจ่าย', (text) => {
    expect(parseQuickExpenseText(text).type).toBe('expense');
  });

  it('🔴 เทียบแบบขึ้นต้นเท่านั้น ไม่ใช่ includes — ไม่งั้นรายจ่ายกลายเป็นรายรับ', () => {
    // "ได้เสีย" มีคำว่า "ได้" อยู่กลางประโยค ถ้าใช้ includes จะเดาผิดฝั่ง
    expect(parseQuickExpenseText('จ่ายค่าได้เสีย 200').type).toBe('expense');
    expect(parseQuickExpenseText('ซื้อเงินเดือนละ 100').type).toBe('expense');
  });

  it('+ ยังใช้ได้เหมือนเดิม และมาก่อนการเดาจากคำ', () => {
    expect(parseQuickExpenseText('+ค่าขนม 500').type).toBe('income');
  });

  it('คำที่บอกว่าเงินเข้ายังอยู่ในชื่อรายการ ไม่ถูกตัดทิ้ง', () => {
    // ชื่อรายการต้องอ่านรู้เรื่อง ถ้าตัด "ได้เงิน" ออกจะเหลือแค่ "ค่าขนม" ซึ่งกำกวม
    expect(parseQuickExpenseText('ได้เงินค่าขนม 500').category).toBe('ได้เงินค่าขนม');
  });
});

// ผู้ใช้ทดสอบพิมพ์ "ค่าข้าวหาร3คน 300" แล้วทางด่วนบันทึก 300 ทันทีโดยไม่ถาม
// ข้อความพวกนี้ต้องไปให้ AI อ่านแล้วถามยืนยันก่อน (⚖️ G2)
describe('parseQuickExpenseText — ข้อความที่ทางด่วนห้ามบันทึกเอง', () => {
  it.each([
    'ค่าข้าวหาร3คน 300',
    'ค่าข้าว 300 หาร 3',
    'ค่าข้าว 300 หารสามคน',
    'ค่าพิซซ่า 600 แชร์กับเพื่อน',
    'ค่าหอ 3500 ทุกวันที่ 1',
    'ค่าเน็ต 599 ทุกเดือน',
    'ไม่ใช่ เป็น 90',
    'แก้เป็น 120',
    'ตั้งงบ 5000',
    'ซื้อของ 2 ชิ้น 300',
  ])('"%s" → none', (text) => {
    expect(parseQuickExpenseText(text).confidence).toBe('none');
  });

  it.each([
    ['อาหาร 80', 'อาหาร'],
    ['ข้าวมันไก่ทหาร 50', 'ข้าวมันไก่ทหาร'],
    ['ค่าเน็ต 1,250', 'ค่าเน็ต'],
    ['ค่าเน็ต 1.2k', 'ค่าเน็ต'],
  ])('"%s" ยังเป็นทางด่วนเหมือนเดิม', (text, category) => {
    const result = parseQuickExpenseText(text);
    expect(result.confidence).toBe('high');
    expect(result.category).toBe(category);
  });
});
