// ไฟล์นี้ทำหน้าที่อะไร: test คำสั่งตายตัวในแชท (S1) และ S5.2 ใช้ได้วันละเท่าไหร่
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W2
// ⚖️ กฎเหล็ก G1, G4

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/supabase', () => ({ supabase: {} }));
vi.mock('../src/services/summary.service', () => ({
  getUserSummary: vi.fn(),
  getSafeToSpend: vi.fn(),
}));
vi.mock('../src/services/budget.service', () => ({ getBudgetOverview: vi.fn() }));
vi.mock('../src/services/plan.service', () => ({
  listPlansWithProgress: vi.fn(),
  transferToPlan: vi.fn(),
}));
vi.mock('../src/db/queries/transactions', () => ({
  findLatestChatTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
}));

import { getSafeToSpend, getUserSummary } from '../src/services/summary.service';
import { getBudgetOverview } from '../src/services/budget.service';
import { listPlansWithProgress, transferToPlan } from '../src/services/plan.service';
import {
  findLatestChatTransaction,
  softDeleteTransaction,
} from '../src/db/queries/transactions';
import {
  matchCommand,
  matchSaveCommand,
  runCommand,
  runSaveCommand,
  runUndoLatest,
} from '../src/services/command.service';

const USER = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getUserSummary).mockResolvedValue({
    monthIncomeSatang: 0,
    monthExpenseSatang: 13100,
    netBalanceSatang: -13100,
    transactionCount: 3,
    expenseByCategory: [{ categoryId: 'c1', name: 'กาแฟ', amountSatang: 13000 }],
    monthlyTrend: [],
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getSafeToSpend).mockResolvedValue({
    monthRemainingSatang: 140000,
    perDaySatang: 10000,
    daysLeft: 14,
    overspentSatang: 0,
    breakdown: {
      monthIncomeSatang: 1500000,
      upcomingIncomeSatang: 0,
      monthExpenseSatang: 13100,
      upcomingExpenseSatang: 0,
      planCommitmentSatang: 300000,
    },
  } as any);
  vi.mocked(listPlansWithProgress).mockResolvedValue([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getBudgetOverview).mockResolvedValue({
    month: '2026-09-01', items: [], totalLimitSatang: 0, totalSpentSatang: 0,
  } as any);
});

describe('matchCommand — ต้องตรงทั้งข้อความ (SPEC §S1)', () => {
  it('จับคำสั่งที่พิมพ์ตรงเป๊ะ', () => {
    expect(matchCommand('สรุป')).toBe('summary');
    expect(matchCommand('เหลือ')).toBe('remaining');
    expect(matchCommand('แผน')).toBe('plans');
    expect(matchCommand('งบ')).toBe('budget');
    expect(matchCommand('ช่วยเหลือ')).toBe('help');
  });

  it('ตัดช่องว่างหัวท้ายให้', () => {
    expect(matchCommand('  สรุป  ')).toBe('summary');
  });

  it('🔴 ไม่จับคำสั่งที่ฝังอยู่ในประโยค — ไม่งั้นบันทึกเงินไม่ได้', () => {
    // ถ้าใช้ includes() ข้อความพวกนี้จะกลายเป็นคำสั่งแทนที่จะเป็นการบันทึกเงิน
    expect(matchCommand('จ่ายค่าสรุปโครงการ 200')).toBeNull();
    expect(matchCommand('ค่างบการเงิน 500')).toBeNull();
    expect(matchCommand('เหลือเงินเท่าไหร่')).toBeNull();
  });
});

