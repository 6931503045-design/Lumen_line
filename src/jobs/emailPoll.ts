// ไฟล์นี้ทำหน้าที่อะไร: งานตามเวลาที่ไปดึงอีเมลธนาคารเข้ามาเป็นรายการเงิน
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8, ตารางงานตามเวลา ("emailPoll | ทุก 5 นาที | */5 * * * *")
// ⚖️ กฎเหล็ก G4 — งานนี้ไม่พึ่ง AI เลย ปิด AI_ENABLED แล้วยังทำงานได้ปกติ

import { pollBankEmails, type EmailPollResult } from '../services/email.service';

export async function runEmailPoll(): Promise<EmailPollResult> {
  return pollBankEmails();
}
