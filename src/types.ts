export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amountSatang: number;
  label: string;
  category: string;
  parsedBy: 'manual' | 'ai';
  createdAt: string;
}

export interface Summary {
  income: number;
  expense: number;
  transfer: number;
  net: number;
}

export interface CreateTransactionInput {
  userId: string;
  type: TransactionType;
  amount: number | string;
  label: string;
  category?: string;
  parsedBy?: 'manual' | 'ai';
}
