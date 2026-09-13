import { randomUUID } from 'node:crypto';

import { toSatang } from '../lib/money.js';
import type { CreateTransactionInput, Summary, Transaction, TransactionType } from '../types.js';

const store = new Map<string, Transaction[]>();

function getUserTransactions(userId: string): Transaction[] {
  return store.get(userId) ?? [];
}

export function resetTransactions(userId: string): void {
  store.delete(userId);
}

export function createTransaction(input: CreateTransactionInput): Transaction {
  const userId = (input.userId ?? 'demo-user').trim() || 'demo-user';
  const type: TransactionType = input.type;

  if (!['expense', 'income', 'transfer'].includes(type)) {
    throw new Error(`Unsupported transaction type: ${type}`);
  }

  const amountSatang = toSatang(input.amount);

  if (amountSatang <= 0) {
    throw new Error('Transaction amount must be greater than zero');
  }

  const tx: Transaction = {
    id: randomUUID(),
    userId,
    type,
    amountSatang,
    label: input.label?.trim() || 'transaction',
    category: input.category?.trim() || 'general',
    parsedBy: input.parsedBy ?? 'manual',
    createdAt: new Date().toISOString(),
  };

  const existing = getUserTransactions(userId);
  existing.push(tx);
  store.set(userId, existing);

  return tx;
}

export function listTransactions(userId: string): Transaction[] {
  return [...getUserTransactions(userId)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getSummary(userId: string): Summary {
  const txs = getUserTransactions(userId);

  const income = txs
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amountSatang, 0);

  const expense = txs
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amountSatang, 0);

  const transfer = txs
    .filter((tx) => tx.type === 'transfer')
    .reduce((sum, tx) => sum + tx.amountSatang, 0);

  return {
    income,
    expense,
    transfer,
    net: income - expense,
  };
}

export function getTopCategories(userId: string): Array<{ category: string; totalSatang: number }> {
  const totals = new Map<string, number>();

  for (const tx of getUserTransactions(userId)) {
    if (tx.type !== 'expense') {
      continue;
    }

    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amountSatang);
  }

  return [...totals.entries()]
    .map(([category, totalSatang]) => ({ category, totalSatang }))
    .sort((a, b) => b.totalSatang - a.totalSatang)
    .slice(0, 3);
}

export function getMonthlySummary(userId: string): { income: number; expense: number; net: number; topCategories: Array<{ category: string; totalSatang: number }> } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const txs = getUserTransactions(userId).filter((tx) => new Date(tx.createdAt).getTime() >= startOfMonth);

  const income = txs
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amountSatang, 0);

  const expense = txs
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amountSatang, 0);

  return {
    income,
    expense,
    net: income - expense,
    topCategories: getTopCategories(userId),
  };
}
