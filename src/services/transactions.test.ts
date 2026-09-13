import { describe, expect, it } from 'vitest';

import { createTransaction, getSummary, resetTransactions } from './transactions.js';

describe('transaction service', () => {
  it('creates an expense in satang and keeps it in memory', () => {
    resetTransactions('demo-user');

    const tx = createTransaction({
      userId: 'demo-user',
      type: 'expense',
      amount: '80',
      label: 'กาแฟ',
      category: 'food',
    });

    expect(tx.amountSatang).toBe(8000);
    expect(tx.type).toBe('expense');
  });

  it('ignores transfer in summary totals', () => {
    resetTransactions('demo-user');

    createTransaction({ userId: 'demo-user', type: 'income', amount: '500', label: 'เงินเดือน' });
    createTransaction({ userId: 'demo-user', type: 'expense', amount: '120', label: 'ข้าว' });
    createTransaction({ userId: 'demo-user', type: 'transfer', amount: '200', label: 'ออม' });

    const summary = getSummary('demo-user');

    expect(summary.income).toBe(50000);
    expect(summary.expense).toBe(12000);
    expect(summary.transfer).toBe(20000);
    expect(summary.net).toBe(38000);
  });
});
