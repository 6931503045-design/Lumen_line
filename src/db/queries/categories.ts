import { supabase } from '../supabase';

export async function findOrCreateCategory(
  userId: string,
  name: string,
  type: 'income' | 'expense'
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .eq('type', type)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }
  if (existing) {
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from('categories')
    .insert({ user_id: userId, name, type, is_default: false, is_essential: false })
    .select('id')
    .single();

  if (insertError || !created) {
    throw insertError ?? new Error('findOrCreateCategory: สร้างหมวดหมู่ไม่สำเร็จ');
  }

  return created.id;
}
