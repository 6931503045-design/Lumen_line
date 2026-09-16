// ไฟล์นี้ทำหน้าที่อะไร: test แผนออม (S5.3–S5.6) — สูตร disposable/capacity, 3 ทางเลือก,
//                       cold-start, การยืนยัน และการติดตามความคืบหน้า
// ใครรับผิดชอบ: ③ AI (ไฟล์นี้พิสูจน์ว่าไม่มี AI มาแตะตัวเลขเลย — ทุกค่าคำนวณซ้ำได้)
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G1, G3, G6, G7

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/plans', () => ({
  listPlansByUser: vi.fn(),
  findPlanOwnedByUser: vi.fn(),
  insertDraftPlans: vi.fn(),
  cancelDraftPlans: vi.fn(),
  transitionPlanStatus: vi.fn(),
  listPlanTransferRows: vi.fn(),
}));
vi.mock('../src/db/queries/summary', () => ({
  listPlanningRowsInRange: vi.fn(),
  findFirstTransactionDate: vi.fn(),
}));
vi.mock('../src/db/queries/recurring', () => ({
  listActiveRulesByUser: vi.fn(),
}));

import {
  cancelDraftPlans,
  findPlanOwnedByUser,
  insertDraftPlans,
  listPlansByUser,
  listPlanTransferRows,
  transitionPlanStatus,
} from '../src/db/queries/plans';
import { findFirstTransactionDate, listPlanningRowsInRange } from '../src/db/queries/summary';
import { listActiveRulesByUser } from '../src/db/queries/recurring';
import {
  computePlanProgress,
  confirmPlan,
  createSavingPlan,
  getPlanCapacity,
  listPlansWithProgress,
  PlanError,
} from '../src/services/plan.service';

const USER = 'user-1';
const TODAY = '2026-09-14';

/** แถวรายการแบบที่ listPlanningRowsInRange คืนมาจริง */
function row(
  type: 'income' | 'expense' | 'transfer',
  amount: string,
  options: { source?: string; essential?: boolean } = {}
) {
  return {
    type,
    amount,
    occurred_at: '2026-08-01T03:00:00Z',
    source: options.source ?? 'chat',
    categories: options.essential === undefined ? null : { is_essential: options.essential },
  };
}

function recurringRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    user_id: USER,
    category_id: null,
    label: 'ค่าหอ',
    type: 'expense',
    amount: '4000.00',
    frequency: 'monthly',
    day_of_month: 1,
    day_of_week: null,
    next_run: '2026-10-01',
    end_date: null,
    is_active: true,
    categories: null,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function planRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    title: '⚡ เร็ว — iPhone',
    target_amount: '30000.00',
    target_date: '2027-06-14',
    monthly_save: '3720.00',
    status: 'draft',
    confidence: 'high',
    created_at: '2026-09-14T03:00:00Z',
    confirmed_at: null,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/**
 * สถานการณ์อ้างอิงที่ใช้ตลอดไฟล์นี้ (ข้อมูลครบ 90 วัน = ความมั่นใจสูง):
 *   รายรับ 90 วัน ฿45,000            → avgIncome3M   = ฿15,000
 *   ค่าหอประจำ ฿4,000/เดือน          → recurringTotal = ฿4,000
 *   จำเป็นที่ไม่ใช่ประจำ 90 วัน ฿15,000 → avgEssential  = ฿5,000
 *   รายจ่ายรวม 90 วัน ฿27,000         → avgExpense    = ฿9,000
 *   กันฉุกเฉิน = 9,000 × 0.15 = ฿1,350
 *   disposable = 15,000 − 4,000 − 5,000 − 1,350 = ฿4,650
 *   capacity   = 4,650 × 0.8          = ฿3,720
 */
function useReferenceScenario() {
  vi.mocked(listPlanningRowsInRange).mockResolvedValue([
    row('income', '45000.00'),
    row('expense', '15000.00', { essential: true }),
    row('expense', '12000.00', { essential: false }),
  ]);
  vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-01-01T03:00:00Z');
  vi.mocked(listActiveRulesByUser).mockResolvedValue([recurringRule()]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listPlanningRowsInRange).mockResolvedValue([]);
  vi.mocked(findFirstTransactionDate).mockResolvedValue(null);
  vi.mocked(listActiveRulesByUser).mockResolvedValue([]);
  vi.mocked(listPlansByUser).mockResolvedValue([]);
  vi.mocked(listPlanTransferRows).mockResolvedValue([]);
  vi.mocked(cancelDraftPlans).mockResolvedValue(0);
});

