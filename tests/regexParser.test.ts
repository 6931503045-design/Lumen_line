// ไฟล์นี้ทำหน้าที่อะไร: ทดสอบ parser ทางด่วนสำหรับ W1
// ใครรับผิดชอบ: ③ AI / ⑤ Integration
// เขียนในสัปดาห์: W1
// ⚖️ กฎเหล็ก G1, G2

import { describe, expect, it } from 'vitest';
import { parseQuickExpenseText } from '../src/utils/regexParser';

describe('parseQuickExpenseText', () => {
  it.each([
    ['กาแฟ 80', { amount: 80, category: 'กาแฟ', type: 'expense' }],
    ['ข้าว60', { amount: 60, category: 'ข้าว', type: 'expense' }],
    ['+เงินเดือน 35000', { amount: 35000, category: 'เงินเดือน', type: 'income' }],
    ['1,250 ซื้อของ', { amount: 1250, category: 'ซื้อของ', type: 'expense' }],
  ])('parses %s', (input, expected) => {
    const result = parseQuickExpenseText(input);
    expect(result.confidence).toBe('high');
    expect(result.amount).toBe(expected.amount);
    expect(result.category).toBe(expected.category);
    expect(result.type).toBe(expected.type);
  });

  it('returns none for invalid text', () => {
    const result = parseQuickExpenseText('hello');
    expect(result.confidence).toBe('none');
    expect(result.amount).toBeUndefined();
  });
});
