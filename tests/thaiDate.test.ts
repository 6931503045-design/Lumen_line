// ไฟล์นี้ทำหน้าที่อะไร: test วันที่ภาษาไทยและ timezone Asia/Bangkok
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W2
// TODO: เพิ่ม test map ของ "วันนี้", "เมื่อวาน", "3 วันก่อน" เมื่อเขียน parser แล้ว
// ⚖️ กฎเหล็ก G5

import { describe, expect, it } from 'vitest';
import { formatThaiDate, getTodayIso } from '../src/utils/thaiDate';

describe('getTodayIso', () => {
  it('คืนรูปแบบ ISO YYYY-MM-DD (ค.ศ.) ที่ Postgres รับได้', () => {
    expect(getTodayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ใช้เวลาไทยไม่ใช่ UTC — 17:00 UTC คือวันถัดไปแล้วที่กรุงเทพ', () => {
    // 2026-09-14T17:30:00Z = 2026-09-15 00:30 ตามเวลาไทย (UTC+7)
    expect(getTodayIso(new Date('2026-09-14T17:30:00Z'))).toBe('2026-09-15');
  });

  it('ก่อน 17:00 UTC ยังเป็นวันเดิมตามเวลาไทย', () => {
    expect(getTodayIso(new Date('2026-09-14T16:59:00Z'))).toBe('2026-09-14');
  });

  it('เรียงลำดับแบบ string ได้ถูกต้อง (คุณสมบัติสำคัญของรูปแบบ ISO)', () => {
    const earlier = getTodayIso(new Date('2026-01-05T03:00:00Z'));
    const later = getTodayIso(new Date('2026-11-20T03:00:00Z'));
    expect(earlier < later).toBe(true);
  });
});

describe('formatThaiDate', () => {
  it('คืนปี พ.ศ. สำหรับแสดงผล (ค.ศ. 2026 = พ.ศ. 2569)', () => {
    expect(formatThaiDate(new Date('2026-09-14T03:00:00Z'))).toContain('2569');
  });

  it('ไม่ใช่รูปแบบ ISO — กันเผลอเอาไปเขียนลง DB', () => {
    expect(formatThaiDate(new Date('2026-09-14T03:00:00Z'))).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
