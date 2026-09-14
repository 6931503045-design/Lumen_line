import { supabase } from '../supabase';

export async function getUserIdByLineUserId(lineUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('line_user_id', lineUserId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[db/queries/users] getUserIdByLineUserId error:', error);
    return null;
  }

  return data?.id ?? null;
}
