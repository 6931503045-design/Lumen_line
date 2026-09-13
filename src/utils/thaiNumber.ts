// ไฟล์นี้ทำหน้าที่อะไร: แปลงตัวเลขไทย/ตัวเลขแปด/เลขภาษาไทยให้กลายเป็นจำนวนสำหรับคำนวณเงิน
// ใครรับผิดชอบ: ③ AI / ⑤ Integration
// เขียนในสัปดาห์: W2
// TODO: เพิ่ม parser สำหรับการอ่านตัวเลขไทยที่มี comma, dot และสตางค์จริง
// ⚖️ กฎเหล็ก G1, G3

export function normalizeThaiNumber(value: string): number {
  const raw = value.replace(/,/g, '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
