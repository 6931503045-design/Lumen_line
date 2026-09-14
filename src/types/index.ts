// ไฟล์นี้ทำหน้าที่อะไร: define interfaces / type สำหรับโครงสร้างข้อมูลระดับแอป
// ใครรับผิดชอบ: ① Bot Core / ② Database / ③ AI
// เขียนในสัปดาห์: W1
// TODO: เพิ่ม type สำหรับ User, Transaction, Plan, Keyword, PendingAction
// ⚖️ กฎเหล็ก G1, G6

export type MoneyType = 'income' | 'expense' | 'transfer';

export interface BasicTransaction {
  id?: string;
  userId: string;
  type: MoneyType;
  amountSatang: number;
  categoryName?: string;
  note?: string;
}
