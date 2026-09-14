// ไฟล์นี้ทำหน้าที่อะไร: ล็อกอินด้วย LINE Login แบบเว็บ (OAuth 2.0 authorization code)
// ใครรับผิดชอบ: ① Bot Core / ④ Frontend
// เขียนในสัปดาห์: W5 (ตอนย้ายจาก LIFF มาเป็นเว็บธรรมดา)
// ⚖️ กฎเหล็ก G6
//
// ทำไมต้องมีไฟล์นี้: สมัยเป็น LIFF ตัว SDK ในแอป LINE เป็นคนหา id_token มาให้
// พอออกมาเป็นเว็บข้างนอก ไม่มี SDK แล้ว ต้องเดินขั้นตอน OAuth เอง:
//
//   /auth/login     -> เด้งไป access.line.me ให้ผู้ใช้กดอนุญาต
//   /auth/callback  <- LINE เด้งกลับมาพร้อม code
//                      -> แลก code เป็น id_token (ต้องใช้ channel secret ฝั่งเซิร์ฟเวอร์)
//                      -> ตรวจ id_token กับ LINE -> ได้ sub -> หา user_id -> ออก session cookie
//   /auth/logout    -> ลบ cookie
//
// 🔒 การแลก code ต้องทำที่นี่เท่านั้น เพราะใช้ LINE_LOGIN_CHANNEL_SECRET
//    ถ้าหลุดไปอยู่ในโค้ดฝั่งเบราว์เซอร์ = ใครก็ปลอมตัวเป็นแอปเราได้

import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getUserIdByLineUserId } from '../db/queries/users';
import {
  createSessionValue,
  readCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../utils/session';

export const authRouter = express.Router();

const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

/** cookie ชั่วคราวเก็บค่า state ระหว่างที่ผู้ใช้ไปกดอนุญาตที่ LINE */
const STATE_COOKIE_NAME = 'jodtang_oauth_state';
const STATE_MAX_AGE_SECONDS = 10 * 60;

const LINE_TIMEOUT_MS = 5000;

function redirectUri(): string {
  return `${env.appBaseUrl}/auth/callback`;
}

/** ตั้งค่าที่ใช้ซ้ำกับทุก cookie ของระบบนี้ */
function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,          // JavaScript ในหน้าเว็บอ่านไม่ได้ ลดผลกระทบถ้าโดน XSS
    secure: env.appBaseUrl.startsWith('https://'), // ตอน dev บน http ต้องปล่อยให้ส่งได้
    sameSite: 'lax' as const, // กัน CSRF: เบราว์เซอร์ไม่แนบ cookie ให้ POST ข้ามเว็บ
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

/** ยังตั้งค่าไม่ครบก็ล็อกอินไม่ได้ — บอกให้ชัดดีกว่าปล่อยให้ error งงๆ ที่ LINE */
function missingConfig(): string | null {
  if (!env.lineLoginChannelId) return 'LINE_LOGIN_CHANNEL_ID';
  if (!env.lineLoginChannelSecret) return 'LINE_LOGIN_CHANNEL_SECRET';
  if (!env.appBaseUrl) return 'APP_BASE_URL';
  if (!env.sessionSecret) return 'SESSION_SECRET';
  return null;
}

authRouter.get('/login', (req, res) => {
  const missing = missingConfig();
  if (missing) {
    logger.error(`[auth] ล็อกอินไม่ได้เพราะยังไม่ได้ตั้ง ${missing}`);
    res.status(503).json({ ok: false, error: `ยังไม่ได้ตั้งค่า ${missing}` });
    return;
  }

  // state กัน login CSRF: ค่าที่สุ่มตอนเริ่ม ต้องกลับมาเหมือนเดิมตอน callback
  // ไม่งั้นคนอื่นหลอกให้เบราว์เซอร์เราเดิน callback ด้วย code ของเขาได้ = เราล็อกอินเป็นเขา
  const state = randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE_NAME, state, cookieOptions(STATE_MAX_AGE_SECONDS));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.lineLoginChannelId,
    redirect_uri: redirectUri(),
    state,
    // openid = ขอ id_token, profile = ขอชื่อกับรูปมาด้วย (แทน liff.getProfile() ของเดิม)
    scope: 'openid profile',
  });

  res.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
});

type TokenResponse = { id_token?: string };
type VerifyResponse = { sub?: string; name?: string; picture?: string };

async function postForm<T>(url: string, body: URLSearchParams): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(LINE_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(`[auth] LINE ตอบ ${response.status} จาก ${url}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (err) {
    logger.error(`[auth] เรียก ${url} ไม่สำเร็จ:`, err);
    return null;
  }
}

authRouter.get('/callback', (req, res, next) => {
  void (async () => {
    const missing = missingConfig();
    if (missing) {
      res.status(503).json({ ok: false, error: `ยังไม่ได้ตั้งค่า ${missing}` });
      return;
    }

    const expectedState = readCookie(req.header('cookie'), STATE_COOKIE_NAME);
    const receivedState = typeof req.query.state === 'string' ? req.query.state : '';
    res.clearCookie(STATE_COOKIE_NAME, { path: '/' });

    // ใช้ครั้งเดียวแล้วทิ้ง ถ้าไม่ตรงแปลว่า callback นี้ไม่ได้เริ่มจากหน้าเราเอง
    const stateOk =
      Boolean(expectedState) &&
      expectedState!.length === receivedState.length &&
      timingSafeEqual(Buffer.from(expectedState!), Buffer.from(receivedState));

    if (!stateOk) {
      logger.warn('[auth] state ไม่ตรง ปฏิเสธ callback');
      res.status(400).send('ล็อกอินไม่สำเร็จ (state ไม่ตรง) กรุณาเริ่มใหม่');
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      // ผู้ใช้กดยกเลิกที่หน้า LINE ก็มาทางนี้ ไม่ใช่ความผิดพลาดของระบบ
      res.redirect('/?login=cancelled');
      return;
    }

    const token = await postForm<TokenResponse>(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        client_id: env.lineLoginChannelId,
        client_secret: env.lineLoginChannelSecret,
      })
    );

    if (!token?.id_token) {
      res.status(502).send('แลก token กับ LINE ไม่สำเร็จ');
      return;
    }

    // ตรวจ id_token กับ LINE อีกชั้น แทนที่จะถอด JWT เองซึ่งพลาดง่าย
    const profile = await postForm<VerifyResponse>(
      VERIFY_URL,
      new URLSearchParams({ id_token: token.id_token, client_id: env.lineLoginChannelId })
    );

    if (!profile?.sub) {
      res.status(401).send('ตรวจสอบตัวตนไม่สำเร็จ');
      return;
    }

    // ⚖️ G6: user_id ภายในมาจาก sub ที่ LINE เซ็นมาเท่านั้น
    const userId = await getUserIdByLineUserId(profile.sub);
    if (!userId) {
      // ล็อกอินผ่านแล้วแต่ยังไม่เคยแอดเพื่อนบอท จึงยังไม่มีแถวใน users
      res.redirect('/?login=no-account');
      return;
    }

    const value = createSessionValue(
      { uid: userId, name: profile.name, picture: profile.picture },
      env.sessionSecret
    );
    res.cookie(SESSION_COOKIE_NAME, value, cookieOptions(SESSION_MAX_AGE_SECONDS));
    res.redirect('/');
  })().catch(next);
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});
