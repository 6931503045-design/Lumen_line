// ไฟล์นี้ทำหน้าที่อะไร: คำนวณเงินแบบปลอดภัยด้วย integer สตางค์ เพื่อหลีกเลี่ยงข้อผิดพลาด float
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม helper สำหรับ convert จากบาท/สตางค์, round, add, subtract และ format
// ⚖️ กฎเหล็ก G3

export function bahtToSatang(amountBaht: number): number {
  return Math.round(amountBaht * 100);
}

export function satangToBaht(amountSatang: number): number {
  return amountSatang / 100;
}

export function formatBaht(amountSatang: number): string {
  return `฿${satangToBaht(amountSatang).toFixed(2)}`;
}