describe('runCommand — ข้อความตอบกลับ', () => {
  it('สรุป: แสดงรายรับ รายจ่าย ส่วนต่าง และหมวดที่จ่ายมากสุด', async () => {
    const text = await runCommand(USER, 'summary');
    expect(text).toContain('฿131.00');
    expect(text).toContain('กาแฟ');
    expect(text).toContain('จ่ายมากสุด');
  });

  it('สรุป: ผู้ใช้ใหม่ที่ยังไม่มีรายการ → ชวนให้ลองพิมพ์', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getUserSummary).mockResolvedValue({
      monthIncomeSatang: 0, monthExpenseSatang: 0, netBalanceSatang: 0,
      transactionCount: 0, expenseByCategory: [], monthlyTrend: [],
    } as any);
    expect(await runCommand(USER, 'summary')).toContain('กาแฟ 80');
  });

  it('เหลือ: บอกยอดต่อวันและจำนวนวันที่เหลือ', async () => {
    const text = await runCommand(USER, 'remaining');
    expect(text).toContain('฿100.00');
    expect(text).toContain('14 วัน');
    expect(text).toContain('แผนออม'); // กันไว้ให้แผนแล้ว
  });

  it('🔴 เหลือ: ใช้เกินแล้วต้องเตือนพร้อมบอกว่าเกินเท่าไหร่ (S5.2)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSafeToSpend).mockResolvedValue({
      monthRemainingSatang: -50000, perDaySatang: 0, daysLeft: 10,
      overspentSatang: 50000,
      breakdown: { monthIncomeSatang: 0, upcomingIncomeSatang: 0,
        monthExpenseSatang: 50000, upcomingExpenseSatang: 0, planCommitmentSatang: 0 },
    } as any);
    const text = await runCommand(USER, 'remaining');
    expect(text).toContain('ใช้เกินแล้ว');
    expect(text).toContain('฿500.00');
  });

  it('เหลือ: มี disclaimer ตาม SPEC', async () => {
    expect(await runCommand(USER, 'remaining')).toContain('ไม่ใช่คำแนะนำทางการเงิน');
  });

  it('แผน: ไม่มีแผน → บอกวิธีสร้าง', async () => {
    expect(await runCommand(USER, 'plans')).toContain('ยังไม่มีแผนออม');
  });

  it('แผน: แสดงเฉพาะแผนที่ active ไม่เอา draft มาปน', async () => {
    vi.mocked(listPlansWithProgress).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { planId: 'p1', title: 'iPhone', status: 'active', savedSatang: 150000,
        targetSatang: 3000000, percentComplete: 5, monthlySaveSatang: 300000,
        offTrack: false } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { planId: 'p2', title: 'ร่างที่ไม่ได้เลือก', status: 'draft' } as any,
    ]);
    const text = await runCommand(USER, 'plans');
    expect(text).toContain('iPhone');
    expect(text).not.toContain('ร่างที่ไม่ได้เลือก');
  });

  it('งบ: ยังไม่ตั้ง → บอกว่าตั้งที่ไหน', async () => {
    expect(await runCommand(USER, 'budget')).toContain('ยังไม่ได้ตั้งงบ');
  });

  it('งบ: แสดงสีตามระดับที่ใช้ไป', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getBudgetOverview).mockResolvedValue({
      month: '2026-09-01',
      items: [
        { categoryName: 'อาหาร', emoji: '🍜', percentUsed: 120, level: 'over',
          spentSatang: 360000, limitSatang: 300000 },
        { categoryName: 'เดินทาง', emoji: '🚗', percentUsed: 50, level: 'ok',
          spentSatang: 50000, limitSatang: 100000 },
      ],
      totalLimitSatang: 400000, totalSpentSatang: 410000,
    } as any);
    const text = await runCommand(USER, 'budget');
    expect(text).toContain('🔴');
    expect(text).toContain('🟢');
  });

  it('ช่วยเหลือ: บอกทั้งวิธีบันทึกและรายการคำสั่ง', async () => {
    const text = await runCommand(USER, 'help');
    expect(text).toContain('กาแฟ 80');
    expect(text).toContain('สรุป');
    expect(text).toContain('เหลือ');
  });
});

describe('matchSaveCommand — `ออม <จำนวน>` ใช้ regex (SPEC §S1)', () => {
  it('อ่านจำนวนเป็นสตางค์', () => {
    expect(matchSaveCommand('ออม 2000')?.amountSatang).toBe(200000);
  });

  it('รองรับเลขไทยและตัวย่อเหมือนตอนบันทึกเงิน', () => {
    expect(matchSaveCommand('ออม สองพัน')?.amountSatang).toBe(200000);
    expect(matchSaveCommand('ออม 1.5k')?.amountSatang).toBe(150000);
  });

  it('ไม่ใช่คำสั่งนี้ → null', () => {
    expect(matchSaveCommand('ออมเงิน')).toBeNull();
    expect(matchSaveCommand('สรุป')).toBeNull();
  });

  it('อ่านจำนวนไม่ออก → amountSatang เป็น null (ไม่เดา)', () => {
    expect(matchSaveCommand('ออม เท่าไหร่ก็ได้')?.amountSatang).toBeNull();
  });
});

