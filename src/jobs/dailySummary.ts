// ไฟล์นี้ทำหน้าที่อะไร: งานตามเวลาที่ส่งสรุปประจำวันให้ผู้ใช้ที่เปิด daily_summary_enabled ไว้
// ใครรับผิดชอบ: ① Bot Core / ② Database
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §S7 ("dailySummary | 21:00 ไทย | 0 14 * * * UTC")
// ⚖️ กฎเหล็ก G4, G7
//
// idempotent ด้วย dedup_key ของ push_log: ยิงซ้ำในวันเดียวกันจะไม่ส่งข้อความซ้ำ
// ผลจะขึ้นที่ pushSkipped ไม่ใช่ pushed
//
// 🔴 ส่งได้เฉพาะในช่วง JOB_WINDOWS.dailySummary (20:00–23:59 ไทย) เท่านั้น
// นอกช่วงจะข้ามไปโดยไม่แตะ DB — เพราะ scheduler (GitHub Actions) ยิงช้าได้หลายชั่วโมง
// ถ้าปล่อยให้ส่งตอนตีสาม "วันนี้" จะกลายเป็นวันใหม่ไปแล้ว (ดูเหตุผลเต็มที่ constants.ts)

import { JOB_WINDOWS } from '../config/constants';
import { sendDailySummaries, type DailySummaryResult } from '../services/dailySummary.service';
import { getTodayIso } from '../utils/thaiDate';
import { checkJobWindow, type OutsideWindowResult } from './window';

export async function runDailySummaryJob(
  now: Date = new Date()
): Promise<DailySummaryResult | OutsideWindowResult> {
  const outside = checkJobWindow(JOB_WINDOWS.dailySummary, now);
  if (outside) return outside;
  return sendDailySummaries(getTodayIso(now), now);
}