describe('getPlanCapacity — สูตร S5.3 (ความมั่นใจสูง)', () => {
  it('คำนวณ disposable และ capacity ตรงตามสูตรทุกพจน์', async () => {
    useReferenceScenario();

    const capacity = await getPlanCapacity(USER, TODAY);

    expect(capacity.confidence).toBe('high');
    expect(capacity.breakdown).toEqual({
      avgIncomeSatang: 1_500_000,
      recurringTotalSatang: 400_000,
      avgEssentialSatang: 500_000,
      avgExpenseSatang: 900_000,
      emergencyBufferSatang: 135_000,
    });
    expect(capacity.disposableSatang).toBe(465_000);
    expect(capacity.capacitySatang).toBe(372_000);
    expect(capacity.canCreatePlan).toBe(true);
  });

  it('ใช้ช่วงข้อมูล 90 วันที่จบเมื่อวาน ไม่รวมวันนี้', async () => {
    useReferenceScenario();
    await getPlanCapacity(USER, TODAY);
    // [2026-06-16, 2026-09-14) = 90 วันพอดี วันสุดท้ายที่นับคือ 13 ก.ย.
    expect(listPlanningRowsInRange).toHaveBeenCalledWith(USER, '2026-06-16', '2026-09-14');
  });

  it('G7: transfer ไม่ถูกนับเป็นทั้งรายรับและรายจ่าย', async () => {
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([
      row('income', '45000.00'),
      row('transfer', '90000.00'),
      row('expense', '27000.00', { essential: false }),
    ]);
    vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-01-01T03:00:00Z');

    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.breakdown.avgIncomeSatang).toBe(1_500_000);
    expect(capacity.breakdown.avgExpenseSatang).toBe(900_000);
  });

  it('รายจ่ายจำเป็นที่ source=recurring ถูกตัดออกจาก avgEssential (กันนับซ้ำ)', async () => {
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([
      row('income', '45000.00'),
      row('expense', '12000.00', { essential: true, source: 'recurring' }),
      row('expense', '15000.00', { essential: true, source: 'chat' }),
    ]);
    vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-01-01T03:00:00Z');
    vi.mocked(listActiveRulesByUser).mockResolvedValue([recurringRule()]);

    const capacity = await getPlanCapacity(USER, TODAY);
    // เฉพาะ ฿15,000 ที่มาจากแชท ÷ 3 = ฿5,000 (ค่าหอ ฿4,000 อยู่ใน recurringTotal แล้ว)
    expect(capacity.breakdown.avgEssentialSatang).toBe(500_000);
    expect(capacity.breakdown.recurringTotalSatang).toBe(400_000);
    // แต่ avgExpense ยังนับรายจ่ายทั้งหมดรวม recurring ตามนิยาม
    expect(capacity.breakdown.avgExpenseSatang).toBe(900_000);
  });

  it('หัก Σ monthly_save ของแผน active เดิมออกจาก capacity', async () => {
    useReferenceScenario();
    vi.mocked(listPlansByUser).mockResolvedValue([
      planRow({ status: 'active', monthly_save: '1000.00' }),
    ]);

    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.committedSatang).toBe(100_000);
    expect(capacity.capacitySatang).toBe(372_000 - 100_000);
  });
});

describe('getPlanCapacity — เหตุผลที่สร้างแผนไม่ได้', () => {
  it('กฎ 2: มีแผน active ครบ 3 แผนแล้ว', async () => {
    useReferenceScenario();
    vi.mocked(listPlansByUser).mockResolvedValue([
      planRow({ id: 'p1', status: 'active', monthly_save: '100.00' }),
      planRow({ id: 'p2', status: 'active', monthly_save: '100.00' }),
      planRow({ id: 'p3', status: 'active', monthly_save: '100.00' }),
    ]);

    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.canCreatePlan).toBe(false);
    expect(capacity.reason).toContain('สูงสุด 3');
  });

  it('capacity ติดลบเพราะรายจ่ายจำเป็นกินหมด', async () => {
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([
      row('income', '30000.00'),
      row('expense', '33000.00', { essential: true }),
    ]);
    vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-01-01T03:00:00Z');

    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.disposableSatang).toBeLessThan(0);
    expect(capacity.canCreatePlan).toBe(false);
    expect(capacity.reason).toContain('ลดรายจ่ายที่ไม่จำเป็น');
  });

  it('เงินออมถูกแผนเดิมกินหมด → บอกให้ลดแผนเดิมหรือยืดเวลา (S5.3)', async () => {
    useReferenceScenario();
    vi.mocked(listPlansByUser).mockResolvedValue([
      planRow({ status: 'active', monthly_save: '4000.00' }),
    ]);

    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.capacitySatang).toBeLessThanOrEqual(0);
    expect(capacity.reason).toContain('แผนเดิม');
  });
});

