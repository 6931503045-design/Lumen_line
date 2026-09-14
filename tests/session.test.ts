// ไฟล์นี้ทำหน้าที่อะไร: test การเซ็น/ตรวจ session cookie ของเว็บ
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G6
//
// นี่คือจุดที่พลาดแล้วเจ็บที่สุดของการย้ายมาเป็นเว็บ: ถ้าปลอม cookie ได้
// ก็สวมเป็นผู้ใช้คนไหนก็ได้ทันที ทุกเทสในไฟล์นี้จึงเป็นเรื่อง "ของปลอมต้องไม่ผ่าน"

import { describe, expect, it } from 'vitest';
import {
  createSessionValue,
  readCookie,
  readSessionValue,
  SESSION_MAX_AGE_SECONDS,
} from '../src/utils/session';

const SECRET = 'test-secret-do-not-use-in-production';
const NOW = Date.parse('2026-09-14T10:00:00Z');

describe('createSessionValue / readSessionValue — ทางปกติ', () => {
  it('เซ็นแล้วอ่านกลับได้ค่าเดิม', () => {
    const value = createSessionValue({ uid: 'u1', name: 'สมชาย', picture: 'https://x/y.jpg' }, SECRET, NOW);
    const session = readSessionValue(value, SECRET, NOW);

    expect(session).toMatchObject({ uid: 'u1', name: 'สมชาย', picture: 'https://x/y.jpg' });
  });

  it('ตั้งวันหมดอายุตาม SESSION_MAX_AGE_SECONDS', () => {
    const value = createSessionValue({ uid: 'u1' }, SECRET, NOW);
    const session = readSessionValue(value, SECRET, NOW);

    expect(session?.exp).toBe(Math.floor(NOW / 1000) + SESSION_MAX_AGE_SECONDS);
  });

  it('ไม่มีชื่อหรือรูปก็ยังใช้ได้', () => {
    const value = createSessionValue({ uid: 'u1' }, SECRET, NOW);
    expect(readSessionValue(value, SECRET, NOW)?.uid).toBe('u1');
  });
});

describe('readSessionValue — ของปลอมต้องไม่ผ่าน', () => {
  it('ลายเซ็นถูกแก้', () => {
    const value = createSessionValue({ uid: 'u1' }, SECRET, NOW);
    const tampered = `${value.slice(0, -1)}${value.at(-1) === 'a' ? 'b' : 'a'}`;

    expect(readSessionValue(tampered, SECRET, NOW)).toBeNull();
  });

  it('payload ถูกแก้ให้เป็น user คนอื่น แต่ลายเซ็นเดิม', () => {
    const value = createSessionValue({ uid: 'u1' }, SECRET, NOW);
    const [, signature] = value.split('.') as [string, string];
    const forgedPayload = Buffer.from(
      JSON.stringify({ uid: 'เหยื่อ', exp: Math.floor(NOW / 1000) + 999 })
    ).toString('base64url');

    expect(readSessionValue(`${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('เซ็นด้วยกุญแจอื่น', () => {
    const value = createSessionValue({ uid: 'u1' }, 'กุญแจของคนอื่น', NOW);
    expect(readSessionValue(value, SECRET, NOW)).toBeNull();
  });

  it('หมดอายุแล้ว', () => {
    const value = createSessionValue({ uid: 'u1' }, SECRET, NOW);
    const afterExpiry = NOW + (SESSION_MAX_AGE_SECONDS + 1) * 1000;

    expect(readSessionValue(value, SECRET, afterExpiry)).toBeNull();
  });

  it('ไม่มีค่าเลย', () => {
    expect(readSessionValue(undefined, SECRET, NOW)).toBeNull();
  });

  it('รูปแบบมั่ว', () => {
    expect(readSessionValue('ไม่ใช่-cookie-ของเรา', SECRET, NOW)).toBeNull();
  });

  it('payload ไม่ใช่ JSON', () => {
    const encoded = Buffer.from('ไม่ใช่ json').toString('base64url');
    expect(readSessionValue(`${encoded}.อะไรก็ไม่รู้`, SECRET, NOW)).toBeNull();
  });

  it('ไม่มี uid ใน payload', () => {
    const value = createSessionValue({ uid: '' }, SECRET, NOW);
    expect(readSessionValue(value, SECRET, NOW)).toBeNull();
  });

  it('ยังไม่ได้ตั้ง SESSION_SECRET = ไม่ผ่านทุกกรณี (fail closed)', () => {
    const value = createSessionValue({ uid: 'u1' }, SECRET, NOW);
    expect(readSessionValue(value, '', NOW)).toBeNull();
  });
});

describe('readCookie', () => {
  it('อ่าน cookie ที่ต้องการจากหลายตัว', () => {
    expect(readCookie('a=1; jodtang_session=abc.def; b=2', 'jodtang_session')).toBe('abc.def');
  });

  it('ชื่อไม่ตรงคืน undefined ไม่ใช่ค่าของตัวอื่น', () => {
    expect(readCookie('a=1; b=2', 'jodtang_session')).toBeUndefined();
  });

  it('ชื่อที่เป็นส่วนหนึ่งของชื่ออื่นต้องไม่ถูกจับผิดตัว', () => {
    expect(readCookie('xjodtang_session=ของคนอื่น', 'jodtang_session')).toBeUndefined();
  });

  it('ไม่มี header เลย', () => {
    expect(readCookie(undefined, 'jodtang_session')).toBeUndefined();
  });

  it('ถอด URL encoding ให้', () => {
    expect(readCookie('name=%E0%B8%AA%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B5', 'name')).toBe('สวัสดี');
  });
});
