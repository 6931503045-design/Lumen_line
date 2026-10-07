// ไฟล์นี้ทำหน้าที่อะไร: test ด่าน guard ก่อนเรียก AI — ลำดับการตรวจ โควตา และ redact
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.1 ① GUARD (6 ขั้นตามลำดับ)
// ⚖️ กฎเหล็ก G4, G5
//
// 🔴 ลำดับสำคัญไม่ใช่แค่เรื่องสวยงาม: ถ้า AI ปิดอยู่แล้วยังยิง query ไปนับโควตา
// ระบบที่ไม่ได้ใช้ AI เลยจะโดน query เพิ่มทุกข้อความที่ผู้ใช้พิมพ์ เทสต์ชุดนี้
// จึงพิสูจน์ด้วยว่า "ด่านที่ถูกกว่าต้องถูกตรวจก่อน" ไม่ใช่แค่ว่าผลลัพธ์ถูก

import { beforeEach, describe, expect, it, vi } from 'vitest';

// env ถูกอ่านตอน import จึง mock ทั้งก้อนเพื่อให้แต่ละเคสตั้งค่าได้เอง
// ต้องใช้ vi.hoisted เพราะ vi.mock ถูกยกขึ้นไปบนสุดของไฟล์ก่อน const ธรรมดาจะถูกสร้าง
const mockEnv = vi.hoisted(() => ({
  aiEnabled: true,
  geminiApiKey: 'test-key',
  aiDailyLimitPerUser: 30,
  aiDailyLimitGlobal: 0,
}));

vi.mock('../src/config/env', () => ({ env: mockEnv }));

vi.mock('../src/db/queries/logs', () => ({
  countAiCallsByUserSince: vi.fn(),
  countAiCallsGlobalSince: vi.fn(),
}));

vi.mock('../src/db/queries/users', () => ({
  isAiEnabledForUser: vi.fn(),
}));

import { countAiCallsByUserSince, countAiCallsGlobalSince } from '../src/db/queries/logs';
import { isAiEnabledForUser } from '../src/db/queries/users';
import { checkAiAllowed, describeBlockReason } from '../src/services/ai/guard';

const TODAY = '2026-10-07';
const BASE = { userId: 'u1', kind: 'text' as const, text: 'กาแฟแก้วละ 80', todayIso: TODAY };

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.aiEnabled = true;
  mockEnv.geminiApiKey = 'test-key';
  mockEnv.aiDailyLimitPerUser = 30;
  mockEnv.aiDailyLimitGlobal = 0;
  vi.mocked(isAiEnabledForUser).mockResolvedValue(true);
  vi.mocked(countAiCallsByUserSince).mockResolvedValue(0);
  vi.mocked(countAiCallsGlobalSince).mockResolvedValue(0);
});

describe('ขั้น 1 — ปิดทั้งระบบ (G4)', () => {
  it('AI_ENABLED=false ปฏิเสธทันที', async () => {
    mockEnv.aiEnabled = false;
    const result = await checkAiAllowed(BASE);
    expect(result).toEqual({ ok: false, reason: 'ai_disabled_globally' });
  });

  it('ปิดอยู่แล้วต้องไม่แตะ DB เลยแม้แต่ query เดียว', async () => {
    mockEnv.aiEnabled = false;
    await checkAiAllowed(BASE);
    expect(isAiEnabledForUser).not.toHaveBeenCalled();
    expect(countAiCallsByUserSince).not.toHaveBeenCalled();
    expect(countAiCallsGlobalSince).not.toHaveBeenCalled();
  });

  it('ไม่มี GEMINI_API_KEY ก็ปฏิเสธก่อนแตะ DB', async () => {
    mockEnv.geminiApiKey = '';
    const result = await checkAiAllowed(BASE);
    expect(result).toEqual({ ok: false, reason: 'no_api_key' });
    expect(isAiEnabledForUser).not.toHaveBeenCalled();
  });
});

describe('ขั้น 2 — ผู้ใช้ปิด AI เอง', () => {
  it('users.ai_enabled=false ปฏิเสธ', async () => {
    vi.mocked(isAiEnabledForUser).mockResolvedValue(false);
    const result = await checkAiAllowed(BASE);
    expect(result).toEqual({ ok: false, reason: 'ai_disabled_for_user' });
  });

  it('ผู้ใช้ปิดแล้วไม่ต้องไปนับโควตาต่อ', async () => {
    vi.mocked(isAiEnabledForUser).mockResolvedValue(false);
    await checkAiAllowed(BASE);
    expect(countAiCallsByUserSince).not.toHaveBeenCalled();
  });
});

