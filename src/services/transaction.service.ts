import { assertValidTransactionAmount } from '../utils/money';
import { insertTransaction, type TransactionType, type TransactionSource, type TransactionParsedBy } from '../db/queries/transactions';
import { findOrCreateCategory } from '../db/queries/categories';
import { evaluateBudgetAlert, type BudgetAlert } from './budget.service';

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
  /**
   * เลขอ้างอิงจากธนาคาร (อีเมล) หรือสลิป — ใช้เป็นกุญแจกันรายการซ้ำที่แม่นที่สุดตาม S10
   * ผู้เรียกที่มาจากแชทไม่ต้องส่ง เพราะผู้ใช้พิมพ์เองไม่มีเลขอ้างอิง
   */
  refNumber?: string | null;
};

export type CreatedTransaction = {
  id: string;
  amountSatang: number;
  type: TransactionType;
  occurredAt: string;
  /**
   * S5.8 — ถ้ารายการนี้ทำให้ยอดใช้ของหมวดข้ามเกณฑ์ 80%/100% ของงบ จะมีค่าติดมาด้วย
   * ผู้เรียกฝั่งแชทเอาไปแนบท้าย reply เดียวกันได้เลย (ฟรี ไม่กิน push quota)
   * ผู้เรียกฝั่งอีเมล/recurring ต้องส่งเป็น push เอง
   */
  budgetAlert: BudgetAlert | null;
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
    refNumber: input.refNumber ?? null,
  });

  return {
    id: row.id,
    amountSatang: input.amountSatang,
    type: row.type,
    occurredAt: row.occurred_at,
    budgetAlert: await safeEvaluateBudgetAlert(input.userId, input.type, categoryId, occurredAt),
  };
}

/**
 * เช็คงบแล้วห้ามพังการบันทึก — รายการถูกเขียนลง DB ไปแล้วตอนที่ฟังก์ชันนี้ถูกเรียก
 * ถ้าปล่อยให้ error หลุดขึ้นไป ผู้ใช้จะเห็น "บันทึกไม่สำเร็จ" ทั้งที่เงินถูกจดเรียบร้อยแล้ว
 * แล้วจะพิมพ์ซ้ำจนกลายเป็นรายการซ้ำ — การเตือนงบสำคัญน้อยกว่าความถูกต้องของยอดเสมอ
 *
 * ⚖️ G7: เช็คเฉพาะรายจ่าย — รายรับกับ transfer ไม่กินงบหมวด
 */
async function safeEvaluateBudgetAlert(
  userId: string,
  type: TransactionType,
  categoryId: string | null,
  occurredAtIso: string
): Promise<BudgetAlert | null> {
  if (type !== 'expense' || !categoryId) return null;

  try {
    return await evaluateBudgetAlert(userId, categoryId, new Date(occurredAtIso));
  } catch (err) {
    console.error('[transaction.service] เช็คงบรายหมวดไม่สำเร็จ (รายการถูกบันทึกแล้ว):', err);
    return null;
  }
}