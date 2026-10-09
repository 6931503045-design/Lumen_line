// ไฟล์นี้ทำหน้าที่อะไร: งานตามเวลาที่ส่งสรุปประจำวันให้ผู้ใช้ที่เปิด daily_summary_enabled ไว้
// ใครรับผิดชอบ: ① Bot Core / ② Database
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §S7 ("dailySummary | 21:00 ไทย | 0 14 * * * UTC")
// ⚖️ กฎเหล็ก G4, G7
//
// idempotent ด้วย dedup_key ของ push_log: ยิงซ้ำในวันเดียวกันจะไม่ส่งข้อความซ้ำ
// ผลจะขึ้นที่ pushSkipped ไม่ใช่ pushed

import { sendDailySummaries, type DailySummaryResult } from '../services/dailySummary.service';

export async function runDailySummaryJob(): Promise<DailySummaryResult> {
  return sendDailySummaries();
}
