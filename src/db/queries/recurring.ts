// ไฟล์นี้ทำหน้าที่อะไร: query ตาราง recurring_rules — อ่านกฎที่ถึงรอบ, สร้าง/ลบกฎ, เลื่อน next_run
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S5.9 Recurring, §S7 ตารางงานตามเวลา
// ⚖️ กฎเหล็ก G3, G6
//
// ⚠️ ข้อยกเว้น G6 ที่ตั้งใจ: listDueRulesAllUsers() ไม่กรอง user_id เพราะเป็น query ของ
// "งานตามเวลา" ที่ต้องกวาดกฎของผู้ใช้ทุกคน — ไม่มีผู้ใช้คนไหนเป็นเจ้าของ request นี้
// เรียกได้จาก src/jobs/* เท่านั้น ซึ่งเข้าถึงได้ผ่าน POST /jobs/run ที่ต้องมี CRON_SECRET
// ห้ามเรียกจาก route ที่ผู้ใช้เข้าถึงได้เด็ดขาด

import { supabase } from '../supabase';
import { fromSatang } from '../../utils/money';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringRuleRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  label: string;
  type: 'income' | 'expense';
  /** numeric(12,2) จาก Supabase มาเป็น string ต้องผ่าน money.toSatang ก่อนคำนวณ */
  amount: string;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  day_of_week: number | null;
  next_run: string;
  end_date: string | null;
  is_active: boolean;
};

export type RecurringRuleWithCategory = RecurringRuleRow & {
  categories: { name: string; emoji: string | null } | null;
};

const RULE_COLUMNS =
  'id, user_id, category_id, label, type, amount, frequency, day_of_month, day_of_week, next_run, end_date, is_active';

/** เพดานจำนวนกฎที่หยิบมาทำต่อหนึ่งรอบงาน กันงานเดียวรันยาวจนโดน timeout */
const MAX_DUE_RULES = 500;

/**
 * กฎของ "ผู้ใช้ทุกคน" ที่ถึงรอบแล้ว (next_run <= วันนี้) และยังเปิดใช้งานอยู่
 * ใช้โดย jobs/recurringJob.ts เท่านั้น — ดูหมายเหตุ G6 หัวไฟล์
 */
export async function listDueRulesAllUsers(todayIso: string): Promise<RecurringRuleRow[]> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select(RULE_COLUMNS)
    .eq('is_active', true)
    .lte('next_run', todayIso)
    .order('next_run', { ascending: true })
    .limit(MAX_DUE_RULES);

  if (error) {
    throw error;
  }
  return (data ?? []) as RecurringRuleRow[];
}

/** กฎที่ยังเปิดใช้งานของผู้ใช้คนหนึ่ง — ใช้คำนวณ recurringTotal (S5.3) และแสดงในหน้าเว็บ */
export async function listActiveRulesByUser(
  userId: string
): Promise<RecurringRuleWithCategory[]> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select(`${RULE_COLUMNS}, categories(name, emoji)`)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('next_run', { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as RecurringRuleWithCategory[];
}

export type InsertRecurringRuleInput = {
  userId: string;
  categoryId: string | null;
  label: string;
  type: 'income' | 'expense';
  /** หน่วยสตางค์ (G3) — แปลงเป็นบาทตอนเขียนลง DB ที่นี่ที่เดียว */
  amountSatang: number;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextRun: string;
  endDate: string | null;
};

export async function insertRecurringRule(
  input: InsertRecurringRuleInput
): Promise<RecurringRuleRow> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({
      user_id: input.userId,
      category_id: input.categoryId,
      label: input.label,
      type: input.type,
      amount: fromSatang(input.amountSatang),
      frequency: input.frequency,
      day_of_month: input.dayOfMonth,
      day_of_week: input.dayOfWeek,
      next_run: input.nextRun,
      end_date: input.endDate,
      is_active: true,
    })
    .select(RULE_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error('insertRecurringRule: สร้างกฎไม่สำเร็จ');
  }
  return data as RecurringRuleRow;
}

/**
 * เลื่อนรอบถัดไปของกฎ (และปิดกฎถ้าเลย end_date แล้ว)
 * job เรียกตัวนี้หลังสร้างรายการย้อนหลังครบทุกรอบที่ค้างอยู่
 */
export async function updateRuleSchedule(
  ruleId: string,
  nextRun: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('recurring_rules')
    .update({ next_run: nextRun, is_active: isActive })
    .eq('id', ruleId);

  if (error) {
    throw error;
  }
}

/** ปิดกฎของผู้ใช้ (ไม่ลบทิ้ง เพื่อให้รายการเก่าที่อ้าง recurring_rule_id ยังตามรอยได้) */
export async function deactivateRule(userId: string, ruleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('id', ruleId)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

/**
 * สร้าง transaction ของรอบหนึ่ง แบบ "ซ้ำแล้วไม่เป็นไร"
 *
 * ตาราง transactions มี `unique (recurring_rule_id, recurring_run_date)` อยู่แล้ว
 * ถ้าชน 23505 แปลว่ารอบนี้ถูกสร้างไปแล้ว (เช่น node-cron กับ GitHub Actions ยิงพร้อมกัน)
 * ซึ่งไม่ใช่ error — คืน null ให้ผู้เรียกข้ามไปรอบถัดไป นี่คือหัวใจของ idempotent ตาม S7
 */
export async function insertRecurringTransaction(input: {
  userId: string;
  categoryId: string | null;
  type: 'income' | 'expense';
  amountSatang: number;
  note: string;
  occurredAt: string;
  ruleId: string;
  runDate: string;
}): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: input.userId,
      category_id: input.categoryId,
      type: input.type,
      amount: fromSatang(input.amountSatang),
      note: input.note,
      occurred_at: input.occurredAt,
      source: 'recurring',
      parsed_by: 'manual',
      recurring_rule_id: input.ruleId,
      recurring_run_date: input.runDate,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return null;
    }
    throw error;
  }
  return data as { id: string };
}
