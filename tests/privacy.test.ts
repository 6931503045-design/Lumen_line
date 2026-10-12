// ไฟล์นี้ทำหน้าที่อะไร: test การแจ้งผู้ใช้เรื่องข้อมูลส่วนบุคคล และทางปิด AI
// ใครรับผิดชอบ: ① Bot Core / ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S11.4 "ความเป็นส่วนตัว" / SRS NFR-6 (PDPA)
// ⚖️ กฎเหล็ก G4, G5
//
// 🔴 สิ่งที่เทสต์ชุดนี้ต้องพิสูจน์ คือ "คำสัญญาที่เราบอกผู้ใช้ต้องเป็นจริง"
// ประกาศความเป็นส่วนตัวบอกผู้ใช้ 3 เรื่อง และทั้งสามต้องตรวจสอบได้จากโค้ด:
//   1. ปิด AI ได้ที่หน้าตั้งค่า        → ต้องมี endpoint ที่เขียน users.ai_enabled จริง
//   2. ปิดแล้วยังจดเงินได้ครบ           → ⚖️ G4 ซึ่ง guard รับประกันอยู่แล้ว
//   3. ข้อมูลที่ส่งออกถูกปิดเลขบัญชีก่อน → ⚖️ G5 ซึ่ง redact รับประกันอยู่แล้ว
// ถ้าข้อ 1 พัง ข้อความที่เราส่งให้ผู้ใช้จะกลายเป็นคำสัญญาเท็จ

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/supabase', () => ({
  supabase: { from: vi.fn() },
}));
vi.mock('../src/db/queries/users', () => ({
  ensureEmailIngestToken: vi.fn(),
}));
vi.mock('../src/line/reply', () => ({ replyText: vi.fn() }));

import { supabase } from '../src/db/supabase';
import { ensureEmailIngestToken } from '../src/db/queries/users';
import { replyText } from '../src/line/reply';
import { PRIVACY_NOTICE, WELCOME_MESSAGE } from '../src/config/privacy';
import { matchCommand, runCommand } from '../src/services/command.service';
import { handleFollow } from '../src/handlers/followHandler';

describe('เนื้อหาประกาศต้องครอบเรื่องที่ SPEC §S11.4 สั่งให้แจ้ง', () => {
  it('🔴 บอกตรง ๆ ว่า free tier ของ Google อาจนำข้อมูลไปใช้ปรับปรุงบริการ', () => {
    // นี่คือข้อที่ SPEC เขียนชื่อมาเฉพาะเจาะจง และเป็นข้อที่เลี่ยงพูดได้ง่ายที่สุด
    expect(PRIVACY_NOTICE).toContain('free tier');
    expect(PRIVACY_NOTICE).toContain('ปรับปรุงบริการ');
  });

  it('บอกว่าอะไรถูกส่งออกไปให้ AI', () => {
    expect(PRIVACY_NOTICE).toContain('รูปสลิป');
    expect(PRIVACY_NOTICE).toMatch(/ข้อความ/);
  });

  it('บอกว่าปิดเลขบัญชีและเบอร์โทรก่อนส่ง (⚖️ G5)', () => {
    expect(PRIVACY_NOTICE).toContain('เลขบัญชี');
    expect(PRIVACY_NOTICE).toContain('เบอร์โทร');
  });

  it('บอกว่าไม่เก็บรูปสลิปไว้ (SPEC §S9 MUST NOT)', () => {
    expect(PRIVACY_NOTICE).toMatch(/ไม่ถูกเก็บ|ไม่เก็บ/);
  });

  it('บอกวิธีปิด AI และยืนยันว่าปิดแล้วยังใช้งานได้ (⚖️ G4)', () => {
    expect(PRIVACY_NOTICE).toContain('ตั้งค่า');
    expect(PRIVACY_NOTICE).toContain('ยังจดเงินได้');
  });

  it('บอกวิธีขอลบข้อมูล และไม่กล่าวเกินจริงว่าบล็อกบอทแล้วข้อมูลหาย', () => {
    expect(PRIVACY_NOTICE).toContain('ลบข้อมูล');
    expect(PRIVACY_NOTICE).toContain('ข้อมูลยังอยู่');
  });

  it('ข้อความต้อนรับต้องแจ้งเรื่อง AI ตั้งแต่ข้อความแรก ไม่ซ่อนไว้ข้างใน', () => {
    expect(WELCOME_MESSAGE).toContain('AI');
    expect(WELCOME_MESSAGE).toContain('ความเป็นส่วนตัว');
    expect(WELCOME_MESSAGE).toContain('ปิด');
  });

  it('ข้อความต้อนรับต้องสั้นพอที่คนจะอ่านจริง', () => {
    // ข้อความต้อนรับที่ยาวเกินไปไม่มีใครอ่าน แล้วการแจ้งก็ไร้ความหมาย
    expect(WELCOME_MESSAGE.split('\n').length).toBeLessThan(20);
  });
});

