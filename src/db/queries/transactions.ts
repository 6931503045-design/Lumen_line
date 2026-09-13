import { supabase } from '../supabase';
import { fromSatang } from '../../utils/money';

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionSource = 'chat' | 'image' | 'email' | 'recurring' | 'liff';
export type TransactionParsedBy = 'regex' | 'dictionary' | 'learned' | 'ai' | 'manual';

export type InsertTransactionInput = {
  userId: string;
  categoryId: string | null;
  type: TransactionType;
  amountSatang: number;
  note?: string;
  occurredAt: string;
  source: TransactionSource;
  parsedBy: TransactionParsedBy;
};

export type InsertedTransaction = {
  id: string;
  amount: string;
  type: TransactionType;
  occurred_at: string;
};

export async function insertTransaction(
  input: InsertTransactionInput
): Promise<InsertedTransaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: input.userId,
      category_id: input.categoryId,
      type: input.type,
      amount: fromSatang(input.amountSatang),
      note: input.note ?? null,
      occurred_at: input.occurredAt,
      source: input.source,
      parsed_by: input.parsedBy,
    })
    .select('id, amount, type, occurred_at')
    .single();

  if (error || !data) {
    throw error ?? new Error('insertTransaction: insert ไม่สำเร็จโดยไม่มี error object');
  }

  return data as InsertedTransaction;
}
