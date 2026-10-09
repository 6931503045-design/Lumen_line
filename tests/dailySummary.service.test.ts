// ไฟล์นี้ทำหน้าที่อะไร: test งานสรุปรายวัน (FR-17 + S7 dailySummary)
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G3, G7
//
// สิ่งที่ต้องพิสูจน์: ส่งเฉพาะคนที่เปิดรับ, โควตาเต็มแล้วไม่ส่ง,
// รันซ้ำในวันเดียวกันส่งครั้งเดียว, และคนหนึ่งพังไม่ลากคนอื่นพังตาม

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/supabase', () => ({ supabase: {} }));
vi.mock('../src/db/queries/users', () => ({ listDailySummaryUserIds: vi.fn() }));
vi.mock('../src/db/queries/summary', () => ({ listTransactionRowsInRange: vi.fn() }));
vi.mock('../src/db/queries/emails', () => ({ countUnparsedEmails: vi.fn() }));
vi.mock('../src/services/summary.service', () => ({ getSafeToSpend: vi.fn() }));
vi.mock('../src/line/push', () => ({ sendPush: vi.fn() }));

import { listDailySummaryUserIds } from '../src/db/queries/users';
import { listTransactionRowsInRange } from '../src/db/queries/summary';
import { countUnparsedEmails } from '../src/db/queries/emails';
import { getSafeToSpend } from '../src/services/summary.service';
import { sendPush } from '../src/line/push';
import { dailySummaryMessage, sendDailySummaries } from '../src/services/dailySummary.service';

const TODAY = '2026-09-17';
const NOW = new Date('2026-09-17T14:00:00Z'); // 21:00 ไทย

function row(type: 'income' | 'expense' | 'transfer', amount: string) {
  return { type, amount, occurred_at: '2026-09-17T05:00:00Z', category_id: null };
}

function safe(monthRemainingSatang: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { monthRemainingSatang } as any;
}

function sentText(callIndex = 0): string {
  return vi.mocked(sendPush).mock.calls[callIndex]![3];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listDailySummaryUserIds).mockResolvedValue([]);
  vi.mocked(listTransactionRowsInRange).mockResolvedValue([]);
  vi.mocked(countUnparsedEmails).mockResolvedValue(0);
  vi.mocked(getSafeToSpend).mockResolvedValue(safe(110000));
  vi.mocked(sendPush).mockResolvedValue({ sent: true });
});

describe('sendDailySummaries — ใครได้รับ', () => {
  it('ไม่มีใครเปิดรับ → ไม่ดึงยอด ไม่ push', async () => {
    const result = await sendDailySummaries(TODAY, NOW);
    expect(result).toEqual({ usersChecked: 0, pushed: 0, pushSkipped: 0, failed: 0 });
    expect(listTransactionRowsInRange).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('ส่งให้ทุกคนที่เปิดรับ ด้วย kind dailySummary และ dedup_key ผูกกับวันที่ + ผู้ใช้', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1', 'u2']);

    const result = await sendDailySummaries(TODAY, NOW);

    expect(result.pushed).toBe(2);
    expect(sendPush).toHaveBeenCalledWith('u1', 'dailySummary', 'daily:2026-09-17:u1', expect.any(String));
    expect(sendPush).toHaveBeenCalledWith('u2', 'dailySummary', 'daily:2026-09-17:u2', expect.any(String));
  });

  it('ดึงรายการเฉพาะวันนี้ตามเวลาไทย [วันนี้, พรุ่งนี้)', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1']);
    await sendDailySummaries(TODAY, NOW);
    expect(listTransactionRowsInRange).toHaveBeenCalledWith('u1', '2026-09-17', '2026-09-18');
    expect(getSafeToSpend).toHaveBeenCalledWith('u1', '2026-09-17');
  });
});

