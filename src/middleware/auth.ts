// ไฟล์นี้ทำหน้าที่อะไร: ตรวจ session cookie ของเว็บ แล้วแปะ user_id ให้ route ใช้ต่อ
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G6 — user_id มาจาก cookie ที่เราเซ็นเองเท่านั้น ห้ามรับจาก query/body
//
// ไฟล์นี้มาแทน middleware/liffAuth.ts เดิม
// สิ่งที่เปลี่ยน: เดิมหน้าเว็บแนบ LIFF ID token มาทุก request แล้วเราส่งไปถาม LINE ทุกครั้ง
// ตอนนี้ถาม LINE ครั้งเดียวตอนล็อกอิน (routes/auth.ts) แล้วออก cookie ที่เซ็นเองไว้ใช้ต่อ
// ผลคือเร็วขึ้นมากและไม่ต้องพึ่งเน็ตออกนอกทุกครั้งที่โหลดหน้า
//
// สิ่งที่ไม่เปลี่ยน: ผู้ใช้ต้องเคยแอดเพื่อนบอทมาก่อนถึงจะมีแถวใน users
// คนที่ล็อกอิน LINE ได้แต่ไม่เคยแอดบอทจะไม่ได้ session ตั้งแต่ตอน callback แล้ว

import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { readCookie, readSessionValue, SESSION_COOKIE_NAME } from '../utils/session';

export type AuthedRequest = Request & {
  /** users.id ภายในระบบ — มีค่าเสมอหลังผ่าน requireSession */
  userId?: string;
  displayName?: string;
  pictureUrl?: string;
};

/** เมธอดที่เปลี่ยนแปลงข้อมูล ต้องเช็ค Origin เพิ่มอีกชั้น */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * กัน CSRF สองชั้น:
 *   1. cookie เป็น SameSite=Lax อยู่แล้ว เบราว์เซอร์จึงไม่แนบ cookie ให้ POST ข้ามเว็บ
 *   2. ชั้นนี้เช็ค Origin ซ้ำ เผื่อเบราว์เซอร์เก่าที่ยังไม่รองรับ SameSite
 * request ที่ไม่มี Origin เลย (เช่น curl) ปล่อยผ่าน เพราะไม่ใช่การโจมตีข้ามเว็บจากเบราว์เซอร์
 */
function originAllowed(req: Request): boolean {
  if (!STATE_CHANGING_METHODS.has(req.method)) return true;

  const origin = req.header('origin');
  if (!origin) return true;
  return origin === env.appBaseUrl;
}

export function requireSession(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!env.sessionSecret) {
    console.error('[auth] ปฏิเสธ request เพราะยังไม่ได้ตั้ง SESSION_SECRET');
    res.status(503).json({ ok: false, error: 'ยังไม่ได้ตั้งค่าระบบล็อกอิน' });
    return;
  }

  if (!originAllowed(req)) {
    res.status(403).json({ ok: false, error: 'origin ไม่ถูกต้อง' });
    return;
  }

  const raw = readCookie(req.header('cookie'), SESSION_COOKIE_NAME);
  const session = readSessionValue(raw, env.sessionSecret);

  if (!session) {
    res.status(401).json({ ok: false, error: 'ยังไม่ได้ล็อกอิน' });
    return;
  }

  req.userId = session.uid;
  req.displayName = session.name;
  req.pictureUrl = session.picture;
  next();
}
