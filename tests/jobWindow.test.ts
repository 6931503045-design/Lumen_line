// ไฟล์นี้ทำหน้าที่อะไร: test ช่วงเวลาที่งานตามเวลายอมส่ง push (JOB_WINDOWS)
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G4
//
// บั๊กที่เจอจริง (31 ต.ค.–8 พ.ย. 2026): GitHub Actions ยิงรอบ dailySummary 21:00 ช้าไปถึง
// 01:30–04:00 ของวันถัดไป ผู้ใช้ได้สรุป "วันนี้" ตอนตีสามซึ่งเป็นยอดของวันใหม่ (เกือบศูนย์)
// เวลาในเทสต์เป็น UTC เพราะเซิร์ฟเวอร์เป็น UTC — ไทย = UTC+7

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/dailySummary.service', () => ({ sendDailySummaries: vi.fn() }));
vi.mock('../src/services/planCheck.service', () => ({ checkActivePlans: vi.fn() }));

import { runDailySummaryJob } from '../src/jobs/dailySummary';
import { runPlanCheckJob } from '../src/jobs/planCheck';
import { sendDailySummaries } from '../src/services/dailySummary.service';
import { checkActivePlans } from '../src/services/planCheck.service';
import { getThaiHour, isWithinThaiHours } from '../src/utils/thaiDate';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendDailySummaries).mockResolvedValue({ usersChecked: 0, pushed: 0, pushSkipped: 0, failed: 0 });
  vi.mocked(checkActivePlans).mockResolvedValue({} as never);
});

describe('getThaiHour / isWithinThaiHours', () => {
  it('แปลง UTC เป็นชั่วโมงไทย 0–23 (เที่ยงคืนเป็น 0 ไม่ใช่ 24)', () => {
    expect(getThaiHour(new Date('2026-11-07T14:00:00Z'))).toBe(21);
    expect(getThaiHour(new Date('2026-11-07T16:59:00Z'))).toBe(23);
    expect(getThaiHour(new Date('2026-11-07T17:00:00Z'))).toBe(0);
    expect(getThaiHour(new Date('2026-11-07T20:17:00Z'))).toBe(3);
  });

  it('ช่วงเป็น [start, end) — รวมต้น ไม่รวมปลาย', () => {
    const window = { startHour: 8, endHour: 21 };
    expect(isWithinThaiHours(window, new Date('2026-11-07T01:00:00Z'))).toBe(true); // 08:00
    expect(isWithinThaiHours(window, new Date('2026-11-07T00:59:00Z'))).toBe(false); // 07:59
    expect(isWithinThaiHours(window, new Date('2026-11-07T13:59:00Z'))).toBe(true); // 20:59
    expect(isWithinThaiHours(window, new Date('2026-11-07T14:00:00Z'))).toBe(false); // 21:00
  });
});

describe('dailySummary — ส่งได้ 20:00–23:59 ไทย และสรุปวันนั้นเท่านั้น', () => {
  it('21:00 ตรงเวลา → สรุปของวันนี้', async () => {
    const now = new Date('2026-11-07T14:00:00Z');
    await runDailySummaryJob(now);
    expect(sendDailySummaries).toHaveBeenCalledWith('2026-11-07', now);
  });

  it('23:59 (ช้าแต่ยังไม่ข้ามวัน) → ยังสรุปของวันนี้', async () => {
    const now = new Date('2026-11-07T16:59:00Z');
    await runDailySummaryJob(now);
    expect(sendDailySummaries).toHaveBeenCalledWith('2026-11-07', now);
  });

  it('03:17 ของวันถัดไป (เวลาที่ GitHub ยิงมาจริง) → ข้าม ไม่ส่งสรุปของวันใหม่ที่เพิ่งเริ่ม', async () => {
    const result = await runDailySummaryJob(new Date('2026-11-07T20:17:00Z'));
    expect(sendDailySummaries).not.toHaveBeenCalled();
    expect(result).toEqual({
      skipped: 'outside_window',
      thaiHour: 3,
      window: { startHour: 20, endHour: 24 },
    });
  });

  it('00:00 พอดี → ข้าม (วันเปลี่ยนแล้ว)', async () => {
    await runDailySummaryJob(new Date('2026-11-07T17:00:00Z'));
    expect(sendDailySummaries).not.toHaveBeenCalled();
  });

  it('19:59 → ข้าม (วันยังไม่จบ)', async () => {
    await runDailySummaryJob(new Date('2026-11-07T12:59:00Z'));
    expect(sendDailySummaries).not.toHaveBeenCalled();
  });

  it('กดรันเองตอนเช้า (workflow_dispatch) → ข้าม ไม่ไปจองโควตาของวันนี้ก่อนเวลา', async () => {
    await runDailySummaryJob(new Date('2026-11-07T03:00:00Z')); // 10:00
    expect(sendDailySummaries).not.toHaveBeenCalled();
  });
});

describe('planCheck — ทำงาน 08:00–20:59 ไทย', () => {
  it('09:00 ตรงเวลา → ตรวจด้วยวันที่ไทยของวันนั้น', async () => {
    const now = new Date('2026-11-07T02:00:00Z');
    await runPlanCheckJob(now);
    expect(checkActivePlans).toHaveBeenCalledWith('2026-11-07', now);
  });

  it('15:00 (เวลาที่ GitHub ยิงมาจริง) → ยังทำงาน', async () => {
    await runPlanCheckJob(new Date('2026-11-07T08:00:00Z'));
    expect(checkActivePlans).toHaveBeenCalledTimes(1);
  });

  it('กลางคืน → ข้ามทั้งรอบ ไม่มี push เด้งตอนผู้ใช้นอน', async () => {
    for (const iso of ['2026-11-07T14:00:00Z', '2026-11-07T20:00:00Z', '2026-11-07T00:59:00Z']) {
      const result = await runPlanCheckJob(new Date(iso));
      expect(result).toMatchObject({ skipped: 'outside_window' });
    }
    expect(checkActivePlans).not.toHaveBeenCalled();
  });
});
