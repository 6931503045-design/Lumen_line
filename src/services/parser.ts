import { parseMoneyLike } from '../lib/money.js';

export type ParsedKind =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'summary'
  | 'balance'
  | 'plan'
  | 'help'
  | 'unknown';

export type ParsedInput = {
  amountSatang?: number;
  label: string;
  kind: ParsedKind;
};

export function parseUserText(input: string): ParsedInput | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (['สรุป', 'summary', 'สรุปเดือนนี้'].includes(normalized)) {
    return { label: 'summary', kind: 'summary' };
  }

  if (['เหลือ', 'balance', 'ยอดคงเหลือ', 'check balance'].includes(normalized)) {
    return { label: 'balance', kind: 'balance' };
  }

  if (['แผน', 'plan', 'แผนออม'].includes(normalized)) {
    return { label: 'plan', kind: 'plan' };
  }

  if (['ช่วยเหลือ', 'help', 'วิธีใช้'].includes(normalized)) {
    return { label: 'help', kind: 'help' };
  }

  if (lower.startsWith('ออม')) {
    const amount = parseMoneyLike(normalized.replace(/^ออม\s*/i, ''));
    if (!amount) {
      return null;
    }

    return {
      amountSatang: amount.amount,
      label: amount.label || 'ออม',
      kind: 'transfer',
    };
  }

  const parsed = parseMoneyLike(normalized);

  if (!parsed) {
    return null;
  }

  const isIncome =
    lower.startsWith('+') ||
    lower.startsWith('income') ||
    lower.startsWith('รายรับ') ||
    lower.startsWith('เงินเดือน') ||
    lower.startsWith('salary');

  return {
    amountSatang: parsed.amount,
    label: parsed.label || 'transaction',
    kind: isIncome ? 'income' : 'expense',
  };
}
