import { toSatang, assertValidTransactionAmount } from '../utils/money';
import { insertTransaction, type TransactionType, type TransactionSource, type TransactionParsedBy } from '../db/queries/transactions';
import { findOrCreateCategory } from '../db/queries/categories';

export type CreateTransactionInput = {
  userId: string;
  type: TransactionType;
  amountBaht: number;
  categoryName?: string;
  note?: string;
  occurredAt?: Date;
  source: TransactionSource;
  parsedBy: TransactionParsedBy;
};

export type CreatedTransaction = {
  id: string;
  amountSatang: number;
  type: TransactionType;
  occurredAt: string;
};

export async function createTransaction(
  input: CreateTransactionInput
): Promise<CreatedTransaction> {
  const amountSatang = toSatang(input.amountBaht);
  assertValidTransactionAmount(amountSatang);

  if (input.type === 'transfer') {
    throw new Error('createTransaction: ยังไม่รองรับ type=transfer ใน W1');
  }

  let categoryId: string | null = null;
  if (input.categoryName) {
    categoryId = await findOrCreateCategory(input.userId, input.categoryName, input.type);
  }

  const occurredAt = (input.occurredAt ?? new Date()).toISOString();

  const row = await insertTransaction({
    userId: input.userId,
    categoryId,
    type: input.type,
    amountSatang,
    note: input.note,
    occurredAt,
    source: input.source,
    parsedBy: input.parsedBy,
  });

  return {
    id: row.id,
    amountSatang,
    type: row.type,
    occurredAt: row.occurred_at,
  };
}
