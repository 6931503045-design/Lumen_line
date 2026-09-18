// ไฟล์นี้ทำหน้าที่อะไร: test งานตรวจแผนออมรายวัน (S5.6 + S7 planCheck)
// ใครรับผิดชอบ: ③ AI (ไม่มี AI ในเส้นทางนี้เลย)
// เขียนในสัปดาห์: W4
// ⚖️ กฎเหล็ก G7
//
// สิ่งที่ต้องพิสูจน์: เตือนถูกจังหวะ, ไม่เตือนซ้ำเกินสัปดาห์ละครั้ง,
// และปิดแผนก่อนส่งคำยินดี (ไม่งั้นแข่งกันแล้วส่งซ้ำ)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// plan.service ดึง recurring.service และ query อื่นมาด้วยตอน import ซึ่งวิ่งไปถึง
// db/supabase ที่ต้องการ env ครบ — mock ตัว client ทิ้งเลยจบทุกสาย
vi.mock('../src/db/supabase', () => ({ supabase: {} }));

vi.mock('../src/db/queries/plans', () => ({
  listActivePlansAllUsers: vi.fn(),
  listTransferRowsForPlans: vi.fn(),
  transitionPlanStatus: vi.fn(),
  // plan.service ต้องการตัวพวกนี้ตอน import
  listPlansByUser: vi.fn(),
  findPlanOwnedByUser: vi.fn(),
  insertDraftPlans: vi.fn(),
  cancelDraftPlans: vi.fn(),
  listPlanTransferRows: vi.fn(),
}));
vi.mock('../src/line/push', () => ({ sendPush: vi.fn() }));

import {
  listActivePlansAllUsers,
  listTransferRowsForPlans,
  transitionPlanStatus,
} from '../src/db/queries/plans';
import { sendPush } from '../src/line/push';
import { checkActivePlans } from '../src/services/planCheck.service';

const TODAY = '2026-09-17'; // วันพฤหัสบดี
const NOW = new Date('2026-09-17T02:00:00Z');

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    title: 'iPhone',
    target_amount: '30000.00',
    target_date: '2027-06-14',
    monthly_save: '3000.00',
    status: 'active',
    confidence: 'high',
    created_at: '2026-08-18T00:00:00Z',
    confirmed_at: '2026-08-18T00:00:00Z', // 30 วันก่อน NOW
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listActivePlansAllUsers).mockResolvedValue([]);
  vi.mocked(listTransferRowsForPlans).mockResolvedValue([]);
  vi.mocked(transitionPlanStatus).mockResolvedValue(plan({ status: 'completed' }));
  vi.mocked(sendPush).mockResolvedValue({ sent: true });
});

