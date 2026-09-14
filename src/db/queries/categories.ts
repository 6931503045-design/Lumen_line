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
