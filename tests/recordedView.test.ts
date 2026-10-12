// ไฟล์นี้ทำหน้าที่อะไร: ทดสอบการแปลงรายการที่บันทึกแล้ว -> การ์ด "บันทึกแล้ว"
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G1, G3, G7
//
// จุดที่ต้องคุ้มครองจริง: การจัดกลุ่ม การไม่ให้แถบงบซ้ำ และ G7 (transfer ไม่ใช่รายจ่าย)
// ทั้งสามอย่างนี้ผิดแล้วผู้ใช้จะเห็นยอดผิดบนการ์ด โดยที่ยอดใน DB ยังถูกต้อง
// ซึ่งหาสาเหตุยากกว่าเพราะหน้าเว็บกับแชทจะไม่ตรงกัน

import { describe, expect, it } from 'vitest';
import { toRecordedCardInput } from '../src/line/recordedView';
import type { SavedEntryView } from '../src/line/recordedView';
import type { BudgetStatus } from '../src/services/budget.service';

const BASE = 'https://example.test';
const ISO = '2026-10-08T12:55:00.000Z';

function status(categoryId: string, name: string, spent: number, limit: number): BudgetStatus {
  return {
    budgetId: `b-${categoryId}`,
    categoryId,
    categoryName: name,
    emoji: null,
    limitSatang: limit,
    spentSatang: spent,
    remainingSatang: limit - spent,
    percentUsed: Math.round((spent / limit) * 1000) / 10,
    level: 'ok',
    alerted80: false,
    alerted100: false,
  };
}

function entry(over: Partial<SavedEntryView> = {}): SavedEntryView {
  return {
    transactionId: 't1',
    type: 'expense',
    categoryName: 'อาหาร',
    title: 'กาแฟเย็น',
    amountSatang: 8000,
    occurredAtIso: ISO,
    budgetStatus: null,
    ...over,
  };
}

describe('toRecordedCardInput — การจัดกลุ่ม', () => {
  it('รายการหมวดเดียวกันรวมอยู่กลุ่มเดียว', () => {
    const out = toRecordedCardInput(
      [
        entry({ transactionId: 't1', title: 'ขนมปัง' }),
        entry({ transactionId: 't2', title: 'ปลากระป๋อง' }),
      ],
      BASE
    );
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0]!.items).toHaveLength(2);
  });

  it('คงลำดับที่เจอครั้งแรกไว้ ผู้ใช้พิมพ์มาเรียงไหนก็เห็นเรียงนั้น', () => {
    const out = toRecordedCardInput(
      [
        entry({ transactionId: 't1', categoryName: 'เครื่องดื่ม' }),
        entry({ transactionId: 't2', categoryName: 'อาหาร' }),
        entry({ transactionId: 't3', categoryName: 'เครื่องดื่ม' }),
      ],
      BASE
    );
    expect(out.groups.map((g) => g.categoryName)).toEqual(['เครื่องดื่ม', 'อาหาร']);
    expect(out.groups[0]!.items).toHaveLength(2);
  });

  it('หมวดชื่อเดียวกันแต่คนละชนิด ต้องแยกกลุ่ม ไม่ใช่ยุบรวม', () => {
    const out = toRecordedCardInput(
      [
        entry({ transactionId: 't1', type: 'expense', categoryName: 'ของขวัญ' }),
        entry({ transactionId: 't2', type: 'income', categoryName: 'ของขวัญ' }),
      ],
      BASE
    );
    expect(out.groups).toHaveLength(2);
    expect(out.groups.map((g) => g.type)).toEqual(['expense', 'income']);
  });

  it('ไม่ระบุหมวดก็ยังมีหัวกลุ่ม ไม่ปล่อยรายการลอย', () => {
    const out = toRecordedCardInput([entry({ categoryName: undefined })], BASE);
    expect(out.groups[0]!.categoryName).toBe('ไม่ระบุหมวด');
  });

  it('ไม่มีชื่อรายการก็ไม่ใส่ title ลงไป (ทางด่วน regex)', () => {
    const out = toRecordedCardInput([entry({ title: undefined })], BASE);
    expect(out.groups[0]!.items[0]!.title).toBeUndefined();
  });
});

describe('toRecordedCardInput — แถบงบ', () => {
  it('หมวดเดียวกันขึ้นแถบเดียว แม้บันทึกหลายรายการ', () => {
    const out = toRecordedCardInput(
      [
        entry({ transactionId: 't1', budgetStatus: status('c1', 'อาหาร', 50000, 400000) }),
        entry({ transactionId: 't2', budgetStatus: status('c1', 'อาหาร', 58000, 400000) }),
      ],
      BASE
    );
    expect(out.budgets).toHaveLength(1);
    // ใช้ค่าของรายการสุดท้าย เพราะเป็นยอดสะสมหลังบันทึกครบแล้ว
    expect(out.budgets[0]!.formattedSpent).toBe('฿580');
  });

  it('คนละหมวดได้คนละแถบ', () => {
    const out = toRecordedCardInput(
      [
        entry({ transactionId: 't1', budgetStatus: status('c1', 'อาหาร', 50000, 400000) }),
        entry({ transactionId: 't2', budgetStatus: status('c2', 'เครื่องดื่ม', 3700, 12000) }),
      ],
      BASE
    );
    expect(out.budgets.map((b) => b.categoryName)).toEqual(['อาหาร', 'เครื่องดื่ม']);
  });

  it('หมวดที่ยังไม่ตั้งงบ ไม่สร้างแถบ', () => {
    const out = toRecordedCardInput([entry({ budgetStatus: null })], BASE);
    expect(out.budgets).toHaveLength(0);
  });

  it('ยอดบนแถบตัดสตางค์ทิ้ง เพราะชื่อหมวดกับยอดอยู่บรรทัดเดียวกัน', () => {
    const out = toRecordedCardInput(
      [entry({ budgetStatus: status('c1', 'อาหาร', 12850050, 15000000) })],
      BASE
    );
    expect(out.budgets[0]!.formattedSpent).toBe('฿128,501');
    expect(out.budgets[0]!.formattedLimit).toBe('฿150,000');
  });
});

describe('toRecordedCardInput — กฎเหล็ก', () => {
  it('⚖️ G7: โอนเข้าแผนออมไม่โผล่ในการ์ดบันทึกรายการ', () => {
    const out = toRecordedCardInput(
      [
        entry({ transactionId: 't1' }),
        entry({ transactionId: 't2', type: 'transfer', title: 'โอนเข้าแผน' }),
      ],
      BASE
    );
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0]!.items).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('โอนเข้าแผน');
  });

  it('⚖️ G3: ยอดที่มีเศษสตางค์ต้องแสดงครบ ห้ามปัดทิ้ง', () => {
    const out = toRecordedCardInput([entry({ amountSatang: 8050 })], BASE);
    expect(out.groups[0]!.items[0]!.formattedAmount).toBe('฿80.50');
  });

  it('ยอดกลมตัด .00 ทิ้ง ให้อ่านไล่หลายบรรทัดง่ายขึ้น', () => {
    const out = toRecordedCardInput([entry({ amountSatang: 8000 })], BASE);
    expect(out.groups[0]!.items[0]!.formattedAmount).toBe('฿80');
  });

  it('มีแต่ transfer ล้วน ได้การ์ดว่างโดยไม่ throw', () => {
    const out = toRecordedCardInput([entry({ type: 'transfer' })], BASE);
    expect(out.groups).toHaveLength(0);
    expect(out.budgets).toHaveLength(0);
  });
});
