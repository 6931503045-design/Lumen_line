import { assertValidTransactionAmount, toSatang } from '../utils/money';
import {
  getTransactionDetail,
  insertTransaction,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
  type TransactionType,
  type TransactionSource,
  type TransactionParsedBy,
  type TransactionDetail,
} from '../db/queries/transactions';
import {
  findCategoryOwnedByUser,
  findOrCreateCategory,
  listCategoriesByUser,
  type UserCategory,
} from '../db/queries/categories';
import { MAX_AMOUNT_SATANG } from '../config/constants';
import {
  evaluateBudgetAlert,
  getCategoryBudgetStatus,
  type BudgetAlert,
  type BudgetStatus,
} from './budget.service';

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
  /**
   * แผนออมที่รายการนี้โอนเข้า — จำเป็นเมื่อ type='transfer'
   * ⚖️ G7: transfer คือการ "ย้ายเงิน" ไม่ใช่รายรับหรือรายจ่าย ทุกยอดสรุปตัดออกหมด
   */
  planId?: string | null;
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
  /**
   * สถานะงบของหมวดนี้ ณ ตอนนี้ — มีค่าทุกครั้งที่หมวดนั้นตั้งงบไว้ ไม่ใช่เฉพาะตอนข้ามเกณฑ์
   * ต่างจาก budgetAlert ที่มีค่าเฉพาะตอน "เพิ่งข้าม" เพื่อใช้เตือน
   * อันนี้มีไว้ให้การ์ดบันทึกวาดแถบความคืบหน้าได้ทุกครั้ง
   */
  budgetStatus: BudgetStatus | null;
};

export async function createTransaction(
  input: CreateTransactionInput
): Promise<CreatedTransaction> {
  // ไม่มีการแปลงหน่วยใดๆ ที่นี่แล้ว — แค่ตรวจว่าค่าที่ส่งเข้ามา (สตางค์) ถูกต้องตามกฎก่อนเขียน DB
  assertValidTransactionAmount(input.amountSatang);

  // transfer ใช้ได้เฉพาะการโอนเข้าแผนออมเท่านั้น (S5.6)
  // ไม่เปิดให้ transfer ลอยๆ เพราะยังไม่มีความหมายในระบบ แล้วจะกลายเป็นเงินที่
  // หายไปจากทุกยอดสรุปโดยไม่มีที่ไป — ผู้ใช้จะงงว่าเงินหายไปไหน
  if (input.type === 'transfer' && !input.planId) {
    throw new Error('createTransaction: type=transfer ต้องระบุ planId เสมอ');
  }
  if (input.type !== 'transfer' && input.planId) {
    throw new Error('createTransaction: planId ใส่ได้เฉพาะ type=transfer');
  }

  let categoryId: string | null = null;
  if (input.categoryName && input.type !== 'transfer') {
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
    planId: input.planId ?? null,
  });

  return {
    id: row.id,
    amountSatang: input.amountSatang,
    type: row.type,
    occurredAt: row.occurred_at,
    budgetAlert: await safeEvaluateBudgetAlert(input.userId, input.type, categoryId, occurredAt),
    budgetStatus: await safeBudgetStatus(input.userId, input.type, categoryId, occurredAt),
  };
}

/**
 * เช็คงบแล้วห้ามพังการบันทึก — รายการถูกเขียนลง DB ไปแล้วตอนที่ฟังก์ชันนี้ถูกเรียก
 * ถ้าปล่อยให้ error หลุดขึ้นไป ผู้ใช้จะเห็น "บันทึกไม่สำเร็จ" ทั้งที่เงินถูกจดเรียบร้อยแล้ว
 * แล้วจะพิมพ์ซ้ำจนกลายเป็นรายการซ้ำ — การเตือนงบสำคัญน้อยกว่าความถูกต้องของยอดเสมอ
 *
 * ⚖️ G7: เช็คเฉพาะรายจ่าย — รายรับกับ transfer ไม่กินงบหมวด
 */
