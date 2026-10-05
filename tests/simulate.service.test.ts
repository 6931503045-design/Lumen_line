// ไฟล์นี้ทำหน้าที่อะไร: test การจำลองผลกระทบก่อนซื้อ (S5.7 / FR-15)
// ใครรับผิดชอบ: ③ Backend
// เขียนในสัปดาห์: W7
// ⚖️ กฎเหล็ก G1, G3
//
// mock สอง service ที่เป็นแหล่งข้อมูลทิ้ง เพราะสิ่งที่ต้องพิสูจน์คือ "คิดเลขถูกไหม"
// และ "ตัดสินใจถูกจังหวะไหม" ไม่ใช่ "อ่าน DB ได้ไหม"

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/budget.service', () => ({
  getBudgetOverview: vi.fn(),
}));
vi.mock('../src/services/plan.service', () => ({
  getPlanCapacity: vi.fn(),
}));

import { getBudgetOverview } from '../src/services/budget.service';
import { getPlanCapacity } from '../src/services/plan.service';
import { simulatePurchase, SimulateError } from '../src/services/simulate.service';

const USER = 'user-1';
/** 14 ก.ย. 2026 — เดือน 30 วัน เหลือ 30 − 14 + 1 = 17 วัน */
const TODAY = '2026-09-14';

/** งบรวม 10,000 บาท ใช้ไป 4,000 → เหลือ 6,000 */
function budget(totalLimitSatang: number, totalSpentSatang: number) {
  vi.mocked(getBudgetOverview).mockResolvedValue({
    month: '2026-09-01',
    items: [],
    totalLimitSatang,
    totalSpentSatang,
  } as never);
}

function capacity(capacitySatang: number) {
  vi.mocked(getPlanCapacity).mockResolvedValue({ capacitySatang } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  capacity(200_000); // ออมไหวเดือนละ 2,000 บาท
});

describe('simulatePurchase — ทางปกติ', () => {
  it('ซื้อของถูกเทียบกับงบที่เหลือ → ok พร้อมยอดใช้ได้ต่อวันก่อน/หลัง', async () => {
    budget(1_000_000, 400_000); // เหลือ 6,000 บาท

    const result = await simulatePurchase(USER, 50_000, TODAY); // ซื้อ 500 บาท

    expect(result.hasBudget).toBe(true);
    expect(result.budgetLeftSatang).toBe(600_000);
    expect(result.afterBuySatang).toBe(550_000);
    expect(result.daysLeft).toBe(17);
    // 600,000 ÷ 17 = 35,294.11… → ปัดลงเป็น 35,294
    expect(result.perDayBeforeSatang).toBe(35_294);
    expect(result.perDayAfterSatang).toBe(32_352);
    expect(result.overBySatang).toBe(0);
    expect(result.tone).toBe('ok');
  });

  it('ราคาเกินครึ่งของงบที่เหลือ แต่ยังไม่เกินงบ → warn', async () => {
    budget(1_000_000, 400_000); // เหลือ 6,000

    const result = await simulatePurchase(USER, 400_000, TODAY); // 4,000 > 3,000

    expect(result.tone).toBe('warn');
    expect(result.overBySatang).toBe(0);
  });

  it('ราคาเท่ากับงบที่เหลือพอดี → warn (งบหมดพอดี ไม่เหลือใช้รายวัน)', async () => {
    budget(1_000_000, 400_000);

    const result = await simulatePurchase(USER, 600_000, TODAY);

    expect(result.afterBuySatang).toBe(0);
    expect(result.perDayAfterSatang).toBe(0);
    expect(result.tone).toBe('warn');
  });

  it('ราคาเกินงบที่เหลือ → over พร้อมบอกว่าเกินไปเท่าไหร่', async () => {
    budget(1_000_000, 400_000); // เหลือ 6,000

    const result = await simulatePurchase(USER, 1_000_000, TODAY); // 10,000

    expect(result.tone).toBe('over');
    expect(result.overBySatang).toBe(400_000); // เกินไป 4,000
    expect(result.afterBuySatang).toBe(-400_000);
    expect(result.perDayAfterSatang).toBe(0); // ติดลบไม่แสดงเป็นยอดใช้ได้
  });

  it('ออมกี่เดือนถึงซื้อได้ ปัดขึ้นเสมอ', async () => {
    budget(1_000_000, 400_000);
    capacity(200_000); // 2,000/เดือน

    const result = await simulatePurchase(USER, 2_500_000, TODAY); // 25,000

    expect(result.monthlyCapacitySatang).toBe(200_000);
    expect(result.monthsToSave).toBe(13); // 25,000 ÷ 2,000 = 12.5 → 13
  });
});

