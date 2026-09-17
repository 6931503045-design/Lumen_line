// ไฟล์นี้ทำหน้าที่อะไร: test งานบำรุงรักษารายวัน (S7 cleanup)
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W4
//
// สิ่งที่ต้องพิสูจน์: ขอบวันคิดตามเวลาไทย และ "ห้ามแตะ transactions"
// เพราะงานนี้เป็น job ที่ลบข้อมูลของผู้ใช้ทุกคน พลาดแล้วกู้ยาก

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/cleanup', () => ({
  expirePendingActions: vi.fn(),
  cancelStaleDraftPlans: vi.fn(),
  deleteOldWebhookEvents: vi.fn(),
  deleteOldAiUsageLogs: vi.fn(),
}));
vi.mock('../src/db/queries/push', () => ({ deletePushLogsBefore: vi.fn() }));

import {
  cancelStaleDraftPlans,
  deleteOldAiUsageLogs,
  deleteOldWebhookEvents,
  expirePendingActions,
} from '../src/db/queries/cleanup';
import { deletePushLogsBefore } from '../src/db/queries/push';
import { runCleanup } from '../src/services/cleanup.service';

const TODAY = '2026-09-17';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(expirePendingActions).mockResolvedValue(2);
  vi.mocked(cancelStaleDraftPlans).mockResolvedValue(3);
  vi.mocked(deleteOldWebhookEvents).mockResolvedValue(120);
  vi.mocked(deleteOldAiUsageLogs).mockResolvedValue(0);
  vi.mocked(deletePushLogsBefore).mockResolvedValue(5);
});

describe('runCleanup', () => {
  it('รายงานจำนวนที่จัดการไปครบทุกประเภท', async () => {
    await expect(runCleanup(TODAY)).resolves.toEqual({
      pendingExpired: 2,
      draftPlansCancelled: 3,
      webhookEventsDeleted: 120,
      aiLogsDeleted: 0,
      pushLogsDeleted: 5,
    });
  });

  it('webhook_events ลบของเก่ากว่า 7 วัน นับขอบวันตามเวลาไทย', async () => {
    await runCleanup(TODAY);
    expect(deleteOldWebhookEvents).toHaveBeenCalledWith('2026-09-10T00:00:00+07:00');
  });

  it('ai_usage_log ลบของเก่ากว่า 90 วัน', async () => {
    await runCleanup(TODAY);
    expect(deleteOldAiUsageLogs).toHaveBeenCalledWith('2026-06-19T00:00:00+07:00');
  });

  it('push_log เก็บนานกว่าหนึ่งเดือน ไม่งั้นนับโควตารายเดือนผิด', async () => {
    await runCleanup(TODAY);
    const cutoff = vi.mocked(deletePushLogsBefore).mock.calls[0]![0];
    // ต้องเก่ากว่า 31 วัน ไม่งั้นจะลบ log ของเดือนนี้ทิ้งแล้วโควตาเพี้ยน
    expect(cutoff < '2026-08-17').toBe(true);
  });

  it('ข้ามปีได้ถูกต้องตอนลบ log 90 วัน', async () => {
    await runCleanup('2026-01-15');
    expect(deleteOldAiUsageLogs).toHaveBeenCalledWith('2025-10-17T00:00:00+07:00');
  });

  it('🔒 ห้ามแตะ transactions — เงินของผู้ใช้ไม่มีวันหมดอายุ', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/db/queries/cleanup.ts', 'utf8')
    );
    expect(source).not.toContain("from('transactions')");
    expect(source).not.toContain("from('users')");
    expect(source).not.toContain("from('budgets')");
  });
});
