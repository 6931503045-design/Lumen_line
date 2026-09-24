// ไฟล์นี้ทำหน้าที่อะไร: สร้าง/แก้/ลบหมวดหมู่ของผู้ใช้ (เบื้องหลังหน้า "หมวดหมู่" ในเว็บ)
// ใครรับผิดชอบ: ③ Core API
// เขียนในสัปดาห์: W6
// ⚖️ กฎเหล็ก G6 — ทุก query กรอง user_id จากแหล่งที่เซ็นแล้ว
//
// 🔴 ไม่มี AI ในไฟล์นี้ ทุกอย่างเป็นการตรวจค่าตรงๆ
//
// ทำไมต้องมีชั้นนี้: เดิมหน้าเว็บมีปุ่มเพิ่ม/แก้/ลบหมวดครบ แต่ backend มีแค่ GET
// ปุ่มพวกนั้นจึงแก้แต่ข้อมูลในหน่วยความจำของเบราว์เซอร์ แล้วขึ้นว่า "สำเร็จ"
// ผู้ใช้รีเฟรชทีเดียวหายหมด — ซึ่งแย่กว่าไม่มีปุ่มเลย

import {
  countTransactionsUsingCategory,
  deleteCategoryForUser,
  findCategoryOwnedByUser,
  insertCategory,
  updateCategoryForUser,
  type UserCategory,
} from '../db/queries/categories';

/** error ที่รู้ว่าจะตอบ status อะไร ให้ชั้น route แปลงเป็น HTTP ได้ตรงๆ */
export class CategoryError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}

const MAX_NAME_LENGTH = 50;

/**
 * ตรวจชื่อหมวด — ต้องมีตัวอักษรจริง ไม่ใช่ช่องว่างล้วน
 * ตัดช่องว่างหัวท้ายก่อนเทียบ ไม่งั้น "อาหาร" กับ "อาหาร " จะกลายเป็นสองหมวดที่ผู้ใช้แยกไม่ออก
 */
function readName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CategoryError('name ต้องเป็นข้อความ', 400);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CategoryError('ต้องตั้งชื่อหมวดหมู่ก่อน', 400);
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new CategoryError(`ชื่อหมวดหมู่ยาวเกิน ${MAX_NAME_LENGTH} ตัวอักษร`, 400);
  }
  return trimmed;
}

function readType(value: unknown): 'income' | 'expense' {
  if (value !== 'income' && value !== 'expense') {
    throw new CategoryError('type ต้องเป็น income หรือ expense', 400);
  }
  return value;
}

/**
 * อีโมจิของหมวด — ยอมรับ null (ไม่มีอีโมจิ) แต่ไม่ยอมรับข้อความยาว
 * จำกัดความยาวเพราะช่องนี้ไปโผล่ในการ์ดที่ความกว้างจำกัด ถ้าใส่ประโยคยาวหน้าจะแตก
 */
function readEmoji(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new CategoryError('emoji ต้องเป็นข้อความ', 400);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  // 8 ตัวพอสำหรับอีโมจิที่ประกอบจากหลาย code point (เช่น ธงชาติ, อีโมจิที่มี modifier)
  if ([...trimmed].length > 8) {
    throw new CategoryError('emoji ยาวเกินไป', 400);
  }
  return trimmed;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new CategoryError(`${field} ต้องเป็น true หรือ false`, 400);
  }
  return value;
}

export type CategoryView = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  emoji: string | null;
  isEssential: boolean;
  isDefault: boolean;
};

function toView(row: UserCategory): CategoryView {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    emoji: row.emoji,
    isEssential: row.is_essential,
    isDefault: row.is_default,
  };
}

/** สร้างหมวดใหม่ — body: { name, type, emoji?, isEssential? } */
export async function createCategory(
  userId: string,
  input: Record<string, unknown>
): Promise<CategoryView> {
  const name = readName(input.name);
  const type = readType(input.type);
  const emoji = readEmoji(input.emoji);
  const isEssential = input.isEssential === undefined ? false : readBoolean(input.isEssential, 'isEssential');

  const created = await insertCategory({ userId, name, type, emoji, isEssential });
  if (!created) {
    // 409 ไม่ใช่ 400 เพราะคำขอถูกต้องทุกอย่าง แค่ชนกับของที่มีอยู่
    throw new CategoryError(`มีหมวด "${name}" อยู่แล้ว`, 409);
  }
  return toView(created);
}

