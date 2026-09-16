// ไฟล์นี้ทำหน้าที่อะไร: query ตาราง budgets — อ่าน/ตั้ง/ลบงบรายหมวด และติดธงว่าเตือนไปแล้ว
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S5.8 งบรายหมวด
// ⚖️ กฎเหล็ก G3, G6
//
// ไฟล์นี้ "ไม่คำนวณอะไรเลย" — ไม่รู้ด้วยซ้ำว่า 80% คืออะไร
// หน้าที่เทียบยอด/ตัดสินใจเตือนอยู่ที่ services/budget.service.ts ตามการแบ่งชั้นเดียวกับ summary
//
// ⚖️ G6: ทุก query ที่นี่กรอง user_id เสมอ แม้แต่ตอน update ด้วย id ของแถวเอง
//        เพราะ id เป็น uuid ที่เดาไม่ได้ก็จริง แต่ถ้าวันหนึ่งมันหลุดมาทาง request
//        การไม่กรอง user_id จะกลายเป็นช่องแก้งบของคนอื่นทันที

import { supabase } from '../supabase';

export type BudgetRow = {
  id: string;
  category_id: string;
  /** วันแรกของเดือนในรูป `YYYY-MM-DD` (คอลัมน์เป็น date) */
  month: string;
  /** numeric(12,2) จาก Supabase มาเป็น string เสมอ ต้องผ่าน money.toSatang ก่อนคำนวณ */
  limit_amount: string;
  alerted_80: boolean;
  alerted_100: boolean;
};

export type BudgetRowWithCategory = BudgetRow & {
  categories: { name: string; emoji: string | null; type: 'income' | 'expense' } | null;
};

const SELECT_WITH_CATEGORY = 'id, category_id, month, limit_amount, alerted_80, alerted_100, categories(name, emoji, type)';

/** งบทุกหมวดของผู้ใช้ในเดือนที่ระบุ (monthIso = `YYYY-MM-01`) */
export async function listBudgetsByMonth(
  userId: string,
  monthIso: string
): Promise<BudgetRowWithCategory[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select(SELECT_WITH_CATEGORY)
    .eq('user_id', userId)
    .eq('month', monthIso);

  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as BudgetRowWithCategory[];
}

/** งบของหมวดเดียวในเดือนที่ระบุ คืน null ถ้าผู้ใช้ยังไม่ได้ตั้งงบหมวดนี้ */
export async function findBudget(
  userId: string,
  categoryId: string,
  monthIso: string
): Promise<BudgetRow | null> {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category_id, month, limit_amount, alerted_80, alerted_100')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('month', monthIso)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data ?? null) as BudgetRow | null;
}

/**
 * ตั้งหรือแก้งบของหมวดหนึ่งในเดือนหนึ่ง — อาศัย unique (user_id, category_id, month)
 *
 * รีเซ็ต alerted_80/alerted_100 กลับเป็น false ทุกครั้งที่ตั้งค่าใหม่โดยตั้งใจ:
 * ผู้ใช้ที่ขยับเพดานงบขึ้นแล้วยังโดนเตือน "ใช้เกิน 80%" ของเพดานเก่าค้างอยู่ จะงง
 * และถ้าไม่รีเซ็ต การขยับเพดานขึ้นจะทำให้ไม่มีการเตือนรอบใหม่เลยตลอดเดือน
 *
 * @param limitBaht จำนวนเงินหน่วย "บาท" ในรูป numeric string (จาก money.fromSatang)
 *                  ไม่ใช่สตางค์ เพราะคอลัมน์ limit_amount เป็น numeric(12,2) หน่วยบาท
 */
export async function upsertBudget(
  userId: string,
  categoryId: string,
  monthIso: string,
  limitBaht: string
): Promise<BudgetRow> {
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: userId,
        category_id: categoryId,
        month: monthIso,
        limit_amount: limitBaht,
        alerted_80: false,
        alerted_100: false,
      },
      { onConflict: 'user_id,category_id,month' }
    )
    .select('id, category_id, month, limit_amount, alerted_80, alerted_100')
    .single();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('upsertBudget: ตั้งงบไม่สำเร็จ');
  }
  return data as BudgetRow;
}

/** ลบงบของหมวดหนึ่งในเดือนหนึ่ง คืน true ถ้ามีแถวถูกลบจริง */
export async function deleteBudget(
  userId: string,
  categoryId: string,
  monthIso: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('month', monthIso)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

/**
 * ติดธงว่าเตือนระดับนี้ไปแล้ว — S5.8 กำหนดว่าแต่ละระดับเตือน "ครั้งเดียว" ต่อเดือน
 *
 * ใส่เงื่อนไข .eq(ธง, false) ไว้ด้วย แล้วดูว่ามีแถวกลับมาไหม เพื่อให้ฟังก์ชันนี้
 * ทำหน้าที่เป็น "ตัวกันเตือนซ้ำ" ระดับ DB ด้วย: ถ้ามีสองรายการเข้ามาพร้อมกัน
 * (เช่น อีเมลเข้าตอนผู้ใช้กำลังพิมพ์ในแชท) จะมีแค่ฝั่งเดียวที่ได้แถวกลับไปเตือน
 */
export async function claimBudgetAlert(
  userId: string,
  budgetId: string,
  threshold: 80 | 100
): Promise<boolean> {
  // ถึง 100% ให้ถือว่าผ่าน 80% ไปแล้วด้วย กันเคสที่กระโดดข้าม 80 ไปเลยในรายการเดียว
  // แล้วเดือนถัดมามีคนแก้งบขึ้นจนเหลือ 85% ซึ่งจะเตือนซ้ำเรื่องเดิม
  const patch =
    threshold === 100 ? { alerted_100: true, alerted_80: true } : { alerted_80: true };
  const flagColumn = threshold === 100 ? 'alerted_100' : 'alerted_80';

  const { data, error } = await supabase
    .from('budgets')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', budgetId)
    .eq(flagColumn, false)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}