describe('getPlanCapacity — cold start (S5.5)', () => {
  it('ข้อมูล < 7 วัน → ความมั่นใจต่ำ ใช้เฉพาะรายการประจำ', async () => {
    vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-09-11T03:00:00Z'); // 3 วัน
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([row('income', '99999.00')]);
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      recurringRule({ id: 'r-in', type: 'income', amount: '15000.00' }),
      recurringRule({ id: 'r-out', type: 'expense', amount: '4000.00' }),
    ]);

    const capacity = await getPlanCapacity(USER, TODAY);

    expect(capacity.confidence).toBe('low');
    expect(capacity.daysOfData).toBe(3);
    // รายรับที่บันทึกไว้ ฿99,999 ต้องถูกมองข้าม เพราะ 3 วันยังเชื่อไม่ได้
    expect(capacity.breakdown.avgIncomeSatang).toBe(1_500_000);
    expect(capacity.breakdown.avgExpenseSatang).toBe(400_000);
  });

  it('ข้อมูล < 7 วัน และไม่มีรายรับประจำ → ยังไม่สร้างแผน ต้องถามรายได้ก่อน', async () => {
    vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-09-13T03:00:00Z');

    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.confidence).toBe('low');
    expect(capacity.canCreatePlan).toBe(false);
    expect(capacity.reason).toContain('รายได้ประจำ');
  });

  it('ข้อมูล 7–89 วัน → ความมั่นใจปานกลาง ยืดรายจ่ายเป็นต่อเดือน', async () => {
    // 2026-08-15 ถึง 2026-09-13 = 30 วัน
    vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-08-15T03:00:00Z');
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([
      row('income', '12000.00'),
      row('expense', '6000.00', { essential: true }),
    ]);

    const capacity = await getPlanCapacity(USER, TODAY);

    expect(capacity.confidence).toBe('medium');
    expect(capacity.daysOfData).toBe(30);
    // ไม่มี recurring รายรับ → ใช้รายรับที่บันทึก ÷ ceil(30/30) = ฿12,000
    expect(capacity.breakdown.avgIncomeSatang).toBe(1_200_000);
    // รายจ่าย ÷ 30 วัน × 30 = ฿6,000
    expect(capacity.breakdown.avgExpenseSatang).toBe(600_000);
  });

  it('ปานกลาง: ถ้ามี recurring รายรับ ให้ใช้ค่านั้นแทนรายรับที่บันทึก', async () => {
    vi.mocked(findFirstTransactionDate).mockResolvedValue('2026-08-15T03:00:00Z');
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([row('income', '3000.00')]);
    vi.mocked(listActiveRulesByUser).mockResolvedValue([
      recurringRule({ type: 'income', amount: '15000.00' }),
    ]);

    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.breakdown.avgIncomeSatang).toBe(1_500_000);
  });

  it('90 วันขึ้นไป → ความมั่นใจสูง', async () => {
    useReferenceScenario();
    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.daysOfData).toBeGreaterThanOrEqual(90);
    expect(capacity.confidence).toBe('high');
  });

  it('ยังไม่มีรายการเลย → daysOfData = 0 ไม่ใช่ NaN', async () => {
    const capacity = await getPlanCapacity(USER, TODAY);
    expect(capacity.daysOfData).toBe(0);
    expect(capacity.confidence).toBe('low');
  });
});

