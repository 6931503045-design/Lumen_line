export function toSatang(input: number | string): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error('Amount must be a non-negative finite number');
    }

    return Math.round(input * 100);
  }

  const raw = String(input).trim();

  if (!raw) {
    throw new Error('Amount cannot be empty');
  }

  const normalized = raw.replace(/,/g, '');

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money value: ${input}`);
  }

  const [whole, fraction = ''] = normalized.split('.');
  const parsedWhole = Number.parseInt(whole, 10) || 0;
  const safeFraction = (fraction + '00').slice(0, 2);
  const satang = parsedWhole * 100 + Number.parseInt(safeFraction, 10);

  if (!Number.isFinite(satang) || satang < 0) {
    throw new Error(`Invalid money value: ${input}`);
  }

  return satang;
}

export function addSatang(a: number, b: number): number {
  return a + b;
}

export function formatBaht(satang: number): string {
  if (!Number.isInteger(satang)) {
    throw new Error('formatBaht expects an integer satang value');
  }

  const sign = satang < 0 ? '-' : '';
  const absolute = Math.abs(satang);
  const baht = Math.floor(absolute / 100);
  const remainder = absolute % 100;

  return `${sign}${baht}.${remainder.toString().padStart(2, '0')}`;
}

export function parseMoneyLike(value: string): { amount: number; label: string } | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/([0-9][0-9,]*(?:\.\d{1,2})?)/);

  if (!match) {
    return null;
  }

  const raw = match[1];

  return {
    amount: toSatang(raw),
    label: trimmed.replace(raw, '').trim() || 'expense',
  };
}