/** อ่านสถานะงบไว้วาดแถบ — ล้มแล้วไม่ทำให้การบันทึกพัง เพราะรายการถูกเขียนไปแล้ว */
async function safeBudgetStatus(
  userId: string,
  type: TransactionType,
  categoryId: string | null,
  occurredAtIso: string
): Promise<BudgetStatus | null> {
  if (type !== 'expense' || !categoryId) return null;

  try {
    return await getCategoryBudgetStatus(userId, categoryId, new Date(occurredAtIso));
  } catch (err) {
    console.error('[transaction.service] อ่านสถานะงบไม่สำเร็จ (รายการถูกบันทึกแล้ว):', err);
    return null;
  }
}

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
// ────────────────────────────────────────────────────────────────────────────
// แก้ไข / ลบ / กู้คืน — สำหรับหน้าเว็บ
//
// ⚖️ G2 บังคับว่า "AI จะแตะข้อมูลต้องมีคนกดยืนยัน" ผ่าน pending_actions
// เส้นทางนี้ไม่ต้องผ่าน pending เพราะผู้ใช้เป็นคนกดปุ่มเอง = การยืนยันเกิดขึ้นแล้ว
// pending_actions มีไว้กันกรณีที่ AI ตีความข้อความผิดแล้วเขียนข้อมูลโดยผู้ใช้ไม่รู้ตัว
// ซึ่งไม่ใช่กรณีนี้ — ถ้าวันหนึ่ง AI มาเรียกฟังก์ชันพวกนี้ ต้องให้ผ่าน pending ก่อนเสมอ
// ────────────────────────────────────────────────────────────────────────────

/** error ที่ route แปลงเป็น HTTP ได้โดยไม่ต้องเดาจากข้อความ */
export class TransactionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

export type UpdateTransactionInput = {
  type?: TransactionType;
  amountSatang?: number;
  /** ส่ง null เพื่อล้างหมวดออก / ไม่ส่ง = ไม่แตะหมวดเดิม */
  categoryName?: string | null;
  note?: string | null;
  occurredAt?: Date;
};

/** ตรวจจำนวนเงินแบบเดียวกับตอนสร้าง — ใช้ซ้ำทั้ง create, update และชั้น route */
export function assertTransactionAmount(amountSatang: number): void {
  if (!Number.isInteger(amountSatang)) {
    throw new TransactionError('จำนวนเงินต้องเป็นจำนวนเต็มหน่วยสตางค์ (กฎ G3)', 400);
  }
  if (amountSatang <= 0) {
    throw new TransactionError('จำนวนเงินต้องมากกว่า 0 บาท (กฎ G3)', 400);
  }
  if (amountSatang > MAX_AMOUNT_SATANG) {
    throw new TransactionError('จำนวนเงินเกินเพดานที่ระบบรองรับ', 400);
  }
}

