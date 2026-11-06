// ไฟล์นี้ทำหน้าที่อะไร: test ว่าบอทเข้าใจข้อความภาษาอังกฤษแบบเบา (ไม่ใช้ AI)
// ใครรับผิดชอบ: ③ AI
// ⚖️ กฎเหล็ก G1, G4 — ทุกเคสในไฟล์นี้ทำงานได้โดยไม่เรียก AI
//
// ครอบ 4 จุด: คำสั่งตายตัว · คำบอกรายรับ · ข้อความที่ต้องส่งให้ AI อ่าน · แปลคำใบ้หมวด

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/supabase', () => ({ supabase: {} }));
vi.mock('../src/db/queries/categories', () => ({
  listCategoriesByUser: vi.fn(),
}));

import { listCategoriesByUser } from '../src/db/queries/categories';
import { englishCategoryHint } from '../src/config/keywords';
import { matchCommand } from '../src/services/command.service';
import { resolveCategoryName } from '../src/services/category.service';
import { parseQuickExpenseText } from '../src/utils/regexParser';

describe('คำสั่งตายตัวภาษาอังกฤษ', () => {
  it.each([
    ['summary', 'summary'],
    ['Summary', 'summary'],
    ['balance', 'remaining'],
    ['How much left?', 'remaining'],
    ['how much can I spend tomorrow', 'remaining_tomorrow'],
    ['plans', 'plans'],
    ['BUDGET', 'budget'],
    ['help', 'help'],
  ])('%s -> %s', (text, command) => {
    expect(matchCommand(text)).toBe(command);
  });

  it('คำสั่งไทยยังใช้ได้เหมือนเดิม', () => {
    expect(matchCommand('สรุป')).toBe('summary');
    expect(matchCommand('เหลือเท่าไหร่ครับ')).toBe('remaining');
  });

  it('ยังเทียบทั้งข้อความ ไม่ใช่ includes', () => {
    expect(matchCommand('show me the summary please')).toBeNull();
  });
});

describe('ทางด่วน (L1) กับข้อความภาษาอังกฤษ', () => {
  it('"coffee 80" จดเป็นรายจ่าย 80 บาท', () => {
    const r = parseQuickExpenseText('coffee 80');
    expect(r.confidence).toBe('high');
    expect(r.amountSatang).toBe(8000);
    expect(r.type).toBe('expense');
    expect(r.category).toBe('coffee');
  });

  it.each(['salary 35000', 'Bonus 5000', 'received from mom 1000', 'got paid 2000', 'refund 150'])(
    '%s -> รายรับ',
    (text) => {
      expect(parseQuickExpenseText(text).type).toBe('income');
    }
  );

  it.each(['got a haircut 200', 'salaryman book 300', 'lunch 60'])('%s -> รายจ่าย', (text) => {
    expect(parseQuickExpenseText(text).type).toBe('expense');
  });

  it.each([
    'dinner 300 split with friends',
    'rent 3500 every month',
    'netflix 419 monthly',
    'not coffee, 90',
    'delete coffee 80',
    'coffee yesterday 50',
  ])('🔴 %s -> ไม่จดเอง ส่งให้ AI อ่านทั้งประโยค', (text) => {
    expect(parseQuickExpenseText(text).confidence).toBe('none');
  });

  it('"noodles 50" ไม่โดนกฎ "no" ขึ้นต้น', () => {
    expect(parseQuickExpenseText('noodles 50').confidence).toBe('high');
  });
});

describe('แปลคำใบ้หมวดภาษาอังกฤษ', () => {
  it.each([
    ['coffee', 'อาหาร'],
    ['Iced Coffee', 'อาหาร'],
    ['taxi', 'เดินทาง'],
    ['water bill', 'ที่พัก/บิล'],
    ['salary', 'เงินเดือน'],
  ])('%s -> %s', (text, category) => {
    expect(englishCategoryHint(text)).toBe(category);
  });

  it('ภาษาไทย / คำที่ไม่รู้จัก -> null (พฤติกรรมเดิมไม่เปลี่ยน)', () => {
    expect(englishCategoryHint('กาแฟ')).toBeNull();
    expect(englishCategoryHint('mango')).toBeNull();
  });
});

describe('resolveCategoryName ใช้คำใบ้ภาษาอังกฤษเป็นทางสำรอง', () => {
  const cat = (name: string, type: 'income' | 'expense') => ({
    id: name,
    name,
    type,
    emoji: '',
    is_essential: false,
    is_default: true,
  });

  beforeEach(() => {
    vi.mocked(listCategoriesByUser).mockResolvedValue([
      cat('อาหาร', 'expense'),
      cat('อื่นๆ', 'expense'),
      cat('เงินเดือน', 'income'),
    ] as never);
  });

  it('"coffee" -> หมวด "อาหาร" ที่ผู้ใช้มีอยู่', async () => {
    expect(await resolveCategoryName('u1', 'coffee', 'expense')).toBe('อาหาร');
  });

  it('"salary" รายรับ -> "เงินเดือน"', async () => {
    expect(await resolveCategoryName('u1', 'salary', 'income')).toBe('เงินเดือน');
  });

  it('ผู้ใช้ไม่มีหมวดนั้นแล้ว -> null ไม่สร้างใหม่', async () => {
    expect(await resolveCategoryName('u1', 'taxi', 'expense')).toBeNull();
  });

  it('ผู้ใช้ตั้งหมวดชื่ออังกฤษเอง -> ใช้หมวดนั้นก่อน', async () => {
    vi.mocked(listCategoriesByUser).mockResolvedValue([
      cat('อาหาร', 'expense'),
      cat('Coffee', 'expense'),
    ] as never);
    expect(await resolveCategoryName('u1', 'coffee', 'expense')).toBe('Coffee');
  });
});