describe('runSaveCommand', () => {
  it('ไม่มีแผน active → แนะนำให้สร้างก่อน ไม่โอน', async () => {
    const result = await runSaveCommand(USER, 200000);
    expect(result.kind).toBe('no-plan');
    expect(transferToPlan).not.toHaveBeenCalled();
  });

  it('จำนวนเงินอ่านไม่ออก → บอกวิธีพิมพ์ ไม่โอน', async () => {
    const result = await runSaveCommand(USER, null);
    expect(result.kind).toBe('bad-amount');
    expect(transferToPlan).not.toHaveBeenCalled();
  });

  it('มีแผนเดียว → โอนเข้าแผนนั้นเลย', async () => {
    vi.mocked(listPlansWithProgress).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { planId: 'p1', title: 'iPhone', status: 'active' } as any,
    ]);
    vi.mocked(transferToPlan).mockResolvedValue({
      transactionId: 'tx-1',
      justCompleted: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress: { savedSatang: 200000, targetSatang: 3000000, percentComplete: 6.7 } as any,
    });

    const result = await runSaveCommand(USER, 200000);
    expect(result.kind).toBe('transferred');
    expect(transferToPlan).toHaveBeenCalledWith(USER, 'p1', 200000);
  });

  it('มีหลายแผน → ให้เลือก ไม่โอนเอง', async () => {
    vi.mocked(listPlansWithProgress).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { planId: 'p1', title: 'iPhone', status: 'active' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { planId: 'p2', title: 'เที่ยวญี่ปุ่น', status: 'active' } as any,
    ]);

    const result = await runSaveCommand(USER, 200000);
    expect(result.kind).toBe('choose');
    expect(transferToPlan).not.toHaveBeenCalled();
    if (result.kind === 'choose') {
      expect(result.plans).toHaveLength(2);
      expect(result.amountSatang).toBe(200000);
    }
  });
});

describe('runUndoLatest — คำสั่ง `ยกเลิก`', () => {
  it('ไม่มีรายการที่พิมพ์เองใน 24 ชม. → บอกตรงๆ ไม่ลบอะไร', async () => {
    vi.mocked(findLatestChatTransaction).mockResolvedValue(null);
    const result = await runUndoLatest(USER);
    expect(result.ok).toBe(false);
    expect(softDeleteTransaction).not.toHaveBeenCalled();
  });

  it('ลบรายการล่าสุดแล้วคืน id ไว้ทำปุ่มเอากลับคืน', async () => {
    vi.mocked(findLatestChatTransaction).mockResolvedValue({
      id: 'tx-1', amount: '80.00', type: 'expense', note: 'กาแฟ',
    });
    vi.mocked(softDeleteTransaction).mockResolvedValue(true);

    const result = await runUndoLatest(USER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transactionId).toBe('tx-1');
      expect(result.text).toContain('กาแฟ');
      expect(result.text).toContain('฿80.00');
    }
  });

  it('🔴 หาเฉพาะรายการ source=chat — ไม่ไปลบรายการจากอีเมลหรือรายการประจำ', async () => {
    vi.mocked(findLatestChatTransaction).mockResolvedValue(null);
    await runUndoLatest(USER);
    // ชั้น query เป็นคนกรอง source เอง ที่นี่ยืนยันว่าเรียกตัวที่กรองแล้ว
    expect(findLatestChatTransaction).toHaveBeenCalledWith(USER, expect.any(String));
  });

  it('รายการถูกลบไปแล้วระหว่างทาง → บอกว่ายกเลิกไปแล้ว', async () => {
    vi.mocked(findLatestChatTransaction).mockResolvedValue({
      id: 'tx-1', amount: '80.00', type: 'expense', note: null,
    });
    vi.mocked(softDeleteTransaction).mockResolvedValue(false);
    const result = await runUndoLatest(USER);
    expect(result.ok).toBe(false);
  });
});