describe('createSavingPlan — 3 ทางเลือกตาม S5.4', () => {
  beforeEach(() => {
    useReferenceScenario();
    vi.mocked(insertDraftPlans).mockImplementation(async (_userId, drafts) =>
      drafts.map((draft, index) => planRow({
        id: `plan-${index}`,
        monthly_save: (draft.monthlySaveSatang / 100).toFixed(2),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any
    );
  });

  it('เร็ว/สมดุล/สบาย ใช้สัดส่วน 1 / 0.6 / 0.35 ของ capacity และปัดลงหลักสิบบาท', async () => {
    const result = await createSavingPlan(USER, 'iPhone', 3_000_000, undefined, TODAY);

    expect(result.options.map((option) => option.monthlySaveSatang)).toEqual([
      372_000, // capacity
      223_000, // 372,000 × 0.6 = 223,200 → ปัดลงหลักสิบบาท
      130_000, // 372,000 × 0.35 = 130,200 → ปัดลงหลักสิบบาท
    ]);
  });

  it('จำนวนเดือน = ceil(เป้า ÷ ยอดออมต่อเดือน)', async () => {
    const result = await createSavingPlan(USER, 'iPhone', 3_000_000, undefined, TODAY);
    expect(result.options.map((option) => option.months)).toEqual([9, 14, 24]);
  });

  it('target_date เลื่อนไปตามจำนวนเดือนของแต่ละทางเลือก', async () => {
    const result = await createSavingPlan(USER, 'iPhone', 3_000_000, undefined, TODAY);
    expect(result.options[0]!.targetDate).toBe('2027-06-14'); // +9 เดือน
    expect(result.options[2]!.targetDate).toBe('2028-09-14'); // +24 เดือน
  });

  it('ผู้ใช้ระบุเวลาแล้วทำไหว → ทางเลือกแรกใช้ยอดตามเป้า ไม่ใช่เต็ม capacity', async () => {
    // ฿30,000 ใน 12 เดือน = ฿2,500/เดือน ซึ่งน้อยกว่า capacity ฿3,720 จึงทำไหว
    const result = await createSavingPlan(USER, 'iPhone', 3_000_000, 12, TODAY);

    expect(result.options[0]!.monthlySaveSatang).toBe(250_000);
    expect(result.options[0]!.title).toContain('ตามเป้า');
    expect(result.requestedMonthsNote).toBeNull();
  });

  it('ผู้ใช้ระบุเวลาแต่ทำไม่ได้ → บอกตรงๆ ว่าเกินกำลัง แล้วยังเสนอ 3 ทางเลือกตามปกติ', async () => {
    // ฿30,000 ใน 3 เดือน = ฿10,000/เดือน เกิน capacity ฿3,720
    const result = await createSavingPlan(USER, 'iPhone', 3_000_000, 3, TODAY);

    expect(result.requestedMonthsNote).toContain('เกินกำลัง');
    expect(result.options).toHaveLength(3);
    expect(result.options[0]!.monthlySaveSatang).toBe(372_000);
  });

  it('ทางเลือกที่ออมได้ต่ำกว่า ฿100/เดือน ถูกซ่อน', async () => {
    // ตั้งให้ capacity = ฿200 พอดี: เร็ว ฿200 / สมดุล ฿120 ยังผ่าน แต่สบาย ฿70 ต้องหายไป
    //   avgIncome ฿10,000 − avgEssential ฿8,478.26 − กันฉุกเฉิน ฿1,271.74 = disposable ฿250
    //   capacity = 250 × 0.8 = ฿200
    vi.mocked(listActiveRulesByUser).mockResolvedValue([]); // ไม่มีรายการประจำในฉากนี้
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([
      row('income', '30000.00'),
      row('expense', '25434.78', { essential: true }),
    ]);

    const result = await createSavingPlan(USER, 'หูฟัง', 300_000, undefined, TODAY);

    expect(result.options.map((option) => option.monthlySaveSatang)).toEqual([20_000, 12_000]);
    expect(result.options.map((option) => option.kind)).toEqual(['fast', 'balanced']);
  });

  it('ออมได้ไม่ถึงเดือนละ ฿100 เลย → ไม่เสนอแผน และไม่เขียน DB', async () => {
    // capacity ฿50: ทุกทางเลือกต่ำกว่า ฿100 หมด
    vi.mocked(listActiveRulesByUser).mockResolvedValue([]);
    vi.mocked(listPlanningRowsInRange).mockResolvedValue([
      row('income', '30000.00'),
      row('expense', '25923.91', { essential: true }),
    ]);

    await expect(createSavingPlan(USER, 'หูฟัง', 300_000, undefined, TODAY))
      .rejects.toMatchObject({ status: 409 });
    expect(insertDraftPlans).not.toHaveBeenCalled();
  });

  it('draft ชุดเก่าถูกยกเลิกก่อนสร้างชุดใหม่', async () => {
    await createSavingPlan(USER, 'iPhone', 3_000_000, undefined, TODAY);
    expect(cancelDraftPlans).toHaveBeenCalledWith(USER);
  });

  it('ทุกทางเลือกถูกบันทึกเป็น draft พร้อมระดับความมั่นใจเดียวกัน', async () => {
    await createSavingPlan(USER, 'iPhone', 3_000_000, undefined, TODAY);
    const drafts = vi.mocked(insertDraftPlans).mock.calls[0]![1];
    expect(drafts).toHaveLength(3);
    for (const draft of drafts) {
      expect(draft.confidence).toBe('high');
      expect(draft.targetSatang).toBe(3_000_000);
    }
  });

  it('สร้างแผนไม่ได้ → โยน PlanError 409 พร้อมเหตุผล ไม่เขียน DB', async () => {
    vi.mocked(listPlansByUser).mockResolvedValue([
      planRow({ id: 'p1', status: 'active', monthly_save: '100.00' }),
      planRow({ id: 'p2', status: 'active', monthly_save: '100.00' }),
      planRow({ id: 'p3', status: 'active', monthly_save: '100.00' }),
    ]);

    await expect(createSavingPlan(USER, 'iPhone', 3_000_000, undefined, TODAY))
      .rejects.toMatchObject({ status: 409 });
    expect(insertDraftPlans).not.toHaveBeenCalled();
    expect(cancelDraftPlans).not.toHaveBeenCalled();
  });

  it('G3: ปฏิเสธเป้าที่ไม่ใช่จำนวนเต็มสตางค์หรือไม่เป็นบวก', async () => {
    await expect(createSavingPlan(USER, 'iPhone', 0, undefined, TODAY))
      .rejects.toBeInstanceOf(PlanError);
    await expect(createSavingPlan(USER, 'iPhone', 100.5, undefined, TODAY))
      .rejects.toBeInstanceOf(PlanError);
  });
});

describe('confirmPlan — ตรวจกฎซ้ำ ณ เวลาที่กด (S5.4)', () => {
  it('ยืนยันได้เมื่อยังอยู่ในกำลัง', async () => {
    useReferenceScenario();
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(planRow({ monthly_save: '3000.00' }));
    vi.mocked(transitionPlanStatus).mockResolvedValue(
      planRow({ status: 'active', confirmed_at: '2026-09-14T03:00:00Z' })
    );

    const plan = await confirmPlan(USER, 'plan-1');
    expect(plan.status).toBe('active');
    expect(transitionPlanStatus).toHaveBeenCalledWith(USER, 'plan-1', 'draft', 'active', true);
  });

  it('🔴 ข้อมูลเปลี่ยนไปจนออมไม่ไหวแล้ว → ปฏิเสธ ไม่ปล่อยให้แผนที่เกินกำลังกลายเป็น active', async () => {
    // capacity ตอนนี้ ฿3,720 แต่แผนที่สร้างไว้ตอนรายรับดีกว่านี้ตั้งไว้ ฿5,000
    useReferenceScenario();
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(planRow({ monthly_save: '5000.00' }));

    await expect(confirmPlan(USER, 'plan-1')).rejects.toMatchObject({ status: 409 });
    expect(transitionPlanStatus).not.toHaveBeenCalled();
  });

  it('กฎ 2: มีแผน active ครบ 3 แล้ว → ยืนยันไม่ได้', async () => {
    useReferenceScenario();
    vi.mocked(listPlansByUser).mockResolvedValue([
      planRow({ id: 'p1', status: 'active', monthly_save: '100.00' }),
      planRow({ id: 'p2', status: 'active', monthly_save: '100.00' }),
      planRow({ id: 'p3', status: 'active', monthly_save: '100.00' }),
    ]);
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(planRow({ monthly_save: '100.00' }));

    await expect(confirmPlan(USER, 'plan-1')).rejects.toMatchObject({ status: 409 });
  });

  it('G6: แผนที่ไม่ใช่ของผู้ใช้ → 404', async () => {
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(null);
    await expect(confirmPlan(USER, 'plan-ของคนอื่น')).rejects.toMatchObject({ status: 404 });
  });

  it('กดยืนยันซ้ำตอนเน็ตช้า → ครั้งที่สองแพ้การแข่งแล้วได้ 409 ไม่ใช่แผนซ้อน', async () => {
    useReferenceScenario();
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(planRow({ monthly_save: '1000.00' }));
    vi.mocked(transitionPlanStatus).mockResolvedValue(null); // อีก request คว้าไปก่อน

    await expect(confirmPlan(USER, 'plan-1')).rejects.toMatchObject({ status: 409 });
  });

  it('แผนที่ active อยู่แล้ว → ยืนยันซ้ำไม่ได้', async () => {
    vi.mocked(findPlanOwnedByUser).mockResolvedValue(planRow({ status: 'active' }));
    await expect(confirmPlan(USER, 'plan-1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('computePlanProgress — S5.6', () => {
  const confirmed = planRow({
    status: 'active',
    confirmed_at: '2026-08-15T00:00:00Z',
    monthly_save: '3000.00',
    target_amount: '30000.00',
  });
  const NOW = new Date('2026-09-14T00:00:00Z'); // 30 วันหลังเริ่ม

  it('เป้าสะสม ณ วันนี้ = monthly_save × (วันนับจาก confirmed_at ÷ 30)', async () => {
    const progress = computePlanProgress(confirmed, 0, NOW);
    expect(progress.daysSinceStart).toBe(30);
    expect(progress.expectedSatang).toBe(300_000);
  });

  it('เป้าสะสมเดินต่อเนื่องตามวัน ไม่กระโดดทีละเดือน', async () => {
    const halfway = computePlanProgress(confirmed, 0, new Date('2026-08-30T00:00:00Z'));
    expect(halfway.daysSinceStart).toBe(15);
    expect(halfway.expectedSatang).toBe(150_000);
  });

  it('ออมได้ต่ำกว่าเป้า × 0.9 และผ่านมา ≥ 14 วัน → หลุดเป้า', async () => {
    const progress = computePlanProgress(confirmed, 200_000, NOW); // 200,000 < 300,000 × 0.9
    expect(progress.offTrack).toBe(true);
  });

  it('ออมได้เกินเป้า × 0.9 → ยังไม่หลุดเป้า', async () => {
    const progress = computePlanProgress(confirmed, 280_000, NOW); // ≥ 270,000
    expect(progress.offTrack).toBe(false);
  });

  it('เพิ่งเริ่มไม่ถึง 14 วัน → ยังไม่เตือนว่าหลุดเป้า', async () => {
    const progress = computePlanProgress(confirmed, 0, new Date('2026-08-25T00:00:00Z'));
    expect(progress.daysSinceStart).toBe(10);
    expect(progress.offTrack).toBe(false);
  });

  it('ครบเป้าแล้ว → reachedTarget และไม่นับว่าหลุดเป้า', async () => {
    const progress = computePlanProgress(confirmed, 3_000_000, NOW);
    expect(progress.reachedTarget).toBe(true);
    expect(progress.offTrack).toBe(false);
    expect(progress.remainingSatang).toBe(0);
  });

  it('แผน draft ที่ยังไม่ยืนยัน → เป้าสะสม 0 และไม่หลุดเป้า', async () => {
    const progress = computePlanProgress(planRow(), 0, NOW);
    expect(progress.expectedSatang).toBe(0);
    expect(progress.offTrack).toBe(false);
  });
});

describe('listPlansWithProgress — G7 ความคืบหน้ามาจาก transfer เท่านั้น', () => {
  it('รวมยอดโอนของแต่ละแผนแยกกันถูกต้อง', async () => {
    vi.mocked(listPlansByUser).mockResolvedValue([
      planRow({ id: 'plan-a', status: 'active', confirmed_at: '2026-09-01T00:00:00Z' }),
      planRow({ id: 'plan-b', status: 'active', confirmed_at: '2026-09-01T00:00:00Z' }),
    ]);
    vi.mocked(listPlanTransferRows).mockResolvedValue([
      { plan_id: 'plan-a', amount: '1000.00' },
      { plan_id: 'plan-a', amount: '500.50' },
      { plan_id: 'plan-b', amount: '2000.00' },
    ]);

    const progress = await listPlansWithProgress(USER);
    const byId = new Map(progress.map((item) => [item.planId, item]));
    expect(byId.get('plan-a')!.savedSatang).toBe(150_050);
    expect(byId.get('plan-b')!.savedSatang).toBe(200_000);
  });

  it('แผนที่ยังไม่มีการโอนเลย → 0 ไม่ใช่ undefined', async () => {
    vi.mocked(listPlansByUser).mockResolvedValue([planRow()]);
    const progress = await listPlansWithProgress(USER);
    expect(progress[0]!.savedSatang).toBe(0);
    expect(progress[0]!.percentComplete).toBe(0);
  });
});
