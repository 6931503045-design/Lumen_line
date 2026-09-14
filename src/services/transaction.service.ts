import { assertValidTransactionAmount } from '../utils/money';
import { insertTransaction, type TransactionType, type TransactionSource, type TransactionParsedBy } from '../db/queries/transactions';
import { findOrCreateCategory } from '../db/queries/categories';

export type CreateTransactionInput = {
  userId: string;
  type: TransactionType;
  /**
   * จำนวนเงินหน่วยสตางค์ (integer) เท่านั้น — ห้ามส่ง "บาท" เข้ามาที่นี่เด็ดขาด
   * ผู้เรียก (textHandler.ts, ทุก handler, ทุก route) มีหน้าที่แปลงเป็นสตางค์ให้เสร็จก่อนเรียกฟังก์ชันนี้
   * (ผ่าน thaiNumber.parseThaiNumber สำหรับข้อความแชท หรือ money.toSatang สำหรับ input อื่นๆ เช่น LIFF)
   * ฟังก์ชันนี้เป็นแค่ "ประตูเขียน DB" ไม่ใช่จุดแปลงหน่วยเงิน — กฎเหล็ก G3
   */
  amountSatang: number;
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
  // ไม่มีการแปลงหน่วยใดๆ ที่นี่แล้ว — แค่ตรวจว่าค่าที่ส่งเข้ามา (สตางค์) ถูกต้องตามกฎก่อนเขียน DB
  assertValidTransactionAmount(input.amountSatang);

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
    amountSatang: input.amountSatang,
    note: input.note,
    occurredAt,
    source: input.source,
    parsedBy: input.parsedBy,
  });

  return {
    id: row.id,
    amountSatang: input.amountSatang,
    type: row.type,
    occurredAt: row.occurred_at,
  };
}