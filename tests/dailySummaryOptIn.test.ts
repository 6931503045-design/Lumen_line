// ไฟล์นี้ทำหน้าที่อะไร: test การอ่าน/เขียน users.daily_summary_enabled
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §S13 ("สรุปรายวันเป็น opt-in")
// ⚖️ กฎเหล็ก G6
//
// listDailySummaryUserIds คือด่านเดียวที่ตัดสินว่าใครได้ push สรุปรายวัน
// ถ้าลืมกรองคอลัมน์นี้ ผู้ใช้ที่ไม่ได้เปิดจะได้ข้อความทุกคืนและโควตาทั้งช่องทางหมดเร็ว

import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateChain = { eq: vi.fn() };
const selectChain = { eq: vi.fn() };
const fromMock = vi.fn((_table: string) => ({
  update: vi.fn(() => updateChain),
  select: vi.fn(() => selectChain),
}));

vi.mock('../src/db/supabase', () => ({ supabase: { from: (table: string) => fromMock(table) } }));

import {
  isDailySummaryEnabledForUser,
  listDailySummaryUserIds,
  setDailySummaryEnabledForUser,
} from '../src/db/queries/users';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listDailySummaryUserIds — ใครได้รับสรุป', () => {
  it('🔴 กรองเฉพาะคนที่เปิดรับ และยังไม่บล็อกบอท', async () => {
    const isActiveEq = vi.fn().mockResolvedValue({ data: [{ id: 'u1' }, { id: 'u2' }], error: null });
    selectChain.eq.mockReturnValue({ eq: isActiveEq });

    expect(await listDailySummaryUserIds()).toEqual(['u1', 'u2']);
    expect(fromMock).toHaveBeenCalledWith('users');
    expect(selectChain.eq).toHaveBeenCalledWith('daily_summary_enabled', true);
    expect(isActiveEq).toHaveBeenCalledWith('is_active', true);
  });

  it('DB ล่ม → throw ให้ job รายงานว่าพัง ไม่ใช่ตอบว่าไม่มีใครเปิด', async () => {
    selectChain.eq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB ล่ม' } }),
    });
    await expect(listDailySummaryUserIds()).rejects.toBeTruthy();
  });
});

describe('setDailySummaryEnabledForUser — ผู้ใช้เปิด/ปิดเอง', () => {
  it('เขียนลงคอลัมน์ daily_summary_enabled ของผู้ใช้คนนั้น (⚖️ G6)', async () => {
    updateChain.eq.mockResolvedValue({ error: null });

    await setDailySummaryEnabledForUser('u1', true);

    const updateFn = fromMock.mock.results[0]?.value.update;
    expect(updateFn).toHaveBeenCalledWith({ daily_summary_enabled: true });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('🔴 เขียนไม่สำเร็จต้อง throw — หน้าเว็บจะได้พลิกสวิตช์กลับ', async () => {
    updateChain.eq.mockResolvedValue({ error: { message: 'DB ล่ม' } });
    await expect(setDailySummaryEnabledForUser('u1', false)).rejects.toBeTruthy();
  });
});

describe('isDailySummaryEnabledForUser', () => {
  it('อ่านค่าของผู้ใช้คนนั้น', async () => {
    selectChain.eq.mockReturnValue({
      maybeSingle: async () => ({ data: { daily_summary_enabled: true }, error: null }),
    });
    expect(await isDailySummaryEnabledForUser('u1')).toBe(true);
    expect(selectChain.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('หาผู้ใช้ไม่เจอ → false (ค่าเริ่มต้นปิด)', async () => {
    selectChain.eq.mockReturnValue({ maybeSingle: async () => ({ data: null, error: null }) });
    expect(await isDailySummaryEnabledForUser('u1')).toBe(false);
  });

  it('DB ล่ม → throw ไม่เดาว่าปิด', async () => {
    selectChain.eq.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: { message: 'DB ล่ม' } }),
    });
    await expect(isDailySummaryEnabledForUser('u1')).rejects.toBeTruthy();
  });
});
