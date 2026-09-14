// ไฟล์นี้ทำหน้าที่อะไร: ตรวจ LIFF ID token เพื่อให้แน่ใจว่า request มาจากผู้ใช้ LINE ตัวจริง
// ใครรับผิดชอบ: ④ Frontend / ① Bot Core
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G6 — user_id ต้องมาจาก token ที่ LINE เซ็นเท่านั้น ห้ามรับจาก query string / body
//
// ทำไมต้องมี: ก่อนหน้านี้ /api/* เปิดให้ใครก็เรียกได้และคืน mock ก้อนเดียวกันหมด
// วันที่ต่อข้อมูลจริงโดยไม่มีชั้นนี้ = ทุกคนเห็นเงินของคนอื่น
//
// วิธีตรวจ: ส่ง id_token ไปให้ LINE ยืนยันที่ /oauth2/v2.1/verify พร้อม client_id
// LINE จะตรวจลายเซ็น, วันหมดอายุ และว่า token ออกให้ channel นี้จริงไหม แล้วคืน payload
// ที่มี `sub` = LINE user id — เราไม่ถอด JWT เองเพราะการตรวจลายเซ็นเองมีโอกาสพลาดสูง
//
// ⚠️ ผู้ใช้ต้องเคยแอดเพื่อนบอทมาก่อน (มีแถวใน users) ถึงจะเรียก API ได้
// เพราะ user_id ภายในระบบถูกสร้างตอน follow event เท่านั้น

import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { getUserIdByLineUserId } from '../db/queries/users';

const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

/** timeout ตอนเรียก LINE — ถ้าช้ากว่านี้ถือว่าล้มเหลว ดีกว่าปล่อยให้ request ค้าง */
const VERIFY_TIMEOUT_MS = 5000;

/** เก็บผลตรวจ token ไว้ชั่วคราว กันยิงถาม LINE ซ้ำทุก request ระหว่างเปิดหน้า LIFF หน้าเดียว */
const MAX_CACHE_ENTRIES = 500;
const tokenCache = new Map<string, { userId: string; expiresAtMs: number }>();

export type AuthedRequest = Request & {
  /** users.id ภายในระบบ — มีค่าเสมอหลังผ่าน liffAuth */
  userId?: string;
  lineUserId?: string;
};

type VerifyPayload = { sub?: string; exp?: number };

function rememberToken(token: string, userId: string, expiresAtMs: number): void {
  // ตัดตัวเก่าสุดทิ้งเมื่อเต็ม (Map ของ JS จำลำดับการใส่ไว้ให้อยู่แล้ว)
  if (tokenCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = tokenCache.keys().next();
    if (!oldest.done) tokenCache.delete(oldest.value);
  }
  tokenCache.set(token, { userId, expiresAtMs });
}

function readCachedUserId(token: string): string | null {
  const cached = tokenCache.get(token);
  if (!cached) return null;
  if (cached.expiresAtMs <= Date.now()) {
    tokenCache.delete(token);
    return null;
  }
  return cached.userId;
}

/** ให้ LINE ยืนยัน id_token คืน payload ถ้าใช้ได้ คืน null ถ้าไม่ผ่านหรือเรียกไม่สำเร็จ */
async function verifyIdToken(idToken: string): Promise<VerifyPayload | null> {
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: env.lineLoginChannelId }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      // 400 = token ปลอม/หมดอายุ/ผิด channel ซึ่งเป็นเรื่องปกติ ไม่ใช่ error ของเรา
      console.warn('[liffAuth] LINE ปฏิเสธ id_token:', response.status);
      return null;
    }
    return (await response.json()) as VerifyPayload;
  } catch (err) {
    console.error('[liffAuth] เรียก LINE verify ไม่สำเร็จ:', err);
    return null;
  }
}

export async function liffAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!env.lineLoginChannelId) {
    // fail closed เหมือน /jobs — ยังตั้งค่าไม่ครบก็อย่าเพิ่งให้ผ่าน
    console.error('[liffAuth] ปฏิเสธ request เพราะยังไม่ได้ตั้ง LINE_LOGIN_CHANNEL_ID');
    res.status(503).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า LINE Login' });
    return;
  }

  const header = req.header('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!idToken) {
    res.status(401).json({ ok: false, error: 'ต้องแนบ LIFF ID token' });
    return;
  }

  const cachedUserId = readCachedUserId(idToken);
  if (cachedUserId) {
    req.userId = cachedUserId;
    next();
    return;
  }

  const payload = await verifyIdToken(idToken);
  if (!payload?.sub) {
    res.status(401).json({ ok: false, error: 'token ใช้ไม่ได้' });
    return;
  }

  // ⚖️ G6: user_id ภายในมาจากการ lookup ด้วย sub ที่ LINE เซ็นมา ไม่ใช่ค่าที่ client ส่งมา
  const userId = await getUserIdByLineUserId(payload.sub);
  if (!userId) {
    res.status(403).json({ ok: false, error: 'ยังไม่ได้แอดเพื่อนบอท' });
    return;
  }

  // ไม่ cache เกินอายุของ token เอง และไม่เกิน 5 นาที เผื่อผู้ใช้ถูกปิดบัญชีระหว่างทาง
  const tokenExpiryMs = payload.exp ? payload.exp * 1000 : 0;
  const cacheUntil = Math.min(tokenExpiryMs || Date.now() + 300_000, Date.now() + 300_000);
  rememberToken(idToken, userId, cacheUntil);

  req.userId = userId;
  req.lineUserId = payload.sub;
  next();
}