describe('sendDailySummaries — กันซ้ำและโควตา', () => {
  it('🔴 รันซ้ำวันเดียวกัน → ใช้ dedup_key เดิม ผู้ใช้ได้ข้อความครั้งเดียว', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1']);
    // รอบสองชน unique ของ push_log ใน sendPush
    vi.mocked(sendPush)
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: 'duplicate' });

    const first = await sendDailySummaries(TODAY, NOW);
    const second = await sendDailySummaries(TODAY, NOW);

    expect(first.pushed).toBe(1);
    expect(second).toMatchObject({ pushed: 0, pushSkipped: 1 });
    const keys = vi.mocked(sendPush).mock.calls.map((call) => call[2]);
    expect(keys).toEqual(['daily:2026-09-17:u1', 'daily:2026-09-17:u1']);
  });

  it('วันใหม่ได้ dedup_key ใหม่ → ส่งได้อีก', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1']);
    await sendDailySummaries('2026-09-18', new Date('2026-09-18T14:00:00Z'));
    expect(vi.mocked(sendPush).mock.calls[0]![2]).toBe('daily:2026-09-18:u1');
  });

  it('🔴 โควตาเต็ม → ไม่ส่ง และหยุดดึงยอดของคนที่เหลือ', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1', 'u2', 'u3']);
    vi.mocked(sendPush).mockResolvedValue({ sent: false, reason: 'quota' });

    const result = await sendDailySummaries(TODAY, NOW);

    expect(result).toEqual({ usersChecked: 1, pushed: 0, pushSkipped: 3, failed: 0 });
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(listTransactionRowsInRange).toHaveBeenCalledTimes(1);
  });

  it('ผู้ใช้บล็อกบอท → ข้ามคนนั้น แต่ส่งคนถัดไปต่อ', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1', 'u2']);
    vi.mocked(sendPush)
      .mockResolvedValueOnce({ sent: false, reason: 'no-line-user' })
      .mockResolvedValueOnce({ sent: true });

    const result = await sendDailySummaries(TODAY, NOW);
    expect(result).toMatchObject({ pushed: 1, pushSkipped: 1 });
  });

  it('ผู้ใช้หนึ่งคนดึงยอดพัง → นับ failed แล้วไปต่อ', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1', 'u2']);
    vi.mocked(listTransactionRowsInRange)
      .mockRejectedValueOnce(new Error('DB ล่ม'))
      .mockResolvedValueOnce([]);

    const result = await sendDailySummaries(TODAY, NOW);
    expect(result).toMatchObject({ usersChecked: 2, pushed: 1, failed: 1 });
  });
});

describe('ข้อความสรุป', () => {
  it('รวมยอดวันนี้เป็นสตางค์ และ ⚖️ G7 ไม่นับ transfer', async () => {
    vi.mocked(listDailySummaryUserIds).mockResolvedValue(['u1']);
    vi.mocked(listTransactionRowsInRange).mockResolvedValue([
      row('expense', '45.50'),
      row('expense', '120.00'),
      row('income', '1000.00'),
      row('transfer', '300.00'),
    ]);

    await sendDailySummaries(TODAY, NOW);

    const text = sentText();
    expect(text).toContain('รายจ่าย ฿165.50 (2 รายการ)');
    expect(text).toContain('รายรับ ฿1,000');
    expect(text).not.toContain('300');
  });

  it('วันที่ยังไม่ได้จดอะไรเลย → ชวนให้จด', () => {
    const text = dailySummaryMessage('17 ก.ย. 2569', {
      incomeSatang: 0,
      expenseSatang: 0,
      expenseCount: 0,
      monthRemainingSatang: 110000,
      unparsedEmails: 0,
    });
    expect(text).toContain('ยังไม่ได้จดรายการ');
    expect(text).not.toContain('รายจ่าย');
  });

  it('ยอดเดือนนี้ยังเหลือ / ใช้เกินแล้ว แสดงต่างกัน', () => {
    const base = { incomeSatang: 0, expenseSatang: 5000, expenseCount: 1, unparsedEmails: 0 };
    expect(dailySummaryMessage('x', { ...base, monthRemainingSatang: 110000 })).toContain(
      'เดือนนี้เหลือใช้ได้อีก ฿1,100'
    );
    expect(dailySummaryMessage('x', { ...base, monthRemainingSatang: -25000 })).toContain(
      'เดือนนี้ใช้เกินไปแล้ว ฿250'
    );
  });

  it('มีอีเมลที่อ่านไม่ออก → แจ้งจำนวน (SPEC §S8)', () => {
    const text = dailySummaryMessage('x', {
      incomeSatang: 0,
      expenseSatang: 0,
      expenseCount: 0,
      monthRemainingSatang: 0,
      unparsedEmails: 2,
    });
    expect(text).toContain('อีเมลธนาคาร 2 ฉบับ');
  });

  it('บอกวิธีปิดทุกข้อความ', () => {
    const text = dailySummaryMessage('x', {
      incomeSatang: 0,
      expenseSatang: 0,
      expenseCount: 0,
      monthRemainingSatang: 0,
      unparsedEmails: 0,
    });
    expect(text).toContain('ปิดสรุปรายวันได้ที่หน้าเว็บ');
  });
});
