// ไฟล์นี้ทำหน้าที่อะไร: ทะเบียนงานตามเวลาทั้งหมด ให้ routes/jobs.ts เรียกตามชื่อ
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md ตาราง "งานตามเวลา"
//
// งานทุกตัวต้อง idempotent: รันซ้ำแล้วต้องไม่เกิดผลซ้ำ เพราะ GitHub Actions
// รับประกันเวลาไม่ได้และอาจยิงซ้ำได้ (emailPoll กันซ้ำด้วย Message-ID + S10 dedup)
//
// งานที่ SPEC วางไว้แต่ยังไม่ได้เขียน: dailySummary, planCheck, recurringJob, cleanup
// เพิ่มเข้ามาที่นี่เมื่อเขียนเสร็จ — ระหว่างนี้เรียกชื่อพวกนั้นจะได้ 404 ตรงไปตรงมา

import { runEmailPoll } from './emailPoll';

export type JobName = 'emailPoll';

export const JOBS: Record<JobName, () => Promise<unknown>> = {
  emailPoll: runEmailPoll,
};

export function isJobName(value: string): value is JobName {
  return Object.prototype.hasOwnProperty.call(JOBS, value);
}
