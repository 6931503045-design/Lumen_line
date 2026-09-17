// ไฟล์นี้ทำหน้าที่อะไร: งานตามเวลาที่ทำความสะอาดข้อมูลค้างและ log เก่า
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S7 ("cleanup | 03:00 ไทย | 0 20 * * * UTC")
// ⚖️ กฎเหล็ก G4 — งานนี้ไม่พึ่ง AI เลย

import { runCleanup, type CleanupResult } from '../services/cleanup.service';

export async function runCleanupJob(): Promise<CleanupResult> {
  return runCleanup();
}
