// ไฟล์นี้ทำหน้าที่อะไร: test ประตูกันอีเมลปลอม (DKIM) และการอ่าน token จากที่อยู่ปลายทาง
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W4
// อ้างอิง: SPEC.md §S8 "MUST ตรวจ DKIM ของโดเมนธนาคาร"
// ⚖️ กฎเหล็ก G6
//
// นี่คือจุดที่พลาดแล้วเจ็บที่สุดของ S8: ถ้าปล่อยอีเมลที่ DKIM ไม่ผ่านเข้ามาได้
// ใครที่รู้ที่อยู่ +token ก็ยิงรายการเงินปลอมเข้าบัญชีคนอื่นได้ทันที

import { describe, expect, it } from 'vitest';
import { checkBankDkim, extractIngestToken } from '../src/services/email/dkim';

const BANKS = ['kasikornbank.com', 'kbank.co.th'];

describe('checkBankDkim — ต้องผ่าน', () => {
  it('ลงนามโดยโดเมนธนาคารตรงๆ', () => {
    const header = 'mx.google.com; dkim=pass header.i=@kasikornbank.com; spf=fail';
    expect(checkBankDkim(header, BANKS).passed).toBe(true);
  });

  it('ใช้ header.d= แทน header.i= ก็ต้องอ่านได้', () => {
    const header = 'mx.google.com; dkim=pass header.d=kbank.co.th';
    expect(checkBankDkim(header, BANKS).passed).toBe(true);
  });

  it('โดเมนย่อยของธนาคารนับว่าผ่าน', () => {
    const header = 'mx.google.com; dkim=pass header.i=@mail.kbank.co.th';
    expect(checkBankDkim(header, BANKS).passed).toBe(true);
  });

  it('SPF ไม่ผ่านไม่เป็นไร เพราะการ forward ทำให้ SPF พังเป็นปกติ', () => {
    const header = 'mx.google.com; spf=fail smtp.mailfrom=someone@gmail.com; dkim=pass header.i=@kbank.co.th';
    expect(checkBankDkim(header, BANKS).passed).toBe(true);
  });

  it('มีหลายลายเซ็น ขอแค่ของธนาคารผ่านก็พอ', () => {
    const header = 'mx.google.com; dkim=pass header.i=@gmail.com; dkim=pass header.i=@kbank.co.th';
    expect(checkBankDkim(header, BANKS).passed).toBe(true);
  });
});

describe('checkBankDkim — ต้องไม่ผ่าน', () => {
  it('ไม่มี header เลย = ไม่ผ่าน (fail closed)', () => {
    expect(checkBankDkim(undefined, BANKS).passed).toBe(false);
  });

  it('dkim=fail', () => {
    const header = 'mx.google.com; dkim=fail header.i=@kbank.co.th';
    expect(checkBankDkim(header, BANKS).passed).toBe(false);
  });

  it('dkim=none', () => {
    expect(checkBankDkim('mx.google.com; dkim=none', BANKS).passed).toBe(false);
  });

  it('ผ่านแต่เป็นโดเมนอื่น — คนส่งอีเมลปลอมจากบัญชีตัวเอง', () => {
    const header = 'mx.google.com; dkim=pass header.i=@gmail.com';
    const result = checkBankDkim(header, BANKS);
    expect(result.passed).toBe(false);
    expect(result.signedBy).toContain('gmail.com');
  });

  it('โดเมนปลอมที่ลงท้ายคล้ายธนาคารต้องไม่ผ่าน', () => {
    // "evil-kbank.co.th" ไม่ใช่โดเมนย่อยของ "kbank.co.th" เพราะไม่มีจุดคั่น
    const header = 'mx.google.com; dkim=pass header.i=@evil-kbank.co.th';
    expect(checkBankDkim(header, BANKS).passed).toBe(false);
  });

  it('โดเมนที่เอาชื่อธนาคารไปต่อหน้าต้องไม่ผ่าน', () => {
    const header = 'mx.google.com; dkim=pass header.i=@kbank.co.th.attacker.com';
    expect(checkBankDkim(header, BANKS).passed).toBe(false);
  });
});

describe('extractIngestToken', () => {
  it('อ่าน token จากที่อยู่แบบ plus-addressing', () => {
    expect(extractIngestToken('jodtang+a1b2c3d4e5f6@gmail.com')).toBe('a1b2c3d4e5f6');
  });

  it('ที่อยู่มีชื่อผู้รับนำหน้าก็ยังอ่านได้', () => {
    expect(extractIngestToken('JOD tang <jodtang+deadbeef@gmail.com>')).toBe('deadbeef');
  });

  it('ไม่มี + = ไม่มี token', () => {
    expect(extractIngestToken('jodtang@gmail.com')).toBeNull();
  });

  it('ไม่มีที่อยู่เลย = null ไม่ใช่ error', () => {
    expect(extractIngestToken(undefined)).toBeNull();
  });
});
