// ไฟล์นี้ทำหน้าที่อะไร: งานตามเวลาที่ตรวจแผนออมของผู้ใช้ทุกคน (หลุดเป้า / ครบเป้า)
// ใครรับผิดชอบ: ③ AI (ตาม SPEC) — แต่ไม่มี AI ในเส้นทางนี้เลย
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S5.6, §S7 ("planCheck | 09:00 ไทย | 0 2 * * * UTC")
// ⚖️ กฎเหล็ก G4
//
// idempotent ด้วย dedup_key ของ push_log: ยิงซ้ำในวันเดียวกันจะไม่ส่งข้อความซ้ำ
// ผลจะขึ้นที่ pushSkipped ไม่ใช่ pushed
//
// ทำงานเฉพาะในช่วง JOB_WINDOWS.planCheck (08:00–20:59 ไทย) — นอกช่วงข้ามไปทั้งรอบ
// เพื่อไม่ให้ push เตือนแผนหรือแสดงความยินดีเด้งตอนกลางคืน ถ้า scheduler ยิงช้า
// (แผนที่ครบเป้าตอนกลางคืนจะถูกปิดในรอบกลางวันถัดไปแทน ไม่มีอะไรหาย)

import { JOB_WINDOWS } from '../config/constants';
import { checkActivePlans, type PlanCheckResult } from '../services/planCheck.service';
import { getTodayIso } from '../utils/thaiDate';
import { checkJobWindow, type OutsideWindowResult } from './window';

export async function runPlanCheckJob(
  now: Date = new Date()
): Promise<PlanCheckResult | OutsideWindowResult> {
  const outside = checkJobWindow(JOB_WINDOWS.planCheck, now);
  if (outside) return outside;
  return checkActivePlans(getTodayIso(now), now);
}
