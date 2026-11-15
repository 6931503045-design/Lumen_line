// ไฟล์นี้ทำหน้าที่อะไร: test ทางด่วนแบบหลายรายการในข้อความเดียว + การล้างคำกริยาออกจากชื่อรายการ
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G1, G3, G4
//
// เดิม "ข้าว 50 กาแฟ 40" ต้องส่งไปให้ AI อ่าน (เสียโควตา ช้า และต้องกดยืนยัน)
// ตอนนี้ทางด่วนอ่านเองได้ทุกรายการ — แต่ถ้าอ่านไม่ครบทั้งข้อความต้องไม่เดา ส่งต่อให้ AI เหมือนเดิม

import { describe, expect, it } from 'vitest';
import { cleanItemName, parseQuickExpenseBatch, parseQuickExpenseText } from '../src/utils/regexParser';

describe('parseQuickExpenseBatch — หลายรายการในข้อความเดียว', () => {
  it.each([
    ['ข้าว 50 กาแฟ 40', [['ข้าว', 5000], ['กาแฟ', 4000]]],
    ['ค่ารถ 30, ข้าว 45, ชานม 55', [['ค่ารถ', 3000], ['ข้าว', 4500], ['ชานม', 5500]]],
    ['grab 120\nlineman 89', [['grab', 12000], ['lineman', 8900]]],
    ['กับข้าว 30 และ ข้าวเหนียว 10', [['กับข้าว', 3000], ['ข้าวเหนียว', 1000]]],
    ['ข้าว 50บาท น้ำ 15 บาท', [['ข้าว', 5000], ['น้ำ', 1500]]],
  ])('"%s"', (text, want) => {
    const result = parseQuickExpenseBatch(text);
    expect(result?.items.map((item) => [item.category, item.amountSatang])).toEqual(want);
    expect(result?.items.every((item) => item.type === 'expense')).toBe(true);
  });

  it('"กับข้าว" เป็นชื่ออาหาร ไม่ถูกตัดเป็นตัวคั่น "กับ" ตอนต้นข้อความ', () => {
    expect(parseQuickExpenseBatch('กับข้าว 30 ข้าว 10')?.items[0]?.category).toBe('กับข้าว');
  });

  it('รายรับกับรายจ่ายปนกันได้ — ทิศทางอ่านทีละรายการ', () => {
    const result = parseQuickExpenseBatch('เงินเดือน 15000 ค่าหอ 3500');
    expect(result?.items.map((item) => item.type)).toEqual(['income', 'expense']);
  });

  it('คำบอกวันที่ใช้กับทั้งข้อความ', () => {
    const result = parseQuickExpenseBatch('เมื่อวาน ข้าว 50 กาแฟ 40');
    expect(result?.dateText).toBe('เมื่อวาน');
    expect(result?.items).toHaveLength(2);
  });

  it.each([
    ['กาแฟ 80', 'รายการเดียว — เป็นหน้าที่ของ parseQuickExpenseText'],
    ['ข้าว 50 กาแฟ', 'มีส่วนที่ไม่มียอด'],
    ['ข้าว 50 กาแฟ -40', 'ยอดติดลบ'],
    ['หารสองคน ข้าว 300 น้ำ 40', 'มีการหารบิล — ต้องอ่านทั้งประโยค'],
  ])('"%s" → ไม่อ่านเป็นชุด (%s)', (text) => {
    expect(parseQuickExpenseBatch(text)).toBeNull();
  });

  it('จำนวนรายการมีเพดาน (กันข้อความยาวผิดปกติ)', () => {
    const many = Array.from({ length: 11 }, (_, i) => `ของ${i} ${i + 1}`).join(' ');
    expect(parseQuickExpenseBatch(many)).toBeNull();
  });
});

describe('cleanItemName — ตัดคำกริยา/คำเสริมออกจากชื่อรายการ', () => {
  it.each([
    ['ซื้อกาแฟ', 'กาแฟ'],
    ['จ่ายค่าหอ', 'ค่าหอ'],
    ['กินข้าวมันไก่', 'ข้าวมันไก่'],
    ['สั่งพิซซ่า', 'พิซซ่า'],
    ['ค่าแท็กซี่ไป', 'ค่าแท็กซี่'],
    ['ข้าวผัดหมดไป', 'ข้าวผัด'],
    ['กินข้าว', 'ข้าว'],
  ])('"%s" → "%s"', (input, want) => {
    expect(cleanItemName(input)).toBe(want);
  });

  it.each(['ซื้อ', 'มา', 'ไปมา', 'กาแฟ'])('"%s" ไม่เปลี่ยน (ตัดแล้วจะไม่เหลือชื่อรายการ)', (input) => {
    expect(cleanItemName(input)).toBe(input);
  });

  it('ทางด่วนรายการเดียวได้ชื่อที่ล้างแล้ว', () => {
    expect(parseQuickExpenseText('ซื้อกาแฟ 80').category).toBe('กาแฟ');
  });
});
