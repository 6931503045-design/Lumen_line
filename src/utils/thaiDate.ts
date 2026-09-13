// ไฟล์นี้ทำหน้าที่อะไร: helper สำหรับจัดการวันที่แบบไทยและ timezone Asia/Bangkok
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W2
// TODO: เพิ่ม parser สำหรับข้อความภาษาไทย เช่น "วันนี้", "เมื่อวาน", "2 วันก่อน"
// ⚖️ กฎเหล็ก G5

export function getThaiToday(): string {
  return new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
}
