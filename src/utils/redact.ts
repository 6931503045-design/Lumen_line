// ไฟล์นี้ทำหน้าที่อะไร: ลบข้อมูลส่วนตัวก่อนส่งข้อความหรือสลิปให้ Gemini หรือ log
// ใครรับผิดชอบ: ① Bot Core / ③ AI
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม regex สำหรับเลขบัญชี, บัตร, เบอร์โทร, เลขบัตรประชาชน แบบครบถ้วน
// ⚖️ กฎเหล็ก G5

export function redactSensitiveText(input: string): string {
  return input
    .replace(/\b\d{10,16}\b/g, '[REDACTED]')
    .replace(/\b\d{13}\b/g, '[REDACTED]')
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[REDACTED]');
}
