// ไฟล์นี้ทำหน้าที่อะไร: ดึงรายการดิบตามช่วงเวลาเพื่อให้ service เอาไปรวมยอด
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G6, G7
//
// ไฟล์นี้ "ไม่รวมยอดเอง" — หน้าที่บวกลบอยู่ที่ services/summary.service.ts ตามการแบ่งชั้น
// ที่นี่ทำแค่สองอย่าง: กรอง user_id ให้ถูกคน (G6) และตัดรายการที่ถูกลบทิ้งออก
//
// ⚠️ ข้อจำกัดที่รู้อยู่: Supabase client ทำ SUM/GROUP BY ฝั่ง DB ไม่ได้ถ้าไม่เขียน RPC
// จึงดึงแถวมารวมในโค้ดแทน มี MAX_ROWS กันดึงทั้งตารางเผลอ ถ้าวันหนึ่งข้อมูลโตเกินนี้
// ต้องย้ายไปเขียนเป็น Postgres function แล้วเรียกผ่าน supabase.rpc()

import { supabase } from '../supabase';
import { toBangkokDayStart } from '../../utils/thaiDate';

/** เพดานจำนวนแถวต่อการ query หนึ่งครั้ง — กันเผลอดึงทั้งตารางเข้าหน่วยความจำ */
const MAX_ROWS = 5000;

export type SummaryRow = {
  type: 'income' | 'expense' | 'transfer';
  /** numeric(12,2) จาก Supabase มาเป็น string เสมอ ต้องผ่าน money.toSatang ก่อนคำนวณ */
  amount: string;
  occurred_at: string;
  category_id: string | null;
};

/**
 * ดึงรายการของผู้ใช้คนหนึ่งในช่วง [fromIsoDate, toIsoDateExclusive)
 * ขอบเขตคิดตามเวลาไทย ไม่ใช่ UTC
 */
export async function listTransactionRowsInRange(
  userId: string,
  fromIsoDate: string,
  toIsoDateExclusive: string
): Promise<SummaryRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, occurred_at, category_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('occurred_at', toBangkokDayStart(fromIsoDate))
    .lt('occurred_at', toBangkokDayStart(toIsoDateExclusive))
    .order('occurred_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    throw error;
  }
  return (data ?? []) as SummaryRow[];
}

/**
 * ดึงรายการทั้งหมดของผู้ใช้ (ที่ยังไม่ถูกลบ) สำหรับคำนวณยอดคงเหลือสะสม
 * ไม่จำกัดช่วงเวลา แต่ยังจำกัดจำนวนแถวด้วย MAX_ROWS เหมือนกัน
 */
export async function listAllTransactionRows(userId: string): Promise<SummaryRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, occurred_at, category_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    throw error;
  }
  return (data ?? []) as SummaryRow[];
}