describe('ขั้น 3-4 — โควตารายวัน', () => {
  it('ใช้ครบโควตาต่อคนแล้ว', async () => {
    vi.mocked(countAiCallsByUserSince).mockResolvedValue(30);
    const result = await checkAiAllowed(BASE);
    expect(result).toEqual({ ok: false, reason: 'user_daily_limit' });
  });

  it('ยังไม่ครบโควตา ผ่านได้', async () => {
    vi.mocked(countAiCallsByUserSince).mockResolvedValue(29);
    const result = await checkAiAllowed(BASE);
    expect(result.ok).toBe(true);
  });

  it('โควตาต่อคน = 0 หมายถึงไม่จำกัดในโค้ด ไม่ใช่ห้ามใช้', async () => {
    mockEnv.aiDailyLimitPerUser = 0;
    await checkAiAllowed(BASE);
    expect(countAiCallsByUserSince).not.toHaveBeenCalled();
  });

  it('โควตาทั้งระบบเต็ม', async () => {
    mockEnv.aiDailyLimitGlobal = 100;
    vi.mocked(countAiCallsGlobalSince).mockResolvedValue(100);
    const result = await checkAiAllowed(BASE);
    expect(result).toEqual({ ok: false, reason: 'global_daily_limit' });
  });

  it('โควตารายวันนับจากเที่ยงคืนเวลาไทย ไม่ใช่เที่ยงคืน UTC', async () => {
    await checkAiAllowed(BASE);
    expect(countAiCallsByUserSince).toHaveBeenCalledWith('u1', '2026-10-07T00:00:00+07:00');
  });

  it('⚖️ G6: นับโควตาต่อคนด้วย userId ที่ส่งมาเท่านั้น', async () => {
    await checkAiAllowed({ ...BASE, userId: 'u-อื่น' });
    expect(countAiCallsByUserSince).toHaveBeenCalledWith('u-อื่น', expect.any(String));
  });
});

describe('ทางที่ผิด — DB ล่ม', () => {
  it('นับโควตาไม่ได้ = ไม่เรียก AI (ปฏิเสธเมื่อไม่รู้)', async () => {
    vi.mocked(countAiCallsByUserSince).mockRejectedValue(new Error('DB ล่ม'));
    const result = await checkAiAllowed(BASE);
    expect(result).toEqual({ ok: false, reason: 'global_daily_limit' });
  });

  it('DB ล่มแล้วต้องไม่ throw ออกไป (⚖️ G4 ผู้ใช้ยังต้องจดเงินได้)', async () => {
    vi.mocked(isAiEnabledForUser).mockRejectedValue(new Error('DB ล่ม'));
    await expect(checkAiAllowed(BASE)).resolves.toMatchObject({ ok: false });
  });
});

describe('ขั้น 5 — redact ก่อนส่งออก (G5)', () => {
  it('ผ่านด่านแล้วได้ข้อความที่ปิดเลขบัญชีแล้ว ไม่ใช่ข้อความดิบ', async () => {
    const result = await checkAiAllowed({
      ...BASE,
      text: 'โอนเข้า 1234567890 ไป 500 บาท',
    });
    if (!result.ok) throw new Error('ควรผ่านด่าน');
    expect(result.safeText).toBe('โอนเข้า [REDACTED] ไป 500 บาท');
    expect(result.safeText).not.toContain('1234567890');
  });

  it('จำนวนเงินธรรมดาต้องไม่ถูกปิด ไม่งั้น AI อ่านยอดไม่ได้', async () => {
    const result = await checkAiAllowed({ ...BASE, text: 'ค่าเทอม 25,000 บาท' });
    if (!result.ok) throw new Error('ควรผ่านด่าน');
    expect(result.safeText).toContain('25,000');
  });
});

describe('describeBlockReason — มีคำอธิบายทุกสาเหตุ', () => {
  it('ทุกสาเหตุคืนข้อความที่อ่านรู้เรื่อง ไม่มี undefined', () => {
    const reasons = [
      'ai_disabled_globally',
      'ai_disabled_for_user',
      'no_api_key',
      'user_daily_limit',
      'global_daily_limit',
    ] as const;

    for (const reason of reasons) {
      expect(describeBlockReason(reason)).toBeTruthy();
    }
  });
});
