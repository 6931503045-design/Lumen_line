// ไฟล์นี้ทำหน้าที่อะไร: ตัดสินว่ารายการใหม่ซ้ำกับของเดิมไหม ก่อนจะบันทึกลง DB
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S10 Dedup
// ⚖️ กฎเหล็ก G1 — 🔴 ห้ามมี AI ในไฟล์นี้ ตัดสินด้วยกฎตายตัวเท่านั้น
//
// SPEC §S10 ระบุเงื่อนไขไว้แค่ 2 ข้อ และปิดท้ายว่า
// "ห้ามรวมรายการอัตโนมัติด้วยเงื่อนไขอื่นนอกจากนี้ การรวมผิดทำให้ข้อมูลหายแบบไม่มีร่องรอย"
// จึงห้ามเพิ่มเงื่อนไข "ฉลาดๆ" เช่นเทียบชื่อร้านคล้ายกัน เข้ามาในไฟล์นี้เด็ดขาด

import { DEDUP_WINDOW_MINUTES } from '../config/constants';
import { fromSatang } from '../utils/money';
import {
  findSimilarTransaction,
  findTransactionByRefNumber,
  type TransactionType,
} from '../db/queries/transactions';

export type DedupVerdict =
  /** ไม่ซ้ำกับอะไรเลย สร้างรายการใหม่ได้ */
  | { kind: 'unique' }
  /** ซ้ำแน่นอน — ref_number ตรงกัน */
  | { kind: 'exact'; transactionId: string }
  /** น่าจะซ้ำ — ยอด + ประเภทตรงกัน และเวลาห่างกันไม่เกิน DEDUP_WINDOW_MINUTES */
  | { kind: 'probable'; transactionId: string; existingRefNumber: string | null };

export type DedupInput = {
  userId: string;
  type: TransactionType;
  amountSatang: number;
  occurredAt: Date;
  refNumber: string | null;
};

export async function checkDuplicate(input: DedupInput): Promise<DedupVerdict> {
  // เงื่อนไขที่ 1: ref_number เท่ากัน = ซ้ำแน่นอน (แม่นที่สุด ตรวจก่อน)
  if (input.refNumber) {
    const byRef = await findTransactionByRefNumber(input.userId, input.refNumber);
    if (byRef) {
      return { kind: 'exact', transactionId: byRef.id };
    }
  }

  // เงื่อนไขที่ 2: ยอดเท่ากันเป๊ะ + ประเภทเดียวกัน + ห่างกันไม่เกิน 30 นาที = น่าจะซ้ำ
  const windowMs = DEDUP_WINDOW_MINUTES * 60 * 1000;
  const from = new Date(input.occurredAt.getTime() - windowMs).toISOString();
  const to = new Date(input.occurredAt.getTime() + windowMs).toISOString();

  const similar = await findSimilarTransaction(
    input.userId,
    input.type,
    fromSatang(input.amountSatang),
    from,
    to
  );

  if (similar) {
    return {
      kind: 'probable',
      transactionId: similar.id,
      existingRefNumber: similar.ref_number,
    };
  }

  return { kind: 'unique' };
}