describe('checkActivePlans — ไม่มีอะไรให้ทำ', () => {
  it('ไม่มีแผน active เลย → ไม่ยิง query ยอดโอน ไม่ push', async () => {
    const result = await checkActivePlans(TODAY, NOW);
    expect(result.plansChecked).toBe(0);
    expect(listTransferRowsForPlans).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('ออมตามเป้าอยู่ → ไม่เตือนอะไรเลย', async () => {
    vi.mocked(listActivePlansAllUsers).mockResolvedValue([plan()]);
    // เป้าสะสม 30 วัน = ฿3,000 ออมได้ ฿3,000 พอดี
    vi.mocked(listTransferRowsForPlans).mockResolvedValue([
      { plan_id: 'plan-1', amount: '3000.00' },
    ]);

    const result = await checkActivePlans(TODAY, NOW);
    expect(result.offTrack).toBe(0);
    expect(result.completed).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });
});

describe('checkActivePlans — ครบเป้า (S5.6)', () => {
  beforeEach(() => {
    vi.mocked(listActivePlansAllUsers).mockResolvedValue([plan()]);
    vi.mocked(listTransferRowsForPlans).mockResolvedValue([
      { plan_id: 'plan-1', amount: '30000.00' },
    ]);
  });

  it('เปลี่ยนเป็น completed แล้วส่งคำยินดี', async () => {
    const result = await checkActivePlans(TODAY, NOW);
    expect(result.completed).toBe(1);
    expect(transitionPlanStatus).toHaveBeenCalledWith('user-1', 'plan-1', 'active', 'completed');
    expect(sendPush).toHaveBeenCalledWith(
      'user-1',
      'planStatus',
      'plandone:plan-1',
      expect.stringContaining('ครบเป้าแล้ว')
    );
  });

  it('🔴 ปิดแผนก่อนส่ง — ถ้าแพ้การแข่ง (แผนถูกปิดไปแล้ว) ต้องไม่ส่งคำยินดีซ้ำ', async () => {
    vi.mocked(transitionPlanStatus).mockResolvedValue(null);
    const result = await checkActivePlans(TODAY, NOW);
    expect(result.completed).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('ครบเป้าแล้วไม่ต้องเตือนหลุดเป้าซ้อนอีก', async () => {
    const result = await checkActivePlans(TODAY, NOW);
    expect(result.offTrack).toBe(0);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });
});

describe('checkActivePlans — หลุดเป้า (S5.6)', () => {
  beforeEach(() => {
    vi.mocked(listActivePlansAllUsers).mockResolvedValue([plan()]);
    // เป้าสะสม 30 วัน = ฿3,000 / ออมได้แค่ ฿1,000 = ต่ำกว่า 90%
    vi.mocked(listTransferRowsForPlans).mockResolvedValue([
      { plan_id: 'plan-1', amount: '1000.00' },
    ]);
  });

  it('เตือนพร้อมตัวเลขจริง และชวนให้ปรับแผน', async () => {
    const result = await checkActivePlans(TODAY, NOW);
    expect(result.offTrack).toBe(1);

    const [, kind, dedupKey, text] = vi.mocked(sendPush).mock.calls[0]!;
    expect(kind).toBe('planStatus');
    expect(text).toContain('฿1,000.00');
    expect(text).toContain('฿3,000.00');
    expect(text).toContain('ปรับแผน');
    expect(dedupKey).toBe('planoff:plan-1:2026-09-14'); // วันจันทร์ของสัปดาห์นั้น
  });

  it('ทุกวันในสัปดาห์เดียวกันได้ dedup_key เดียวกัน = เตือนสัปดาห์ละครั้ง', async () => {
    const keyOf = async (today: string) => {
      vi.mocked(sendPush).mockClear();
      await checkActivePlans(today, NOW);
      return vi.mocked(sendPush).mock.calls[0]![2];
    };

    expect(await keyOf('2026-09-14')).toBe('planoff:plan-1:2026-09-14'); // จันทร์
    expect(await keyOf('2026-09-17')).toBe('planoff:plan-1:2026-09-14'); // พฤหัส
    expect(await keyOf('2026-09-20')).toBe('planoff:plan-1:2026-09-14'); // อาทิตย์
    // ข้ามไปสัปดาห์ใหม่ = กุญแจใหม่ = เตือนได้อีกครั้ง
    expect(await keyOf('2026-09-21')).toBe('planoff:plan-1:2026-09-21'); // จันทร์ถัดไป
  });

  it('เพิ่งเริ่มแผนไม่ถึง 14 วัน → ยังไม่เตือน', async () => {
    vi.mocked(listActivePlansAllUsers).mockResolvedValue([
      plan({ confirmed_at: '2026-09-10T00:00:00Z' }), // 7 วัน
    ]);
    const result = await checkActivePlans(TODAY, NOW);
    expect(result.offTrack).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('push ถูกข้าม (ซ้ำ/โควตาหมด) นับเป็น pushSkipped ไม่ใช่ pushed', async () => {
    vi.mocked(sendPush).mockResolvedValue({ sent: false, reason: 'quota' });
    const result = await checkActivePlans(TODAY, NOW);
    expect(result.offTrack).toBe(1);
    expect(result.pushed).toBe(0);
    expect(result.pushSkipped).toBe(1);
  });
});

describe('checkActivePlans — ความทนทาน', () => {
  it('G7: นับเฉพาะยอดโอนของแผนตัวเอง ไม่ปนกัน', async () => {
    vi.mocked(listActivePlansAllUsers).mockResolvedValue([
      plan({ id: 'plan-a' }),
      plan({ id: 'plan-b', user_id: 'user-2' }),
    ]);
    vi.mocked(listTransferRowsForPlans).mockResolvedValue([
      { plan_id: 'plan-a', amount: '30000.00' },
      { plan_id: 'plan-b', amount: '1000.00' },
    ]);

    const result = await checkActivePlans(TODAY, NOW);
    expect(result.completed).toBe(1); // plan-a ครบเป้า
    expect(result.offTrack).toBe(1);  // plan-b หลุดเป้า
  });

  it('ดึงยอดโอนทีเดียวสำหรับทุกแผน ไม่ยิงทีละใบ', async () => {
    vi.mocked(listActivePlansAllUsers).mockResolvedValue([
      plan({ id: 'plan-a' }),
      plan({ id: 'plan-b' }),
    ]);
    await checkActivePlans(TODAY, NOW);
    expect(listTransferRowsForPlans).toHaveBeenCalledTimes(1);
    expect(listTransferRowsForPlans).toHaveBeenCalledWith(['plan-a', 'plan-b']);
  });

  it('แผนหนึ่งพังต้องไม่ทำให้แผนที่เหลือหยุด', async () => {
    vi.mocked(listActivePlansAllUsers).mockResolvedValue([
      plan({ id: 'plan-พัง' }),
      plan({ id: 'plan-ดี' }),
    ]);
    vi.mocked(listTransferRowsForPlans).mockResolvedValue([
      { plan_id: 'plan-พัง', amount: '1000.00' },
      { plan_id: 'plan-ดี', amount: '1000.00' },
    ]);
    vi.mocked(sendPush)
      .mockRejectedValueOnce(new Error('LINE ล่ม'))
      .mockResolvedValueOnce({ sent: true });

    const result = await checkActivePlans(TODAY, NOW);
    expect(result.failed).toBe(1);
    expect(result.pushed).toBe(1);
    expect(result.plansChecked).toBe(2);
  });
});