describe('คำสั่ง `ความเป็นส่วนตัว` — ต้องอ่านซ้ำได้ตลอด', () => {
  it('จับคำสั่งได้ทั้งไทยและอังกฤษ', () => {
    expect(matchCommand('ความเป็นส่วนตัว')).toBe('privacy');
    expect(matchCommand('privacy')).toBe('privacy');
    expect(matchCommand('  ความเป็นส่วนตัว  ')).toBe('privacy');
  });

  it('คืนประกาศฉบับเต็ม ไม่ใช่ข้อความย่อ', async () => {
    expect(await runCommand('u1', 'privacy')).toBe(PRIVACY_NOTICE);
  });

  it('คำสั่งนี้ไม่แตะฐานข้อมูลเลย จึงใช้ได้แม้ตอน DB มีปัญหา', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('ไม่ควรถูกเรียก');
    });
    await expect(runCommand('u1', 'privacy')).resolves.toBe(PRIVACY_NOTICE);
  });

  it('มีอยู่ในรายการคำสั่งของ `ช่วยเหลือ` ไม่ใช่คำสั่งลับ', async () => {
    expect(await runCommand('u1', 'help')).toContain('ความเป็นส่วนตัว');
  });

  it('ข้อความที่ไม่ใช่คำสั่งยังไม่ถูกจับผิด', () => {
    expect(matchCommand('ความเป็นส่วนตัวของฉัน')).toBeNull();
    expect(matchCommand('กาแฟ 80')).toBeNull();
  });
});

describe('ข้อความต้อนรับตอนแอดเพื่อน (SPEC §S11.4)', () => {
  /** สร้าง chain ปลอมของ supabase ให้พอใช้กับ followHandler */
  function mockSupabase(options: { existing: boolean }) {
    vi.mocked(supabase.from).mockImplementation(
      (table: string) =>
        ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                options.existing ? { data: { id: 'u1' }, error: null } : { data: null, error: null },
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
          insert: (rows: unknown) =>
            table === 'categories'
              ? Promise.resolve({ error: null })
              : {
                  select: () => ({
                    single: async () => ({ data: { id: 'u-ใหม่' }, error: null }),
                  }),
                  then: undefined,
                  rows,
                },
        }) as never
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensureEmailIngestToken).mockResolvedValue('token');
  });

  it('ผู้ใช้ใหม่ได้ข้อความต้อนรับพร้อมการแจ้ง', async () => {
    mockSupabase({ existing: false });

    await handleFollow({ replyToken: 'rt1', source: { userId: 'Uline1' } });

    expect(replyText).toHaveBeenCalledWith('rt1', WELCOME_MESSAGE);
  });

  it('ผู้ใช้ที่แอดกลับมาใหม่ก็ได้เห็นการแจ้งอีกครั้ง', async () => {
    // คนที่เคยบล็อกแล้วกลับมาส่วนใหญ่ลืมไปแล้วว่าตกลงอะไรไว้
    mockSupabase({ existing: true });

    await handleFollow({ replyToken: 'rt2', source: { userId: 'Uline1' } });

    expect(replyText).toHaveBeenCalledWith('rt2', WELCOME_MESSAGE);
  });

  it('ไม่มี replyToken ก็ไม่พัง แค่ข้ามข้อความต้อนรับ', async () => {
    mockSupabase({ existing: true });

    await expect(handleFollow({ source: { userId: 'Uline1' } })).resolves.toBeUndefined();
    expect(replyText).not.toHaveBeenCalled();
  });

  it('ไม่มี userId → ไม่ทำอะไรเลย', async () => {
    await handleFollow({ replyToken: 'rt3', source: {} });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(replyText).not.toHaveBeenCalled();
  });
});
