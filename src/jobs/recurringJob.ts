// ไฟล์นี้ทำหน้าที่อะไร: งานตามเวลาที่สร้างรายการประจำของผู้ใช้ทุกคนเมื่อถึงรอบ
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S5.9, §S7 ("recurring | 06:00 | 0 6 * * * | 0 23 * * * UTC")
// ⚖️ กฎเหล็ก G3, G4 — งานนี้ไม่พึ่ง AI เลย
//
// idempotent ด้วย unique (recurring_rule_id, recurring_run_date) ของตาราง transactions
// ยิงซ้ำกี่ครั้งในวันเดียวกันก็ได้ ผลลัพธ์จะขึ้นที่ skippedDuplicate ไม่ใช่ created

import { processDueRecurringRules, type RecurringRunResult } from '../services/recurring.service';

export async function runRecurringJob(): Promise<RecurringRunResult> {
  return processDueRecurringRules();
}
