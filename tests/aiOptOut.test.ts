// ไฟล์นี้ทำหน้าที่อะไร: test การอ่าน/เขียน users.ai_enabled — ทางถอนความยินยอมของผู้ใช้
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S11.1 ด่านที่ 1 ของ guard / SRS NFR-6 (PDPA)
// ⚖️ กฎเหล็ก G4, G6
//
// 🔴 ทำไมต้องมีเทสต์ให้ฟังก์ชันสั้น ๆ สองตัวนี้:
// ประกาศความเป็นส่วนตัวที่บอทส่งให้ผู้ใช้สัญญาว่า "ปิดผู้ช่วย AI ได้" ถ้าสองตัวนี้
// เขียนผิดคอลัมน์หรือลืมกรอง user_id ผู้ใช้จะกดปิดแล้วไม่มีผล (หรือไปปิดของคนอื่น)
// ซึ่งเท่ากับเราโฆษณาสิทธิที่ให้จริงไม่ได้
//
// ⚠️ ไม่มี supertest ในโปรเจกต์ (เพิ่ม dependency ต้องขออนุมัติตาม SPEC §7)
// จึงเทสต์ที่ชั้น query ซึ่งเป็นจุดที่เขียน DB จริง ส่วนการต่อ route → query
// พิสูจน์ด้วยการอ่านโค้ดใน routes/api.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateChain = { eq: vi.fn() };
const selectChain = { eq: vi.fn() };

vi.mock('../src/db/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => updateChain),
      select: vi.fn(() => selectChain),
    })),
  },
}));

import { supabase } from '../src/db/supabase';
import { isAiEnabledForUser, setAiEnabledForUser } from '../src/db/queries/users';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setAiEnabledForUser — ผู้ใช้ปิด AI ของตัวเอง', () => {
  it('เขียนค่า false ลงคอลัมน์ ai_enabled ของผู้ใช้คนนั้น (⚖️ G6)', async () => {
    updateChain.eq.mockResolvedValue({ error: null });

    await setAiEnabledForUser('u1', false);

    const fromMock = vi.mocked(supabase.from);
    expect(fromMock).toHaveBeenCalledWith('users');

    const updateFn = fromMock.mock.results[0]?.value.update;
    expect(updateFn).toHaveBeenCalledWith({ ai_enabled: false });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('เปิดกลับได้ด้วย', async () => {
    updateChain.eq.mockResolvedValue({ error: null });

    await setAiEnabledForUser('u1', true);

    const updateFn = vi.mocked(supabase.from).mock.results[0]?.value.update;
    expect(updateFn).toHaveBeenCalledWith({ ai_enabled: true });
  });

  it('🔴 เขียนไม่สำเร็จต้อง throw ไม่ใช่เงียบ', async () => {
    // ถ้ากลืน error ผู้ใช้จะเห็นสวิตช์เป็น "ปิดแล้ว" ทั้งที่เซิร์ฟเวอร์ยังเปิดอยู่
    // แล้วข้อมูลจะยังถูกส่งออกไปต่อโดยที่ผู้ใช้คิดว่าถอนความยินยอมสำเร็จ
    updateChain.eq.mockResolvedValue({ error: { message: 'DB ล่ม' } });

    await expect(setAiEnabledForUser('u1', false)).rejects.toBeTruthy();
  });
});

describe('isAiEnabledForUser — ด่านที่ 1 ของ guard', () => {
  it('ผู้ใช้เปิดไว้ → true', async () => {
    selectChain.eq.mockReturnValue({
      maybeSingle: async () => ({ data: { ai_enabled: true }, error: null }),
    });

    expect(await isAiEnabledForUser('u1')).toBe(true);
    expect(selectChain.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('ผู้ใช้ปิดไว้ → false', async () => {
    selectChain.eq.mockReturnValue({
      maybeSingle: async () => ({ data: { ai_enabled: false }, error: null }),
    });

    expect(await isAiEnabledForUser('u1')).toBe(false);
  });

  it('หาผู้ใช้ไม่เจอ → false (ปฏิเสธเมื่อไม่รู้)', async () => {
    selectChain.eq.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    expect(await isAiEnabledForUser('u-ไม่มีจริง')).toBe(false);
  });

  it('🔴 DB ล่ม → false และไม่ throw (⚖️ G4 แอปต้องยังใช้ได้)', async () => {
    // guard เรียกฟังก์ชันนี้ ถ้ามัน throw ข้อความของผู้ใช้จะพังทั้งข้อความ
    // ทั้งที่ทางด่วน regex ยังทำงานได้อยู่
    selectChain.eq.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: { message: 'DB ล่ม' } }),
    });

    await expect(isAiEnabledForUser('u1')).resolves.toBe(false);
  });
});
