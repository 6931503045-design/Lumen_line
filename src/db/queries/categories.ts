// ไฟล์นี้ทำหน้าที่อะไร: query สำหรับ categories
// ใครรับผิดชอบ: ② Database
// ⚖️ กฎเหล็ก G6 — ทุก query กรอง user_id
//
// 🔴 แก้บั๊ก race condition: เดิมเป็น select-แล้วค่อย-insert เฉยๆ ถ้าผู้ใช้พิมพ์สองข้อความ
// หมวดเดียวกันติดกัน ทั้งสอง request จะ select ไม่เจอพร้อมกันแล้ว insert พร้อมกัน
// ตัวหลังชน unique (user_id, name, type) แล้ว throw ทำให้ผู้ใช้เห็น "บันทึกไม่สำเร็จ"
// ทั้งที่ควรใช้หมวดเดิมได้ ตอนนี้ถ้าชนจะอ่านซ้ำแล้วใช้แถวที่อีกฝั่งสร้างไว้แทน
//
// จงใจไม่ใช้ upsert เพราะ upsert จะ UPDATE แถวเดิมทับ ทำให้ is_default/is_essential
// ของหมวดตั้งต้นที่ seed ไว้ตอน follow (เช่น "อาหาร" ที่เป็น is_essential: true)
// ถูกรีเซ็ตเป็น false โดยไม่ตั้งใจ

import { supabase } from '../supabase';

/** อ่าน id ของหมวดตามชื่อ+ประเภทของผู้ใช้คนนี้ คืน null ถ้ายังไม่มี */
async function findCategoryId(
  userId: string,
  name: string,
  type: 'income' | 'expense'
): Promise<string | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .eq('type', type)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.id ?? null;
}

export async function findOrCreateCategory(
  userId: string,
  name: string,
  type: 'income' | 'expense'
): Promise<string> {
  const existingId = await findCategoryId(userId, name, type);
  if (existingId) {
    return existingId;
  }

  const { data: created, error: insertError } = await supabase
    .from('categories')
    .insert({ user_id: userId, name, type, is_default: false, is_essential: false })
    .select('id')
    .single();

  if (insertError) {
    // 23505 = unique_violation แปลว่ามี request อื่นสร้างหมวดนี้ไปแล้วระหว่างที่เรากำลังจะสร้าง
    // ไม่ใช่ error จริง — อ่านซ้ำแล้วใช้แถวของอีกฝั่งได้เลย
    if (insertError.code === '23505') {
      const racedId = await findCategoryId(userId, name, type);
      if (racedId) {
        return racedId;
      }
    }
    throw insertError;
  }

  if (!created) {
    throw new Error('findOrCreateCategory: สร้างหมวดหมู่ไม่สำเร็จ');
  }

  return created.id;
}

export type UserCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  emoji: string | null;
  is_essential: boolean;
  is_default: boolean;
};

/**
 * รายชื่อหมวดทั้งหมดของผู้ใช้คนหนึ่ง เรียงหมวดตั้งต้นขึ้นก่อนแล้วตามด้วยชื่อ
 * ใช้ทั้งฝั่ง LIFF (หน้าหมวดหมู่) และ quick reply ของปุ่ม "แก้หมวด" ในอนาคต
 * ⚖️ G6: กรอง user_id เสมอ
 */
export async function listCategoriesByUser(userId: string): Promise<UserCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type, emoji, is_essential, is_default')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as UserCategory[];
}

/**
 * อ่านหมวดตาม id "ของผู้ใช้คนนี้เท่านั้น" คืน null ถ้าไม่ใช่ของเขาหรือไม่มีจริง
 *
 * ⚖️ G6: จำเป็นเพราะ foreign key ของตาราง budgets ชี้ไป categories(id) เฉยๆ
 * DB จึงยอมให้ผูกงบของเรากับหมวดของคนอื่นได้ถ้าเดา uuid ถูก — ต้องกันที่ชั้นนี้
 */
export async function findCategoryOwnedByUser(
  userId: string,
  categoryId: string
): Promise<UserCategory | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type, emoji, is_essential, is_default')
    .eq('user_id', userId)
    .eq('id', categoryId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data ?? null) as UserCategory | null;
}

/**
 * สร้างหมวดใหม่ที่ผู้ใช้ตั้งเอง — คืน null ถ้าชื่อ+ประเภทนี้มีอยู่แล้ว (23505)
 * ให้ชั้น service ตัดสินใจว่าจะบอกผู้ใช้ว่าอย่างไร ไม่ใช่โยน error ดิบขึ้นไป
 *
 * is_default: false ตายตัว — หมวดตั้งต้นมีแต่ตัวที่ seed ตอน follow เท่านั้น
 * ถ้าปล่อยให้ผู้ใช้ตั้ง is_default ได้ ลำดับการเรียงในหน้าหมวดหมู่จะเพี้ยน
 */
export async function insertCategory(input: {
  userId: string;
  name: string;
  type: 'income' | 'expense';
  emoji: string | null;
  isEssential: boolean;
}): Promise<UserCategory | null> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: input.userId,
      name: input.name,
      type: input.type,
      emoji: input.emoji,
      is_default: false,
      is_essential: input.isEssential,
    })
    .select('id, name, type, emoji, is_essential, is_default')
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  return data as UserCategory;
}

/**
 * แก้หมวดของผู้ใช้คนนี้ — คืน null ถ้าไม่ใช่ของเขา, คืน 'duplicate' ถ้าชื่อซ้ำหมวดอื่น
 * ⚖️ G6: .eq('user_id') คู่กับ .eq('id') เสมอ ไม่ใช่กรอง id อย่างเดียว
 */
export async function updateCategoryForUser(
  userId: string,
  categoryId: string,
  patch: { name?: string; emoji?: string | null; isEssential?: boolean }
): Promise<UserCategory | null | 'duplicate'> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.emoji !== undefined) row.emoji = patch.emoji;
  if (patch.isEssential !== undefined) row.is_essential = patch.isEssential;

  const { data, error } = await supabase
    .from('categories')
    .update(row)
    .eq('user_id', userId)
    .eq('id', categoryId)
    .select('id, name, type, emoji, is_essential, is_default')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return 'duplicate';
    throw error;
  }
  return (data ?? null) as UserCategory | null;
}

/**
 * นับรายการเงินที่ยังผูกกับหมวดนี้ (ไม่นับที่ถูกลบไปแล้ว)
 * ใช้ก่อนลบหมวด เพราะ transactions.category_id ไม่มี on delete cascade
 * ถ้าลบทั้งที่ยังมีรายการผูกอยู่ DB จะปฏิเสธด้วย FK violation ซึ่งผู้ใช้อ่านไม่รู้เรื่อง
 */
export async function countTransactionsUsingCategory(
  userId: string,
  categoryId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
  return count ?? 0;
}

/** ลบหมวดของผู้ใช้คนนี้ คืน false ถ้าไม่มีแถวไหนถูกลบ (ไม่ใช่ของเขา/ไม่มีจริง) */
export async function deleteCategoryForUser(
  userId: string,
  categoryId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('user_id', userId)
    .eq('id', categoryId)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}
