// ไฟล์นี้ทำหน้าที่อะไร: ตัวเช็คว่างานตามเวลาอยู่ในช่วงชั่วโมงที่ยอมให้ทำงานไหม (JOB_WINDOWS)
// ใครรับผิดชอบ: ① Bot Core
//
// ใช้กับงานที่ส่ง push หาผู้ใช้ — ดูเหตุผลที่ต้องมีที่ JOB_WINDOWS ใน config/constants.ts

import { getThaiHour, isWithinThaiHours } from '../utils/thaiDate';

export type JobWindow = { readonly startHour: number; readonly endHour: number };

/** ผลของรอบที่ถูกข้ามเพราะอยู่นอกช่วง — ตอบ 200 ตามปกติ (ไม่ใช่ความผิดพลาด) */
export type OutsideWindowResult = {
  skipped: 'outside_window';
  thaiHour: number;
  window: JobWindow;
};

/** คืนผล "ข้าม" ถ้าอยู่นอกช่วง หรือ null ถ้าทำงานต่อได้ */
export function checkJobWindow(window: JobWindow, now: Date): OutsideWindowResult | null {
  if (isWithinThaiHours(window, now)) return null;
  return { skipped: 'outside_window', thaiHour: getThaiHour(now), window };
}
