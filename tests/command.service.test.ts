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
vi.mock('../src/services/spendingLimit.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/spendingLimit.service')>()),
  getDailyAllowance: vi.fn(),
  getWeeklyAllowance: vi.fn(),
  getMonthlyAllowance: vi.fn(),
  getSpendingLimits: vi.fn(),
}));
vi.mock('../src/services/recurring.service', () => ({ listRecurringRules: vi.fn() }));

import { getSafeToSpend, getUserSummary } from '../src/services/summary.service';
import {
  defaultSpendingLimits,
  getDailyAllowance,
  getMonthlyAllowance,
  getSpendingLimits,
  getWeeklyAllowance,
  type PeriodAllowance,
} from '../src/services/spendingLimit.service';
import { listRecurringRules } from '../src/services/recurring.service';
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

/** ผู้ใช้ไม่ได้เปิดเพดานของช่วงนั้น */
const NO_LIMIT: PeriodAllowance = {
  enabled: false,
  available: true,
  mode: 'system',
  profile: 'moderate',
  ceilingSatang: 0,
  spentSatang: 0,
  remainingSatang: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  // ค่าเริ่มต้น: ผู้ใช้ไม่ได้ตั้งเพดานรายวัน → "เหลือ" ใช้สูตร S5.2 เดิม
  vi.mocked(getDailyAllowance).mockResolvedValue(null);
  vi.mocked(getSpendingLimits).mockResolvedValue(defaultSpendingLimits());
  vi.mocked(getWeeklyAllowance).mockResolvedValue(NO_LIMIT);
  vi.mocked(getMonthlyAllowance).mockResolvedValue(NO_LIMIT);
  vi.mocked(listRecurringRules).mockResolvedValue([]);
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
    expect(matchCommand('อยากรู้ว่าเหลือเงินเท่าไหร่')).toBeNull();
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

  it('🔴 เหลือ: ติดลบเพราะรายจ่ายประจำ/แผนออม ต้องไม่บอกว่า "ใช้เกิน" และต้องตอบยอดวันนี้ก่อน', async () => {
    // ผู้ใช้ทดสอบถาม "วันนี้เหลือเงินเท่าไหร่" แล้วได้ "ใช้เกินแล้ว" ทั้งที่ยังใช้ไม่ถึงรายรับ
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSafeToSpend).mockResolvedValue({
      monthRemainingSatang: -20000, perDaySatang: 0, daysLeft: 10,
      overspentSatang: 20000,
      breakdown: { monthIncomeSatang: 500000, upcomingIncomeSatang: 0,
        monthExpenseSatang: 300000, upcomingExpenseSatang: 150000, planCommitmentSatang: 70000 },
    } as any);
    const text = await runCommand(USER, 'remaining');
    expect(text.split('\n')[0]).toBe('💸 วันนี้ใช้ได้อีก ฿0.00');
    expect(text).not.toContain('ใช้เกินแล้ว');
    expect(text).toContain('ไม่พอสำหรับรายจ่ายที่รออยู่');
    expect(text).toContain('รายจ่ายประจำที่ยังไม่ถึงรอบ ฿1,500.00');
    expect(text).toContain('กันไว้ให้แผนออม ฿700.00');
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

describe('คำถามเรื่องเงินเหลือ — ต้องเข้า L0 ไม่ต้องรอ AI', () => {
  // ตอนส่ง prototype ผู้ใช้พิมพ์ "เงินวันนี้เหลือเท่าไหร่" แล้วตกไปถึง AI
  // ซึ่งเลือก tool ผิดเป็นสรุปเดือน แล้วตอบยอดรายรับ-รายจ่ายกลับมาแทน
  it('ประโยคที่ผู้ใช้พิมพ์จริง ต้องจับเป็นคำสั่ง remaining', () => {
    const asked = [
      'เหลือเท่าไหร่',
      'เหลือเท่าไร',
      'เงินเหลือเท่าไหร่',
      'เงินวันนี้เหลือเท่าไหร่',
      'วันนี้เหลือเท่าไหร่',
      'วันนี้ใช้ได้เท่าไหร่',
      'ใช้ได้เท่าไหร่',
      'ใช้ได้วันละเท่าไหร่',
      // ประโยคที่ผู้ใช้ทดสอบพิมพ์แล้วหลุดไปถึง AI
      'วันนี้เหลือเงินเท่าไหร่',
      'วันนี้เหลือเงินเท่าไหร่ครับ',
      'เหลือเท่าไหร่คะ',
      'เหลือ เท่าไร?',
      'วันนี้ใช้ได้อีกเท่าไหร่นะ',
    ];
    for (const text of asked) {
      expect(matchCommand(text)).toBe('remaining');
    }
  });

  it('คำสั่งเดิมยังใช้ได้เหมือนเดิม', () => {
    expect(matchCommand('เหลือ')).toBe('remaining');
  });

  it('🔴 ยังต้องไม่ชนกับการบันทึกเงิน — ข้อความที่มีจำนวนเงินต้องไม่ถูกมองเป็นคำสั่ง', () => {
    // คำที่เพิ่มเข้ามาไม่มีตัวเลขเลย จึงไม่มีทางชนกับทางด่วน L1 ที่ต้องมียอดเสมอ
    expect(matchCommand('เหลือเท่าไหร่ 80')).toBeNull();
    expect(matchCommand('ค่าขนมเหลือเท่าไหร่ 50')).toBeNull();
    expect(matchCommand('จ่ายค่าสรุปโครงการ 200')).toBeNull();
  });

  it('ยังจับแบบตรงทั้งข้อความ ไม่ใช่ includes()', () => {
    expect(matchCommand('อยากรู้ว่าเงินเหลือเท่าไหร่')).toBeNull();
    expect(matchCommand('งบอาหารเหลือเท่าไหร่ครับ')).toBeNull();
  });

  it('ตัดคำสุภาพ ช่องว่าง และเครื่องหมายคำถามท้ายประโยคก่อนเทียบ', () => {
    expect(matchCommand('เหลือเท่าไหร่ครับ')).toBe('remaining');
    expect(matchCommand('สรุปครับ')).toBe('summary');
    expect(matchCommand('งบ?')).toBe('budget');
  });
});

describe('คำตอบของ remaining — ต้องบอกชัดว่าเลขไหนคือคำตอบ', () => {
  it('ขึ้นต้นด้วยยอดที่ใช้ได้วันนี้ และบอกที่มาของการคำนวณ', async () => {
    vi.mocked(getSafeToSpend).mockResolvedValue({
      monthRemainingSatang: 336000,
      perDaySatang: 24000,
      daysLeft: 14,
      overspentSatang: 0,
      breakdown: {
        monthIncomeSatang: 0,
        upcomingIncomeSatang: 0,
        monthExpenseSatang: 0,
        upcomingExpenseSatang: 0,
        planCommitmentSatang: 0,
      },
    });

    const text = await runCommand(USER, 'remaining');

    // บรรทัดแรกต้องเป็นคำตอบ ไม่ใช่ยอดรวมทั้งเดือน
    expect(text.split('\n')[0]).toContain('฿240.00');
    expect(text).toContain('คิดมาจาก');
    expect(text).toContain('฿3,360.00');
    expect(text).toContain('14 วัน');
  });

  it('ใช้เกินงบแล้ว ต้องเตือนทันที ไม่ใช่โชว์ 0', async () => {
    vi.mocked(getSafeToSpend).mockResolvedValue({
      monthRemainingSatang: -50000,
      perDaySatang: 0,
      daysLeft: 9,
      overspentSatang: 50000,
      breakdown: {
        monthIncomeSatang: 0,
        upcomingIncomeSatang: 0,
        monthExpenseSatang: 50000,
        upcomingExpenseSatang: 0,
        planCommitmentSatang: 0,
      },
    });

    const text = await runCommand(USER, 'remaining');
    expect(text).toContain('ใช้เกิน');
    expect(text).toContain('฿500.00');
  });
});

// ผู้ใช้ทดสอบถาม "พรุ่งนี้จะใช้เงินได้กี่บาท" แล้วได้ยอดของวันนี้กลับไป
describe('พรุ่งนี้ใช้ได้เท่าไหร่ (remaining_tomorrow)', () => {
  it.each([
    'พรุ่งนี้ใช้ได้เท่าไหร่',
    'พรุ่งนี้จะใช้เงินได้กี่บาท',
    'พรุ่งนี้ใช้เงินได้เท่าไรครับ',
    'พรุ่งนี้เหลือเงินเท่าไหร่',
  ])('"%s" → remaining_tomorrow', (text) => {
    expect(matchCommand(text)).toBe('remaining_tomorrow');
  });

  it('คำถามของวันนี้ยังได้ remaining เหมือนเดิม ไม่ถูกแย่งไป', () => {
    expect(matchCommand('วันนี้จะใช้เงินได้อีกกี่บาท')).toBe('remaining');
  });

  it('⚖️ G1: ให้ S5.2 คิดด้วยวันที่ของพรุ่งนี้ ไม่คิดเลขเอง', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T10:00:00+07:00'));
    try {
      const text = await runCommand(USER, 'remaining_tomorrow');
      expect(getSafeToSpend).toHaveBeenCalledWith(USER, '2026-10-13');
      expect(text).toContain('พรุ่งนี้ใช้ได้');
      expect(text).toContain('ถ้าวันนี้ไม่ใช้เพิ่มแล้ว');
    } finally {
      vi.useRealTimers();
    }
  });

  it('🔴 พรุ่งนี้ ฿0 เพราะเงินขาด ต้องบอกที่มาในคำตอบเดียว ไม่ใช่ให้ไปพิมพ์ "เหลือ" ต่อ', async () => {
    // ผู้ใช้ทดสอบได้ "พรุ่งนี้ ฿0 เงินขาด" แล้วถามว่าเกิดอะไรขึ้น
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T10:00:00+07:00'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSafeToSpend).mockResolvedValue({
      monthRemainingSatang: -30000, perDaySatang: 0, daysLeft: 19,
      overspentSatang: 30000,
      breakdown: { monthIncomeSatang: 500000, upcomingIncomeSatang: 0,
        monthExpenseSatang: 380000, upcomingExpenseSatang: 150000, planCommitmentSatang: 0 },
    } as any);
    try {
      const text = await runCommand(USER, 'remaining_tomorrow');
      expect(text.split('\n')[0]).toBe('💸 พรุ่งนี้ใช้ได้ ฿0.00');
      expect(text).toContain('ขาดอยู่ ฿300.00');
      expect(text).toContain('รายรับเดือนนี้ ฿5,000.00');
      expect(text).toContain('รายจ่ายประจำที่ยังไม่ถึงรอบ ฿1,500.00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('พรุ่งนี้ขึ้นเดือนใหม่ = บอกตรง ๆ ไม่ตอบตัวเลขที่ไม่มีความหมาย', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T10:00:00+07:00'));
    try {
      const text = await runCommand(USER, 'remaining_tomorrow');
      expect(getSafeToSpend).not.toHaveBeenCalled();
      expect(text).toContain('เดือนใหม่');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('🔴 คำถามเรื่อง "งบ" ต้องได้การ์ดงบ ไม่ใช่ยอดใช้ได้ต่อวัน', () => {
  // ผู้ใช้ทดสอบถาม "งบเดือนนี้เหลือเท่าไหร่" แล้วได้ "วันนี้ใช้ได้อีก ..." กลับไป
  it.each(['งบเดือนนี้เหลือเท่าไหร่', 'งบเหลือเท่าไหร่ครับ', 'งบเดือนนี้', 'เช็คงบ'])('"%s" → budget', (text) => {
    expect(matchCommand(text)).toBe('budget');
  });

  it('"เหลือเท่าไหร่" ที่ไม่มีคำว่างบยังเป็นยอดใช้ได้ต่อวันเหมือนเดิม', () => {
    expect(matchCommand('เหลือเท่าไหร่')).toBe('remaining');
  });
});

describe('🔴 เหลือ — ใช้เพดานรายวันที่ผู้ใช้ตั้งไว้ในเว็บ (ร่าง §S5.10)', () => {
  // ผู้ใช้ทดสอบตั้งเพดานรายวันในเว็บ แต่บอทยังตอบ "เงินเหลือทั้งเดือน ÷ วันที่เหลือ"

  it('ตั้งเองไว้ ฿300 ใช้ไป ฿120 → วันนี้ใช้ได้อีก ฿180 และบอกที่มาว่าคิดจากเพดาน', async () => {
    vi.mocked(getDailyAllowance).mockResolvedValue({
      mode: 'manual', profile: 'moderate', ceilingSatang: 30000, spentTodaySatang: 12000, remainingSatang: 18000,
    });
    const reply = await runCommand(USER, 'remaining');
    expect(reply.split('\n')[0]).toContain('฿180.00');
    expect(reply).toContain('เพดานรายวันที่คุณตั้งไว้ ฿300.00');
    expect(reply).toContain('ใช้ไปแล้ววันนี้ ฿120.00');
    // ไม่ใช่สูตรเดิม
    expect(reply).not.toContain('หารอีก');
    expect(getSafeToSpend).not.toHaveBeenCalled();
  });

  it('ใช้เกินเพดานแล้ว → บอกว่าเกินเท่าไหร่ ไม่ใช่ใช้ได้อีกติดลบ', async () => {
    vi.mocked(getDailyAllowance).mockResolvedValue({
      mode: 'manual', profile: 'moderate', ceilingSatang: 30000, spentTodaySatang: 35000, remainingSatang: -5000,
    });
    const reply = await runCommand(USER, 'remaining');
    expect(reply.split('\n')[0]).toContain('เกินเพดานแล้ว ฿50.00');
  });

  it('ให้ระบบคิดแบบประหยัด → บอกว่าเป็นเพดานที่ระบบคิด และบอกรูปแบบ', async () => {
    vi.mocked(getDailyAllowance).mockResolvedValue({
      mode: 'system', profile: 'frugal', ceilingSatang: 13590, spentTodaySatang: 0, remainingSatang: 13590,
    });
    const reply = await runCommand(USER, 'remaining');
    expect(reply).toContain('เพดานรายวันที่ระบบคิดให้ (แบบประหยัด)');
  });

  it('พรุ่งนี้ — เพดานตั้งเองได้เต็มจำนวน ไม่ใช่สูตร S5.2', async () => {
    vi.mocked(getSpendingLimits).mockResolvedValue({
      ...defaultSpendingLimits(),
      daily: { enabled: true, mode: 'manual', limitSatang: 30000 },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T05:00:00Z'));
    try {
      const reply = await runCommand(USER, 'remaining_tomorrow');
      expect(reply.split('\n')[0]).toContain('฿300.00');
      expect(getSafeToSpend).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('🔴 สัปดาห์นี้ / เดือนนี้ใช้ได้อีกเท่าไหร่ — ต้องไม่ตอบยอดของวันนี้', () => {
  it('ประโยคที่ผู้ใช้พิมพ์จริงตอนทดสอบ เข้าคำสั่งของช่วงเวลาที่ถาม', () => {
    expect(matchCommand('สัปดาห์นี้ใช้ได้อีกกี่บาท')).toBe('remaining_week');
    expect(matchCommand('เดือนนี้ใช้ได้อีกกี่บาท')).toBe('remaining_month');
    // ของเดิมต้องไม่เปลี่ยน
    expect(matchCommand('วันนี้ใช้ได้อีกกี่บาท')).toBe('remaining');
  });

  it.each([
    ['สัปดาห์นี้เหลือเท่าไหร่ครับ', 'remaining_week'],
    ['อาทิตย์นี้ใช้เงินได้อีกเท่าไร', 'remaining_week'],
    ['อาทิตย์นี้เหลือเงินเท่าไหร่', 'remaining_week'],
    ['เพดานรายสัปดาห์', 'remaining_week'],
    ['How much can I spend this week?', 'remaining_week'],
    ['เดือนนี้เหลือเท่าไหร่', 'remaining_month'],
    ['เดือนนี้จะใช้เงินได้อีกกี่บาทคะ', 'remaining_month'],
    ['เพดานรายเดือน', 'remaining_month'],
    ['how much left this month', 'remaining_month'],
    ['เพดาน', 'limits'],
    ['ดูเพดาน', 'limits'],
    ['เพดานการใช้จ่าย', 'limits'],
    ['รายการประจำ', 'recurring'],
    ['รายจ่ายประจำ', 'recurring'],
  ])('"%s" → %s', (text, command) => {
    expect(matchCommand(text)).toBe(command);
  });

  it('คำถามที่มีอยู่เดิมยังเข้าคำสั่งเดิม ไม่ถูกคำใหม่แย่ง', () => {
    expect(matchCommand('เดือนนี้ใช้ไปเท่าไหร่')).toBe('summary');
    expect(matchCommand('งบเดือนนี้เหลือเท่าไหร่')).toBe('budget');
    expect(matchCommand('พรุ่งนี้ใช้ได้เท่าไหร่')).toBe('remaining_tomorrow');
  });

  it('🔴 ข้อความบันทึกเงินที่มีคำว่าเพดาน/สัปดาห์ ยังไม่ใช่คำสั่ง', () => {
    expect(matchCommand('ซ่อมเพดาน 500')).toBeNull();
    expect(matchCommand('ค่าขนมสัปดาห์นี้ 200')).toBeNull();
    expect(matchCommand('รายการประจำ 300')).toBeNull();
  });
});

describe('remaining_week — ตอบตามเพดานรายสัปดาห์', () => {
  it('ตั้งเพดานเอง → หัวข้อเป็นของสัปดาห์นี้ พร้อมที่มา', async () => {
    vi.mocked(getWeeklyAllowance).mockResolvedValue({
      ...NO_LIMIT,
      enabled: true,
      mode: 'manual',
      ceilingSatang: 150000,
      spentSatang: 50000,
      remainingSatang: 100000,
    });

    const text = await runCommand(USER, 'remaining_week');
    expect(text.split('\n')[0]).toBe('💸 สัปดาห์นี้ใช้ได้อีก ฿1,000.00');
    expect(text).toContain('เพดานรายสัปดาห์ที่คุณตั้งไว้ ฿1,500.00');
    expect(text).toContain('ใช้ไปแล้วสัปดาห์นี้ ฿500.00');
    expect(text).not.toContain('วันนี้ใช้ได้อีก');
  });

  it('ใช้เกินเพดาน → บอกว่าเกินเท่าไหร่', async () => {
    vi.mocked(getWeeklyAllowance).mockResolvedValue({
      ...NO_LIMIT,
      enabled: true,
      mode: 'manual',
      ceilingSatang: 150000,
      spentSatang: 170000,
      remainingSatang: -20000,
    });

    expect((await runCommand(USER, 'remaining_week')).split('\n')[0]).toBe(
      '⚠️ สัปดาห์นี้ใช้เกินเพดานแล้ว ฿200.00'
    );
  });

  it('ระบบคิดให้ → บอกรูปแบบที่ใช้คิด', async () => {
    vi.mocked(getWeeklyAllowance).mockResolvedValue({
      ...NO_LIMIT,
      enabled: true,
      profile: 'frugal',
      ceilingSatang: 72751,
      spentSatang: 10000,
      remainingSatang: 62751,
    });

    expect(await runCommand(USER, 'remaining_week')).toContain(
      'เพดานรายสัปดาห์ที่ระบบคิดให้ (แบบประหยัด) ฿727.51'
    );
  });

  it('🔴 ไม่ได้ตั้งเพดานรายสัปดาห์ → บอกยอดที่ใช้ไปและบอกตรง ๆ ว่ายังไม่ได้ตั้ง ไม่เอายอดรายวันมาตอบ', async () => {
    vi.mocked(getWeeklyAllowance).mockResolvedValue({ ...NO_LIMIT, spentSatang: 12000 });

    const text = await runCommand(USER, 'remaining_week');
    expect(text.split('\n')[0]).toBe('📅 สัปดาห์นี้ใช้ไปแล้ว ฿120.00');
    expect(text).toContain('ยังไม่ได้ตั้งเพดานรายสัปดาห์');
    expect(text).not.toContain('ใช้ได้อีก ฿');
    expect(getDailyAllowance).not.toHaveBeenCalled();
  });

  it('สัปดาห์คาบสองเดือนในโหมดระบบคิด → บอกว่ายังคิดให้ไม่ได้ ไม่โชว์เพดาน ฿0', async () => {
    vi.mocked(getWeeklyAllowance).mockResolvedValue({
      ...NO_LIMIT,
      enabled: true,
      available: false,
      spentSatang: 30000,
    });

    const text = await runCommand(USER, 'remaining_week');
    expect(text).toContain('สัปดาห์นี้คาบสองเดือน');
    expect(text).toContain('ใช้ไปแล้วสัปดาห์นี้ ฿300.00');
    expect(text).not.toContain('฿0.00');
  });
});

describe('remaining_month — ตอบตามเพดานรายเดือน หรือเงินเหลือทั้งเดือน', () => {
  it('ตั้งเพดานรายเดือนไว้ → เพดาน − ใช้ไปแล้วเดือนนี้', async () => {
    vi.mocked(getMonthlyAllowance).mockResolvedValue({
      ...NO_LIMIT,
      enabled: true,
      mode: 'manual',
      ceilingSatang: 500000,
      spentSatang: 120000,
      remainingSatang: 380000,
    });

    const text = await runCommand(USER, 'remaining_month');
    expect(text.split('\n')[0]).toBe('💸 เดือนนี้ใช้ได้อีก ฿3,800.00');
    expect(text).toContain('เพดานรายเดือนที่คุณตั้งไว้ ฿5,000.00');
    expect(text).toContain('ใช้ไปแล้วเดือนนี้ ฿1,200.00');
  });

  it('ไม่ได้ตั้งเพดานรายเดือน → ใช้เงินเหลือทั้งเดือนของ S5.2 พร้อมที่มา', async () => {
    const text = await runCommand(USER, 'remaining_month');

    // ค่าจาก getSafeToSpend ใน beforeEach: คงเหลือ ฿1,400 / วันละ ฿100 / เหลือ 14 วัน
    expect(text.split('\n')[0]).toBe('💸 เดือนนี้ใช้ได้อีก ฿1,400.00');
    expect(text).toContain('รายรับเดือนนี้ ฿15,000.00');
    expect(text).toContain('กันไว้ให้แผนออม ฿3,000.00');
    expect(text).toContain('เหลืออีก 14 วันจะสิ้นเดือน เฉลี่ยวันละ ฿100.00');
    expect(text).not.toContain('วันนี้ใช้ได้อีก');
  });

  it('เงินเดือนนี้ติดลบ → ตอบ ฿0 แล้วบอกสาเหตุ เหมือนคำสั่ง "เหลือ"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSafeToSpend).mockResolvedValue({
      monthRemainingSatang: -50000,
      perDaySatang: 0,
      daysLeft: 14,
      overspentSatang: 50000,
      breakdown: {
        monthIncomeSatang: 100000,
        upcomingIncomeSatang: 0,
        monthExpenseSatang: 150000,
        upcomingExpenseSatang: 0,
        planCommitmentSatang: 0,
      },
    } as any);

    const text = await runCommand(USER, 'remaining_month');
    expect(text.split('\n')[0]).toBe('💸 เดือนนี้ใช้ได้อีก ฿0.00');
    expect(text).toContain('เดือนนี้ใช้เกินแล้ว ขาดอยู่ ฿500.00');
  });
});

describe('limits — เพดานทั้ง 3 ระดับที่ตั้งในหน้าเว็บ', () => {
  it('ยังไม่ได้เปิดสักระดับ → ชี้ไปที่หน้าตั้งค่า', async () => {
    const text = await runCommand(USER, 'limits');
    expect(text).toContain('ยังไม่ได้เปิดเพดานการใช้จ่าย');
    expect(text).toContain('หน้าเว็บ → ตั้งค่า');
  });

  it('เปิดบางระดับ → แสดงใช้ไป/เพดานของระดับที่เปิด และบอกว่าระดับไหนปิดอยู่', async () => {
    vi.mocked(getDailyAllowance).mockResolvedValue({
      mode: 'manual',
      profile: 'moderate',
      ceilingSatang: 10000,
      spentTodaySatang: 12000,
      remainingSatang: -2000,
    });
    vi.mocked(getMonthlyAllowance).mockResolvedValue({
      ...NO_LIMIT,
      enabled: true,
      mode: 'manual',
      ceilingSatang: 500000,
      spentSatang: 120000,
      remainingSatang: 380000,
    });

    const text = await runCommand(USER, 'limits');
    expect(text).toContain('🔴 วันนี้  ฿120.00 / ฿100.00');
    expect(text).toContain('เกิน ฿20.00');
    expect(text).toContain('⚪ รายสัปดาห์  ปิดอยู่');
    expect(text).toContain('🟢 เดือนนี้  ฿1,200.00 / ฿5,000.00');
    expect(text).toContain('เหลือ ฿3,800.00');
  });
});

describe('recurring — รายการประจำที่ตั้งในหน้าเว็บ', () => {
  it('ยังไม่มี → บอกว่าตั้งได้ที่หน้าเว็บ', async () => {
    expect(await runCommand(USER, 'recurring')).toContain('ยังไม่มีรายการประจำ');
  });

  it('มีรายการ → แสดงยอด ทิศทาง รอบ และวันถัดไป', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(listRecurringRules).mockResolvedValue([
      { label: 'เงินเดือน', type: 'income', amountSatang: 1500000, frequency: 'monthly', nextRun: '2026-12-01' },
      { label: 'ค่าหอ', type: 'expense', amountSatang: 350000, frequency: 'monthly', nextRun: '2026-12-05' },
    ] as any);

    const text = await runCommand(USER, 'recurring');
    expect(text).toContain('🟢 เงินเดือน +฿15,000.00');
    expect(text).toContain('🔴 ค่าหอ -฿3,500.00');
    expect(text).toContain('ทุกเดือน · รอบถัดไป 5 ธ.ค.');
  });
});
