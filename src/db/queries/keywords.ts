// ไฟล์นี้ทำหน้าที่อะไร: query ของพจนานุกรมส่วนตัว (L3) — "คำนี้ของผู้ใช้คนนี้ อยู่หมวดไหน"
// ใครรับผิดชอบ: ③ AI
// อ้างอิง: SPEC.md §S4 L3 · ตาราง user_keyword_map (001_init.sql)
// ⚖️ กฎเหล็ก G5, G6
//
// ⚖️ G6: ทุก query กรอง user_id — คำเดียวกันของคนละคนอยู่คนละหมวดได้
// ⚖️ G5: เก็บแค่คำสั้น ๆ ที่ผู้ใช้พิมพ์เป็นชื่อรายการ (normalize แล้วที่ keyword.service) ไม่ใช่ข้อความทั้งประโยค

import { supabase } from '../supabase';

export type LearnedKeyword = {
  categoryId: string;
  categoryName: string;
  categoryType: 'income' | 'expense';
  hitCount: number;
};

type KeywordRow = {
  category_id: string;
  hit_count: number;
  categories: { name: string; type: 'income' | 'expense' } | null;
};

/** หมวดที่ผู้ใช้เคยสอนไว้สำหรับคำนี้ — null ถ้ายังไม่เคยสอน */
export async function findLearnedKeyword(userId: string, keyword: string): Promise<LearnedKeyword | null> {
  const { data, error } = await supabase
    .from('user_keyword_map')
    .select('category_id, hit_count, categories(name, type)')
    .eq('user_id', userId)
    .eq('keyword', keyword)
    .maybeSingle();

  if (error) {
    throw error;
  }
  const row = data as KeywordRow | null;
  // หมวดถูกลบ → FK ลบแถวนี้ตาม (on delete cascade) แต่กันไว้เผื่อ join ไม่เจอ
  if (!row || !row.categories) return null;
  return {
    categoryId: row.category_id,
    categoryName: row.categories.name,
    categoryType: row.categories.type,
    hitCount: row.hit_count,
  };
}

/**
 * จำว่า "คำนี้ → หมวดนี้" — ถ้าเคยจำไว้แล้วให้ย้ายไปหมวดใหม่
 * hit_count นับว่าผู้ใช้ยืนยันคู่นี้กี่ครั้ง (สอนหมวดเดิมซ้ำ +1 / เปลี่ยนหมวด = เริ่มนับ 1 ใหม่)
 */
export async function upsertLearnedKeyword(
  userId: string,
  keyword: string,
  categoryId: string
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('user_keyword_map')
    .select('id, category_id, hit_count')
    .eq('user_id', userId)
    .eq('keyword', keyword)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const now = new Date().toISOString();

  if (existing) {
    const sameCategory = existing.category_id === categoryId;
    const { error } = await supabase
      .from('user_keyword_map')
      .update({
        category_id: categoryId,
        hit_count: sameCategory ? existing.hit_count + 1 : 1,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('user_keyword_map')
    .insert({ user_id: userId, keyword, category_id: categoryId, hit_count: 1, updated_at: now });

  // 23505 = อีก request สอนคำเดียวกันพร้อมกันพอดี — ถือว่าจำไว้แล้ว ไม่ใช่ความผิดพลาด
  if (error && error.code !== '23505') {
    throw error;
  }
}
