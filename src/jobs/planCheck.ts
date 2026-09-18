// ไฟล์นี้ทำหน้าที่อะไร: งานตามเวลาที่ตรวจแผนออมของผู้ใช้ทุกคน (หลุดเป้า / ครบเป้า)
// ใครรับผิดชอบ: ③ AI (ตาม SPEC) — แต่ไม่มี AI ในเส้นทางนี้เลย
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S5.6, §S7 ("planCheck | 09:00 ไทย | 0 2 * * * UTC")
// ⚖️ กฎเหล็ก G4
//
// idempotent ด้วย dedup_key ของ push_log: ยิงซ้ำในวันเดียวกันจะไม่ส่งข้อความซ้ำ
// ผลจะขึ้นที่ pushSkipped ไม่ใช่ pushed

import { checkActivePlans, type PlanCheckResult } from '../services/planCheck.service';

export async function runPlanCheckJob(): Promise<PlanCheckResult> {
  return checkActivePlans();
}