/**
 * แก้หมวด — ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยน
 *
 * จงใจไม่ให้แก้ type: ถ้าเปลี่ยนหมวด "เงินเดือน" จาก income เป็น expense
 * รายการเก่าทุกรายการที่ผูกอยู่จะเปลี่ยนความหมายย้อนหลังทั้งหมด ยอดสรุปทุกเดือนเพี้ยน
 * อยากเปลี่ยนประเภทให้สร้างหมวดใหม่แล้วย้ายรายการทีละรายการ ซึ่งเห็นผลกระทบชัดกว่า
 */
export async function updateCategory(
  userId: string,
  categoryId: string,
  input: Record<string, unknown>
): Promise<CategoryView> {
  if (input.type !== undefined) {
    throw new CategoryError('เปลี่ยนประเภทของหมวดที่มีอยู่แล้วไม่ได้ — สร้างหมวดใหม่แล้วย้ายรายการแทน', 400);
  }

  const patch: { name?: string; emoji?: string | null; isEssential?: boolean } = {};
  if (input.name !== undefined) patch.name = readName(input.name);
  if (input.emoji !== undefined) patch.emoji = readEmoji(input.emoji);
  if (input.isEssential !== undefined) patch.isEssential = readBoolean(input.isEssential, 'isEssential');

  if (Object.keys(patch).length === 0) {
    throw new CategoryError('ไม่มีฟิลด์ไหนให้แก้', 400);
  }

  const updated = await updateCategoryForUser(userId, categoryId, patch);
  if (updated === 'duplicate') {
    throw new CategoryError(`มีหมวด "${patch.name}" อยู่แล้ว`, 409);
  }
  if (!updated) {
    throw new CategoryError('ไม่พบหมวดหมู่นี้', 404);
  }
  return toView(updated);
}

/**
 * ลบหมวด — ปฏิเสธถ้ายังมีรายการเงินผูกอยู่
 *
 * เหตุผล: transactions.category_id ไม่มี on delete cascade ถ้าปล่อยให้ลบ DB จะปฏิเสธเอง
 * ด้วยข้อความ FK violation ที่ผู้ใช้อ่านไม่รู้เรื่อง — บอกจำนวนรายการไปเลยตรงกว่า
 *
 * ทางเลือกที่ไม่เลือก: set category_id = null ให้รายการเก่า
 * เพราะนั่นคือลบข้อมูลที่ผู้ใช้ไม่ได้สั่งลบ ยอดรายหมวดย้อนหลังจะหายเงียบๆ
 */
export async function removeCategory(userId: string, categoryId: string): Promise<void> {
  const existing = await findCategoryOwnedByUser(userId, categoryId);
  if (!existing) {
    throw new CategoryError('ไม่พบหมวดหมู่นี้', 404);
  }

  const inUse = await countTransactionsUsingCategory(userId, categoryId);
  if (inUse > 0) {
    throw new CategoryError(
      `ลบไม่ได้ — ยังมี ${inUse} รายการอยู่ในหมวดนี้ ย้ายรายการไปหมวดอื่นก่อน`,
      409
    );
  }

  try {
    const removed = await deleteCategoryForUser(userId, categoryId);
    if (!removed) {
      throw new CategoryError('ไม่พบหมวดหมู่นี้', 404);
    }
  } catch (error) {
    // 23503 = foreign_key_violation — ยังมีตารางอื่นผูกอยู่ (เช่น รายการประจำ)
    // ที่ไม่ได้นับข้างบน ต้องแปลงเป็นข้อความที่อ่านรู้เรื่อง ไม่ใช่หลุดไปเป็น 500
    if (error && typeof error === 'object' && (error as { code?: string }).code === '23503') {
      throw new CategoryError('ลบไม่ได้ — ยังมีรายการประจำหรืองบผูกกับหมวดนี้อยู่', 409);
    }
    throw error;
  }
}
