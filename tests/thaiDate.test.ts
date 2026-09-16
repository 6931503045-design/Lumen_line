// ไฟล์นี้ทำหน้าที่อะไร: test วันที่ภาษาไทยและ timezone Asia/Bangkok
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W2
// TODO: เพิ่ม test map ของ "วันนี้", "เมื่อวาน", "3 วันก่อน" เมื่อเขียน parser แล้ว
// ⚖️ กฎเหล็ก G5

import { describe, expect, it } from 'vitest';
import {
  formatThaiDate,
  getTodayIso,
  normalizeMonthIso,
  shiftMonthStartIso,
} from '../src/utils/thaiDate';

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

describe('shiftMonthStartIso', () => {
  it('เลื่อนไปเดือนถัดไปในปีเดียวกัน', () => {
    expect(shiftMonthStartIso('2026-09-01', 1)).toBe('2026-10-01');
  });

  it('ข้ามปีตอนธันวาคม → มกราคม', () => {
    expect(shiftMonthStartIso('2026-12-01', 1)).toBe('2027-01-01');
  });

  it('ถอยหลังข้ามปีตอนมกราคม → ธันวาคมปีก่อน', () => {
    expect(shiftMonthStartIso('2026-01-01', -1)).toBe('2025-12-01');
  });

  it('รับรูปแบบ YYYY-MM ได้ด้วย และคืนวันที่ 1 เสมอ', () => {
    expect(shiftMonthStartIso('2026-09', 0)).toBe('2026-09-01');
  });

  it('เลื่อนทีละหลายเดือนได้', () => {
    expect(shiftMonthStartIso('2026-09-01', 5)).toBe('2027-02-01');
  });

  it('รูปแบบไม่ถูกต้อง → throw ไม่ใช่คืนค่ามั่ว', () => {
    expect(() => shiftMonthStartIso('2026-13-01', 1)).toThrow();
    expect(() => shiftMonthStartIso('ไม่ใช่เดือน', 1)).toThrow();
  });
});

describe('normalizeMonthIso', () => {
  it('รับ YYYY-MM และ YYYY-MM-DD ได้ คืนวันที่ 1 เสมอ', () => {
    expect(normalizeMonthIso('2026-09')).toBe('2026-09-01');
    expect(normalizeMonthIso('2026-09-27')).toBe('2026-09-01');
  });

  it('ตัดช่องว่างหัวท้ายให้', () => {
    expect(normalizeMonthIso('  2026-09  ')).toBe('2026-09-01');
  });

  it('คืน null เมื่อเดือนอยู่นอกช่วง 01-12 หรือรูปแบบผิด', () => {
    expect(normalizeMonthIso('2026-00')).toBeNull();
    expect(normalizeMonthIso('2026-13')).toBeNull();
    expect(normalizeMonthIso('26-09')).toBeNull();
    expect(normalizeMonthIso("2026-09'; drop table budgets; --")).toBeNull();
  });
});
