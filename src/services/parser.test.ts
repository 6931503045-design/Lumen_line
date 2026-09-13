import { describe, expect, it } from 'vitest';

import { parseUserText } from './parser.js';

describe('parser', () => {
  it('parses direct expense entries', () => {
    expect(parseUserText('กาแฟ 80')).toMatchObject({ kind: 'expense', amountSatang: 8000 });
    expect(parseUserText('ค่าไฟ 900')).toMatchObject({ kind: 'expense', amountSatang: 90000 });
  });

  it('parses income and transfer entries', () => {
    expect(parseUserText('+เงินเดือน 35000')).toMatchObject({ kind: 'income', amountSatang: 3500000 });
    expect(parseUserText('ออม 2000')).toMatchObject({ kind: 'transfer', amountSatang: 200000 });
  });

  it('parses status commands', () => {
    expect(parseUserText('สรุป')).toMatchObject({ kind: 'summary' });
    expect(parseUserText('เหลือ')).toMatchObject({ kind: 'balance' });
    expect(parseUserText('แผน')).toMatchObject({ kind: 'plan' });
  });
});
