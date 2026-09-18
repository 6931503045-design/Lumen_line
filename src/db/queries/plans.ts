// ไฟล์นี้ทำหน้าที่อะไร: query ตาราง plans และยอดโอนเข้าแผน — ให้ plan.service เอาไปคิดต่อ
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S5.3–§S5.6
// ⚖️ กฎเหล็ก G3, G6, G7
//
// ไฟล์นี้ไม่คำนวณสูตรใดๆ — capacity, 3 ทางเลือก และการตัดสินใจทั้งหมดอยู่ที่
// services/plan.service.ts ตามการแบ่งชั้นเดียวกับ summary/budget
//
// ⚖️ G7 + CHECK ของตาราง: plan_id ผูกได้เฉพาะ transaction ที่ type='transfer' เท่านั้น
// การโอนเข้าแผนจึงไม่ถูกนับเป็นรายจ่าย = ไม่ไปหักยอด "ใช้ได้ต่อวัน" ซ้ำสองรอบ

import { supabase } from '../supabase';
import { fromSatang } from '../../utils/money';

export type PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type PlanConfidence = 'low' | 'medium' | 'high';

export type PlanRow = {
  id: string;
  title: string;
  /** numeric(12,2) จาก Supabase มาเป็น string ต้องผ่าน money.toSatang ก่อนคำนวณ */
  target_amount: string;
  target_date: string;
  monthly_save: string;
  status: PlanStatus;
  confidence: PlanConfidence;
  created_at: string;
  confirmed_at: string | null;
};

const PLAN_COLUMNS =
  'id, title, target_amount, target_date, monthly_save, status, confidence, created_at, confirmed_at';

/** แผนของผู้ใช้ตามสถานะที่ขอ ⚖️ G6 */
export async function listPlansByUser(
  userId: string,
  statuses: PlanStatus[]
): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('plans')
    .select(PLAN_COLUMNS)
    .eq('user_id', userId)
    .in('status', statuses)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  return (data ?? []) as PlanRow[];
}

export async function findPlanOwnedByUser(
  userId: string,
  planId: string
): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from('plans')
    .select(PLAN_COLUMNS)
    .eq('user_id', userId)
    .eq('id', planId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data ?? null) as PlanRow | null;
}

export type InsertPlanInput = {
  title: string;
  targetSatang: number;
  targetDate: string;
  monthlySaveSatang: number;
  confidence: PlanConfidence;
};

/**
 * บันทึกชุดทางเลือกใหม่เป็น draft ทั้งหมด (S5.4)
 * insert ทีเดียวทั้งชุด เพื่อให้ผู้ใช้ไม่เห็นชุดที่ขึ้นมาครึ่งๆ ถ้าล้มกลางทาง
 */
export async function insertDraftPlans(
  userId: string,
  drafts: InsertPlanInput[]
): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('plans')
    .insert(
      drafts.map((draft) => ({
        user_id: userId,
        title: draft.title,
        target_amount: fromSatang(draft.targetSatang),
        target_date: draft.targetDate,
        monthly_save: fromSatang(draft.monthlySaveSatang),
        status: 'draft',
        confidence: draft.confidence,
      }))
    )
    .select(PLAN_COLUMNS);

  if (error) {
    throw error;
  }
  return (data ?? []) as PlanRow[];
}

/** ยกเลิก draft เก่าทั้งหมดของผู้ใช้ — S5.4 "สร้างชุดใหม่ draft เก่าถูก cancelled ทั้งหมด" */
export async function cancelDraftPlans(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('plans')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('status', 'draft')
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

/**
 * เปลี่ยนสถานะแผน โดยบังคับว่าสถานะเดิมต้องเป็นค่าที่คาดไว้
 *
 * เงื่อนไข .eq('status', from) ทำให้การกดยืนยันสองครั้งติดกัน (เน็ตช้าแล้วกดซ้ำ)
 * มีแค่ครั้งแรกที่ได้แถวกลับมา — กันแผนเดียวถูกนับเป็น active ซ้อนกันสองรอบ
 */
export async function transitionPlanStatus(
  userId: string,
  planId: string,
  from: PlanStatus,
  to: PlanStatus,
  setConfirmedAt = false
): Promise<PlanRow | null> {
  const patch: Record<string, unknown> = { status: to };
  if (setConfirmedAt) patch.confirmed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('plans')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', planId)
    .eq('status', from)
    .select(PLAN_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data ?? null) as PlanRow | null;
}

/**
 * ยอดโอนเข้าแผนของผู้ใช้ทุกแผน — คืน map planId -> ผลรวม numeric string
 * ⚖️ G7: นับเฉพาะ type='transfer' ที่ผูก plan_id และยังไม่ถูกลบ (S5.6)
 */
export async function listPlanTransferRows(
  userId: string
): Promise<{ plan_id: string; amount: string }[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('plan_id, amount')
    .eq('user_id', userId)
    .eq('type', 'transfer')
    .not('plan_id', 'is', null)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
  return (data ?? []) as { plan_id: string; amount: string }[];
}

// ────────────────────────────────────────────────────────────────────────────
// query สำหรับงานตามเวลา planCheck (S5.6) — กวาดแผนของผู้ใช้ทุกคน
//
// ⚠️ ข้อยกเว้น G6 ที่ตั้งใจ: สองฟังก์ชันล่างนี้ไม่กรอง user_id เพราะเป็น query ของ
// "งานตามเวลา" ที่ต้องดูแผนของทุกคน ไม่มีผู้ใช้คนไหนเป็นเจ้าของ request
// เรียกได้จาก src/jobs/* เท่านั้น ซึ่งเข้าถึงผ่าน POST /jobs/run ที่ต้องมี CRON_SECRET
// ห้ามเรียกจาก route ที่ผู้ใช้เข้าถึงได้เด็ดขาด
// ────────────────────────────────────────────────────────────────────────────

/** เพดานจำนวนแผนต่อหนึ่งรอบงาน กันงานเดียวรันยาวจนโดน timeout */
const MAX_PLANS_PER_RUN = 500;

export type PlanRowWithOwner = PlanRow & { user_id: string };

/** แผนที่กำลังออมอยู่ของผู้ใช้ทุกคน — ใช้โดย jobs/planCheck.ts เท่านั้น */
export async function listActivePlansAllUsers(): Promise<PlanRowWithOwner[]> {
  const { data, error } = await supabase
    .from('plans')
    .select(`user_id, ${PLAN_COLUMNS}`)
    .eq('status', 'active')
    .order('confirmed_at', { ascending: true })
    .limit(MAX_PLANS_PER_RUN);

  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as PlanRowWithOwner[];
}

/**
 * ยอดโอนเข้าแผนตามรายชื่อ plan ที่ให้มา — ดึงทีเดียวแล้วจัดกลุ่มในโค้ด
 * ไม่ยิงทีละแผนเพราะแผน 500 ใบจะกลายเป็น 500 query
 * ⚖️ G7: นับเฉพาะ transfer ที่ยังไม่ถูกลบ
 */
export async function listTransferRowsForPlans(
  planIds: string[]
): Promise<{ plan_id: string; amount: string }[]> {
  if (planIds.length === 0) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('plan_id, amount')
    .in('plan_id', planIds)
    .eq('type', 'transfer')
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
  return (data ?? []) as { plan_id: string; amount: string }[];
}
