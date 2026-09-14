// ไฟล์นี้ทำหน้าที่อะไร: เซ็น/ตรวจ session cookie ของเว็บ และอ่าน cookie จาก header
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W5 (ตอนย้ายจาก LIFF มาเป็นเว็บธรรมดา)
// ⚖️ กฎเหล็ก G6
//
// ทำไมเขียนเอง ไม่ใช้ express-session: session ของเราเก็บแค่ user_id กับชื่อ/รูปไม่กี่ไบต์
// และไม่ต้องการ session store (Redis/DB) การเซ็น payload แล้วฝากไว้ใน cookie จบในตัว
// ไม่ต้องมี state ฝั่งเซิร์ฟเวอร์ ซึ่งเหมาะกับ backend ที่รันหลาย instance หรือหลับแล้วตื่นใหม่
//
// ⚠️ ข้อแลกเปลี่ยนที่ต้องรู้: session แบบนี้ "ยกเลิกทีละคนไม่ได้" เพราะเซิร์ฟเวอร์ไม่ได้จำไว้
// ถ้าต้องเตะทุกคนออกพร้อมกันให้เปลี่ยน SESSION_SECRET ซึ่งทำให้ลายเซ็นเดิมใช้ไม่ได้ทั้งหมด
//
// payload ไม่ได้ถูกเข้ารหัส แค่เซ็น — ใครเปิดดูก็เห็นชื่อกับ user id ได้
// จึงห้ามใส่อะไรที่เป็นความลับลงไป (ห้ามใส่ token ของ LINE เด็ดขาด)

import { createHmac, timingSafeEqual } from 'node:crypto';

/** อายุ session — ต้องล็อกอินใหม่เมื่อครบ */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 วัน

export const SESSION_COOKIE_NAME = 'jodtang_session';

export type SessionPayload = {
  /** users.id ภายในระบบ */
  uid: string;
  /** ชื่อที่แสดงบนหน้าเว็บ มาจาก id_token ของ LINE */
  name?: string;
  /** URL รูปโปรไฟล์ */
  picture?: string;
  /** เวลาหมดอายุ (unix seconds) */
  exp: number;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

/** เทียบลายเซ็นแบบ timing-safe กันการเดาทีละไบต์จากเวลาที่ใช้ตอบ */
function signaturesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** สร้างค่า cookie จาก payload — คืนรูปแบบ "<payload>.<signature>" */
export function createSessionValue(
  payload: Omit<SessionPayload, 'exp'>,
  secret: string,
  nowMs: number = Date.now()
): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = base64url(JSON.stringify(full));
  return `${encoded}.${sign(encoded, secret)}`;
}

/**
 * ตรวจค่า cookie คืน payload ถ้าลายเซ็นถูกและยังไม่หมดอายุ
 * คืน null ทุกกรณีที่ไม่ผ่าน — ผู้เรียกถือว่ายังไม่ได้ล็อกอิน
 */
export function readSessionValue(
  value: string | undefined,
  secret: string,
  nowMs: number = Date.now()
): SessionPayload | null {
  if (!value || !secret) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const encoded = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  if (!signaturesMatch(signature, sign(encoded, secret))) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof payload?.uid !== 'string' || !payload.uid) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= nowMs) return null;

  return payload;
}

/**
 * อ่าน cookie ตัวเดียวจาก header `Cookie`
 * เขียนเองแทน cookie-parser เพราะต้องการแค่ฟังก์ชันเดียวและไม่อยากเพิ่ม dependency
 */
export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined; // ค่าเพี้ยน ถือว่าไม่มี cookie
    }
  }
  return undefined;
}