export async function updateTransactionForUser(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput
): Promise<CreatedTransaction> {
  if (input.type === 'transfer') {
    throw new TransactionError('ยังไม่รองรับการเปลี่ยนรายการเป็นประเภทโอน', 400);
  }
  if (input.amountSatang !== undefined) {
    assertTransactionAmount(input.amountSatang);
  }

  const existing = await getTransactionDetail(transactionId, userId);
  if (!existing) {
    throw new TransactionError('ไม่พบรายการนี้ในบัญชีของคุณ', 404);
  }

  // หมวดใหม่ต้องเป็นของผู้ใช้คนนี้ — สร้างให้ถ้ายังไม่มี เหมือนตอนบันทึกจากแชท
  // หมวดต้องเป็นประเภทเดียวกับรายการหลังแก้ ไม่ใช่ประเภทเดิม
  // (ย้ายรายจ่ายไปเป็นรายรับแล้วหมวดต้องเป็นหมวดรายรับด้วย)
  const typeAfterUpdate = input.type ?? existing.type;
  let categoryId: string | null | undefined;
  if (input.categoryName !== undefined) {
    categoryId = input.categoryName === null
      ? null
      : await findOrCreateCategory(
          userId,
          input.categoryName,
          typeAfterUpdate === 'income' ? 'income' : 'expense'
        );
  }

  const updated = await updateTransaction(transactionId, userId, {
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.amountSatang !== undefined ? { amountSatang: input.amountSatang } : {}),
    ...(categoryId !== undefined ? { categoryId } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt.toISOString() } : {}),
  });

  if (!updated) {
    throw new TransactionError('ไม่พบรายการนี้ในบัญชีของคุณ', 404);
  }

  const finalCategoryId = categoryId !== undefined ? categoryId : existing.category_id;

  return {
    id: updated.id,
    amountSatang: toSatang(updated.amount),
    type: updated.type,
    occurredAt: updated.occurred_at,
    // แก้ยอดหรือย้ายหมวดแล้วอาจข้ามเกณฑ์งบพอดี — ธงใน DB กันเตือนซ้ำอยู่แล้ว
    budgetAlert: await safeEvaluateBudgetAlert(
      userId,
      typeAfterUpdate,
      finalCategoryId,
      updated.occurred_at
    ),
    budgetStatus: await safeBudgetStatus(
      userId,
      typeAfterUpdate,
      finalCategoryId,
      updated.occurred_at
    ),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// เปลี่ยนหมวดจากแชท (FR-01 / SPEC §S1 postback edit_category) — เดิมเป็น stub "ยังไม่เปิดใช้งาน"
// ────────────────────────────────────────────────────────────────────────────

export type CategoryChoices = {
  transaction: TransactionDetail;
  /** หมวดชนิดเดียวกับรายการ (รายจ่าย → หมวดรายจ่าย) ไม่รวมหมวดปัจจุบัน */
  choices: UserCategory[];
  currentCategoryName: string | null;
};

/**
 * หมวดที่ย้ายรายการนี้ไปได้ — ⚖️ G6: รายการต้องเป็นของผู้ใช้คนนี้ และหมวดมาจากของเขาเท่านั้น
 * รายการโอนเข้าแผน (⚖️ G7) ไม่มีหมวด จึงย้ายหมวดไม่ได้
 */
export async function listCategoryChoices(
  userId: string,
  transactionId: string
): Promise<CategoryChoices> {
  const transaction = await getTransactionDetail(transactionId, userId);
  if (!transaction) {
    throw new TransactionError('ไม่พบรายการนี้ อาจถูกลบไปแล้ว', 404);
  }
  if (transaction.type === 'transfer') {
    throw new TransactionError('รายการโอนเข้าแผนออมไม่มีหมวดให้เปลี่ยน', 400);
  }

  const categories = await listCategoriesByUser(userId);
  const sameType = categories.filter((category) => category.type === transaction.type);
  const current = sameType.find((category) => category.id === transaction.category_id) ?? null;

  return {
    transaction,
    choices: sameType.filter((category) => category.id !== transaction.category_id),
    currentCategoryName: current?.name ?? null,
  };
}

export type CategoryChange = {
  updated: CreatedTransaction;
  categoryName: string;
  /** ชื่อรายการเดิม — ให้การ์ดที่ตอบกลับหน้าตาเหมือนตอนบันทึก */
  title: string | null;
};

/**
 * ย้ายรายการไปหมวดที่ผู้ใช้เลือกจากปุ่ม
 *
 * id ของหมวดมาจาก postback data ซึ่งปลอมได้ จึงต้องตรวจซ้ำทุกอย่าง:
 * หมวดต้องเป็นของผู้ใช้คนนี้ (⚖️ G6) และชนิดต้องตรงกับรายการ (รายจ่ายไปหมวดรายรับไม่ได้)
 */
export async function changeTransactionCategory(
  userId: string,
  transactionId: string,
  categoryId: string
): Promise<CategoryChange> {
  const transaction = await getTransactionDetail(transactionId, userId);
  if (!transaction) {
    throw new TransactionError('ไม่พบรายการนี้ อาจถูกลบไปแล้ว', 404);
  }
  if (transaction.type === 'transfer') {
    throw new TransactionError('รายการโอนเข้าแผนออมไม่มีหมวดให้เปลี่ยน', 400);
  }

  const category = await findCategoryOwnedByUser(userId, categoryId);
  if (!category) {
    throw new TransactionError('ไม่พบหมวดนี้ อาจถูกลบไปแล้ว', 404);
  }
  if (category.type !== transaction.type) {
    throw new TransactionError(
      transaction.type === 'income'
        ? 'รายการนี้เป็นรายรับ ต้องเลือกหมวดรายรับครับ'
        : 'รายการนี้เป็นรายจ่าย ต้องเลือกหมวดรายจ่ายครับ',
      400
    );
  }

  // ผ่าน updateTransactionForUser ตัวเดียวกับหน้าเว็บ — ได้การเช็คงบหมวดใหม่ (S5.8) มาด้วย
  const updated = await updateTransactionForUser(userId, transactionId, { categoryName: category.name });
  return { updated, categoryName: category.name, title: transaction.note };
}

/** ลบแบบ soft delete — กู้คืนได้ คืน false ถ้าไม่เจอหรือถูกลบไปแล้ว */
export async function deleteTransactionForUser(
  userId: string,
  transactionId: string
): Promise<void> {
  const removed = await softDeleteTransaction(transactionId, userId);
  if (!removed) {
    throw new TransactionError('ไม่พบรายการนี้ หรือถูกลบไปแล้ว', 404);
  }
}

export async function restoreTransactionForUser(
  userId: string,
  transactionId: string
): Promise<void> {
  const restored = await restoreTransaction(transactionId, userId);
  if (!restored) {
    throw new TransactionError('ไม่พบรายการนี้ในบัญชีของคุณ', 404);
  }
}