describe('simulatePurchase — ทางที่ผิด', () => {
  it('🔴 ยังไม่เคยตั้งงบสักหมวด → hasBudget:false และไม่ตัดสินอะไรเลย', async () => {
    budget(0, 0);

    const result = await simulatePurchase(USER, 50_000, TODAY);

    expect(result.hasBudget).toBe(false);
    expect(result.tone).toBe('unknown');
    // สำคัญ: ต้องไม่ตอบว่า "เกินงบ" ทั้งที่ระบบไม่รู้งบของผู้ใช้เลย
    expect(result.overBySatang).toBe(0);
    expect(result.budgetLeftSatang).toBe(0);
  });

  it('ยังไม่ตั้งงบ แต่ยังบอกได้ว่าออมกี่เดือนถึงซื้อได้ (มาจากพฤติกรรม ไม่ใช่งบ)', async () => {
    budget(0, 0);
    capacity(100_000); // 1,000/เดือน

    const result = await simulatePurchase(USER, 500_000, TODAY);

    expect(result.hasBudget).toBe(false);
    expect(result.monthsToSave).toBe(5);
  });

  it('ใช้เกินงบไปแล้วก่อนซื้อ → งบที่เหลือติดลบ ยอดต่อวันเป็น 0', async () => {
    budget(1_000_000, 1_200_000); // ใช้ไป 12,000 จากงบ 10,000

    const result = await simulatePurchase(USER, 50_000, TODAY);

    expect(result.budgetLeftSatang).toBe(-200_000);
    expect(result.perDayBeforeSatang).toBe(0);
    expect(result.tone).toBe('over');
    // เกินเท่ากับราคาเต็ม เพราะงบที่เหลือถือเป็น 0 ไม่ใช่ค่าติดลบ
    expect(result.overBySatang).toBe(50_000);
  });

  it('วันสุดท้ายของเดือน → หารด้วย 1 ไม่ใช่หารด้วย 0', async () => {
    budget(1_000_000, 400_000);

    const result = await simulatePurchase(USER, 50_000, '2026-09-30');

    expect(result.daysLeft).toBe(1);
    expect(result.perDayBeforeSatang).toBe(600_000);
    expect(Number.isFinite(result.perDayAfterSatang)).toBe(true);
  });

  it('ออมไม่ไหวเลย (capacity ≤ 0) → monthsToSave เป็น null ไม่ใช่ Infinity', async () => {
    budget(1_000_000, 400_000);
    capacity(0);

    const result = await simulatePurchase(USER, 50_000, TODAY);

    expect(result.monthsToSave).toBeNull();
  });

  it('capacity ติดลบ (รายจ่ายกินรายรับหมด) → monthsToSave เป็น null', async () => {
    budget(1_000_000, 400_000);
    capacity(-50_000);

    const result = await simulatePurchase(USER, 50_000, TODAY);

    expect(result.monthsToSave).toBeNull();
  });

  it('⚖️ G3 ราคาเป็น 0 → ปฏิเสธ', async () => {
    budget(1_000_000, 400_000);
    await expect(simulatePurchase(USER, 0, TODAY)).rejects.toThrow(/มากกว่า 0/);
  });

  it('⚖️ G3 ราคาติดลบ → ปฏิเสธ', async () => {
    budget(1_000_000, 400_000);
    await expect(simulatePurchase(USER, -100, TODAY)).rejects.toThrow(SimulateError);
  });

  it('⚖️ G3 ราคาไม่ใช่จำนวนเต็ม (บาททศนิยมที่ยังไม่แปลง) → ปฏิเสธ', async () => {
    budget(1_000_000, 400_000);
    await expect(simulatePurchase(USER, 80.5, TODAY)).rejects.toThrow(/จำนวนเต็ม/);
  });

  it('ไม่ส่งราคามาเลย → ปฏิเสธ ไม่ใช่คิดเป็น 0', async () => {
    budget(1_000_000, 400_000);
    await expect(simulatePurchase(USER, undefined, TODAY)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('ราคาเป็นข้อความ → ปฏิเสธ', async () => {
    budget(1_000_000, 400_000);
    await expect(simulatePurchase(USER, 'แพงมาก', TODAY)).rejects.toThrow(SimulateError);
  });
});

describe('simulatePurchase — ⚖️ G1 ความคงเส้นคงวา', () => {
  it('เรียกซ้ำด้วยข้อมูลเดิม ได้ผลเหมือนเดิมทุกครั้ง', async () => {
    budget(1_000_000, 400_000);

    const runs = await Promise.all(
      Array.from({ length: 5 }, () => simulatePurchase(USER, 123_456, TODAY))
    );

    runs.forEach((run) => expect(run).toEqual(runs[0]));
  });

  it('⚖️ G6 ส่ง userId ที่ได้จาก session ลงไปทุก service', async () => {
    budget(1_000_000, 400_000);

    await simulatePurchase(USER, 50_000, TODAY);

    expect(getBudgetOverview).toHaveBeenCalledWith(USER, '2026-09-01');
    expect(getPlanCapacity).toHaveBeenCalledWith(USER, TODAY);
  });
});
