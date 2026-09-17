// ไฟล์นี้ทำหน้าที่อะไร: test โควตา push และการกันส่งซ้ำ (S13)
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W2
// ⚖️ กฎเหล็ก G6
//
// สิ่งที่ต้องพิสูจน์: ส่งไม่เกินโควตา, กันข้อความซ้ำ, และลำดับการทำงาน
// (จองสิทธิ์ก่อนยิง LINE ไม่ใช่หลัง) ซึ่งเป็นจุดที่ทำผิดแล้วผู้ใช้จะได้ข้อความซ้ำ

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/push', () => ({
  claimPushSlot: vi.fn(),
  releasePushSlot: vi.fn(),
  countPushSince: vi.fn(),
  deletePushLogsBefore: vi.fn(),
}));
vi.mock('../src/db/queries/users', () => ({ getLineUserId: vi.fn() }));
vi.mock('../src/line/client', () => ({ lineClient: { pushMessage: vi.fn() } }));

import { claimPushSlot, countPushSince, releasePushSlot } from '../src/db/queries/push';
import { getLineUserId } from '../src/db/queries/users';
import { lineClient } from '../src/line/client';
import { sendPush } from '../src/line/push';
import { checkPushQuota } from '../src/services/quota.service';
import { PUSH_LIMIT } from '../src/config/constants';

const USER = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(countPushSince).mockResolvedValue(0);
  vi.mocked(claimPushSlot).mockResolvedValue(true);
  vi.mocked(releasePushSlot).mockResolvedValue(undefined);
  vi.mocked(getLineUserId).mockResolvedValue('Uline123');
  vi.mocked(lineClient.pushMessage).mockResolvedValue(undefined as never);
});

describe('checkPushQuota — โควตา 280 ต่อเดือนทั้งช่องทาง', () => {
  it('ยังไม่ได้ใช้เลย → ส่งได้ทุกระดับ', async () => {
    await expect(checkPushQuota('dailySummary')).resolves.toMatchObject({ allowed: true });
    await expect(checkPushQuota('budgetOver')).resolves.toMatchObject({ allowed: true });
  });

  it('ใช้ครบโควตาแล้ว → ส่งไม่ได้แม้แต่เรื่องด่วน', async () => {
    vi.mocked(countPushSince).mockResolvedValue(PUSH_LIMIT);
    const decision = await checkPushQuota('budgetOver');
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
  });

  it('เหลือน้อยกว่า 20% → กันไว้ให้เรื่องด่วน สรุปรายวันส่งไม่ได้', async () => {
    vi.mocked(countPushSince).mockResolvedValue(PUSH_LIMIT - 10);
    await expect(checkPushQuota('dailySummary')).resolves.toMatchObject({ allowed: false });
    await expect(checkPushQuota('budgetWarning')).resolves.toMatchObject({ allowed: false });
    // ① งบเกิน และ ② แผน ยังส่งได้
    await expect(checkPushQuota('budgetOver')).resolves.toMatchObject({ allowed: true });
    await expect(checkPushQuota('planStatus')).resolves.toMatchObject({ allowed: true });
  });

  it('เหลือมากกว่า 20% → สรุปรายวันส่งได้', async () => {
    vi.mocked(countPushSince).mockResolvedValue(Math.floor(PUSH_LIMIT * 0.5));
    await expect(checkPushQuota('dailySummary')).resolves.toMatchObject({ allowed: true });
  });
});

describe('sendPush — ลำดับการทำงาน', () => {
  it('ส่งสำเร็จ: จองสิทธิ์ก่อน แล้วค่อยยิง LINE', async () => {
    const result = await sendPush(USER, 'budgetOver', 'budget100:2026-09:cat-1', 'เกินงบแล้ว');
    expect(result).toEqual({ sent: true });

    const claimOrder = vi.mocked(claimPushSlot).mock.invocationCallOrder[0]!;
    const pushOrder = vi.mocked(lineClient.pushMessage).mock.invocationCallOrder[0]!;
    // 🔴 ถ้ายิงก่อนจอง แล้ว cron รันพร้อมกันสองรอบ ผู้ใช้จะได้ข้อความซ้ำสองครั้ง
    expect(claimOrder).toBeLessThan(pushOrder);
  });

  it('โควตาหมด → ไม่จองสิทธิ์และไม่ยิง LINE', async () => {
    vi.mocked(countPushSince).mockResolvedValue(PUSH_LIMIT);
    const result = await sendPush(USER, 'budgetOver', 'k', 'x');
    expect(result).toEqual({ sent: false, reason: 'quota' });
    expect(claimPushSlot).not.toHaveBeenCalled();
    expect(lineClient.pushMessage).not.toHaveBeenCalled();
  });

  it('dedup_key ซ้ำ → ไม่ยิง LINE (เคยส่งไปแล้ว)', async () => {
    vi.mocked(claimPushSlot).mockResolvedValue(false);
    const result = await sendPush(USER, 'budgetOver', 'k', 'x');
    expect(result).toEqual({ sent: false, reason: 'duplicate' });
    expect(lineClient.pushMessage).not.toHaveBeenCalled();
  });

  it('ผู้ใช้บล็อกบอทไปแล้ว (ไม่มี line_user_id) → ไม่จองสิทธิ์ ไม่เปลืองโควตา', async () => {
    vi.mocked(getLineUserId).mockResolvedValue(null);
    const result = await sendPush(USER, 'budgetOver', 'k', 'x');
    expect(result).toEqual({ sent: false, reason: 'no-line-user' });
    expect(claimPushSlot).not.toHaveBeenCalled();
  });

  it('LINE API พัง → คืนสิทธิ์เพื่อให้รอบหน้าลองใหม่', async () => {
    vi.mocked(lineClient.pushMessage).mockRejectedValue(new Error('LINE ล่ม'));
    const result = await sendPush(USER, 'budgetOver', 'budget100:2026-09:cat-1', 'x');
    expect(result).toEqual({ sent: false, reason: 'error' });
    expect(releasePushSlot).toHaveBeenCalledWith('budget100:2026-09:cat-1');
  });

  it('คืนสิทธิ์ไม่สำเร็จก็ต้องไม่ throw ออกไปให้ผู้เรียกพัง', async () => {
    vi.mocked(lineClient.pushMessage).mockRejectedValue(new Error('LINE ล่ม'));
    vi.mocked(releasePushSlot).mockRejectedValue(new Error('DB ล่มด้วย'));
    await expect(sendPush(USER, 'budgetOver', 'k', 'x')).resolves.toEqual({
      sent: false,
      reason: 'error',
    });
  });

  it('⚖️ G6: ส่งด้วย line_user_id ที่ query จาก userId ไม่ใช่ค่าที่ผู้เรียกส่งมา', async () => {
    await sendPush(USER, 'budgetOver', 'k', 'ข้อความ');
    expect(getLineUserId).toHaveBeenCalledWith(USER);
    expect(lineClient.pushMessage).toHaveBeenCalledWith({
      to: 'Uline123',
      messages: [{ type: 'text', text: 'ข้อความ' }],
    });
  });
});
