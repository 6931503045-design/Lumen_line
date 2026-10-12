// ไฟล์นี้ทำหน้าที่อะไร: แปลงรายการที่เพิ่งบันทึก -> ข้อมูลที่การ์ด "บันทึกแล้ว" ใช้
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G1, G3, G7
//
// ทำไมต้องแยกไฟล์: มีผู้เรียกสองทางที่ข้อมูลต้นทางคนละรูป — ทางด่วน regex ส่งมาทีละ
// รายการจาก textHandler ส่วน AI ส่งมาเป็นชุดจาก postbackHandler ถ้าปล่อยให้แต่ละที่
// จัดกลุ่มเอง การ์ดจะหน้าตาไม่ตรงกันทันทีที่ฝั่งใดฝั่งหนึ่งแก้
//
// ⚖️ G1/G3: ที่นี่คือจุดเดียวที่แปลงสตางค์เป็นข้อความ ด้วย formatBaht เท่านั้น
// ไม่มีการบวกลบยอดใดๆ ตัวเลขทุกตัวมาจาก service ตรงๆ
// ⚖️ G7: รายการ type='transfer' ไม่ใช่รายรับหรือรายจ่าย จึงถูกคัดออกก่อนเข้าการ์ด

import type { BudgetStatus } from '../services/budget.service';
import { formatBahtNoSatang, formatBahtShort } from '../utils/money';
import { formatThaiDateTime } from '../utils/thaiDate';
import { buildRecordedCard, type RecordedGroup, type RecordedBudget } from './flex/recordedCard';

export type SavedEntryView = {
  transactionId: string;
  type: 'income' | 'expense' | 'transfer';
  /** ชื่อหมวดที่ลงจริง — ไม่มีได้ถ้าผู้ใช้/AI ไม่ได้ระบุหมวด */
  categoryName?: string | undefined;
  /** ชื่อรายการ เช่น "กาแฟเย็น" — ทางด่วน regex ไม่มีค่านี้ */
  title?: string | undefined;
  amountSatang: number;
  occurredAtIso: string;
  budgetStatus: BudgetStatus | null;
};

/** หมวดที่ยังไม่ได้ตั้งชื่อ ต้องมีหัวกลุ่มอยู่ดี ไม่งั้นรายการจะลอยไม่มีบริบท */
const UNCATEGORIZED = 'ไม่ระบุหมวด';

export function toRecordedCardInput(entries: SavedEntryView[], assetBaseUrl: string) {
  // ⚖️ G7: โอนเข้าแผนออมไม่ใช่รายรับหรือรายจ่าย ไม่ควรโผล่ในการ์ดบันทึกรายการ
  const visible = entries.filter((entry) => entry.type !== 'transfer');

  // จัดกลุ่มตามหมวด โดยคงลำดับที่เจอครั้งแรกไว้ — ผู้ใช้พิมพ์มาเรียงไหนก็ควรเห็นเรียงนั้น
  const groups: RecordedGroup[] = [];
  const groupByKey = new Map<string, RecordedGroup>();

  for (const entry of visible) {
    const categoryName = entry.categoryName || UNCATEGORIZED;
    const type = entry.type === 'income' ? 'income' : 'expense';
    // แยกกลุ่มด้วยทั้งชนิดและชื่อหมวด เพราะหมวดชื่อเดียวกันมีได้ทั้งฝั่งรับและฝั่งจ่าย
    const key = `${type}:${categoryName}`;

    let group = groupByKey.get(key);
    if (!group) {
      group = { type, categoryName, items: [] };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.items.push({
      transactionId: entry.transactionId,
      occurredLabel: formatThaiDateTime(new Date(entry.occurredAtIso)),
      ...(entry.title ? { title: entry.title } : {}),
      formattedAmount: formatBahtShort(entry.amountSatang),
    });
  }

  // แถบงบ: หมวดเดียวกันต้องขึ้นแถบเดียว แม้จะบันทึกหลายรายการในหมวดนั้น
  // ใช้ค่าของรายการ "สุดท้าย" เพราะยอดสะสมเป็นค่าล่าสุดหลังบันทึกครบทุกแถว
  const budgetByCategory = new Map<string, RecordedBudget>();
  for (const entry of visible) {
    const status = entry.budgetStatus;
    if (!status) continue;
    budgetByCategory.set(status.categoryId, {
      categoryName: status.categoryName,
      // ตัดสตางค์ทิ้งเพราะชื่อหมวดกับยอดอยู่บรรทัดเดียวกัน ยาวแล้วยอดโดนตัด
      formattedSpent: formatBahtNoSatang(status.spentSatang),
      formattedLimit: formatBahtNoSatang(status.limitSatang),
      percentUsed: status.percentUsed,
    });
  }

  return {
    groups,
    budgets: [...budgetByCategory.values()],
    periodNote: 'รอบงบ: รายเดือน (เริ่มวันที่ 1)',
    assetBaseUrl,
  };
}

/** ทางลัดที่ผู้เรียกส่วนใหญ่ต้องการ — แปลงแล้วสร้างการ์ดเลย */
export function buildRecordedCardFor(entries: SavedEntryView[], assetBaseUrl: string) {
  return buildRecordedCard(toRecordedCardInput(entries, assetBaseUrl));
}
