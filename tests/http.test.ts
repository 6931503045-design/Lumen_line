// ไฟล์นี้ทำหน้าที่อะไร: test ชั้น HTTP ทั้งก้อน (app.ts) — ยิง request จริงเข้า app ที่เปิดบนพอร์ตสุ่ม
// ใครรับผิดชอบ: ① Bot Core
// ⚖️ กฎเหล็ก G6
//
// สิ่งที่ต้องพิสูจน์: ทุกประตูเข้าระบบ (เว็บ / cron / LINE webhook / ล็อกอิน) ปฏิเสธคนที่ไม่มีสิทธิ์
// และ user_id มาจาก session ที่เราเซ็นเองเท่านั้น ไม่ใช่จาก body ที่ client ส่งมา
//
// ก่อนมีไฟล์นี้ route ทั้งหมด coverage = 0% — ถ้ามีคนลบ requireSession ออกจาก api.ts
// หรือสลับลำดับ express.json() มาครอบ webhook เทสต์ทั้งชุดจะยังเขียวอยู่

import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ต้องตั้งก่อน config/env ถูกโหลด (env อ่านค่าครั้งเดียวตอน import)
vi.hoisted(() => {
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.APP_BASE_URL = 'https://jodtang.test';
  process.env.LINE_LOGIN_CHANNEL_ID = 'login-channel';
  process.env.LINE_LOGIN_CHANNEL_SECRET = 'login-secret';
});

const supabaseMock = vi.hoisted(() => {
  const insert = vi.fn();
  const deleteEq = vi.fn();
  return {
    insert,
    deleteEq,
    supabase: {
      from: vi.fn(() => ({
        insert,
        delete: () => ({ eq: deleteEq }),
      })),
    },
  };
});

vi.mock('../src/db/supabase', () => ({ supabase: supabaseMock.supabase }));
vi.mock('../src/handlers/textHandler', () => ({ handleText: vi.fn() }));
vi.mock('../src/handlers/postbackHandler', () => ({ handlePostback: vi.fn() }));
vi.mock('../src/handlers/imageHandler', () => ({ handleImage: vi.fn() }));
vi.mock('../src/handlers/followHandler', () => ({ handleFollow: vi.fn(), handleUnfollow: vi.fn() }));
vi.mock('../src/jobs', () => {
  const JOBS = { cleanup: vi.fn() };
  return {
    JOBS,
    isJobName: (value: string) => Object.prototype.hasOwnProperty.call(JOBS, value),
  };
});
vi.mock('../src/services/transaction.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/transaction.service')>()),
  createTransaction: vi.fn(),
}));

import { app } from '../src/app';
import { env } from '../src/config/env';
import { createSessionValue, SESSION_COOKIE_NAME } from '../src/utils/session';
import { handleText } from '../src/handlers/textHandler';
import { JOBS } from '../src/jobs';
import { createTransaction } from '../src/services/transaction.service';

const USER = 'user-in-session';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.insert.mockResolvedValue({ error: null });
  supabaseMock.deleteEq.mockResolvedValue({ error: null });
});

function sessionCookie(uid = USER, secret = env.sessionSecret, nowMs = Date.now()): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(createSessionValue({ uid }, secret, nowMs))}`;
}

function signLine(body: string, secret = env.lineChannelSecret): string {
  return createHmac('sha256', secret).update(body).digest('base64');
}

/** รอให้งานที่ webhook ปล่อยทำเบื้องหลัง (หลังตอบ 200 ไปแล้ว) ทำจบก่อน */
async function flushBackgroundWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('security headers', () => {
  it('ทุก response มี header กัน clickjacking / sniffing และไม่บอกว่าใช้ Express', async () => {
    const res = await fetch(`${baseUrl}/api/ping`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('/api — ต้องมี session ที่เราเซ็นเอง (G6)', () => {
  it('ไม่มี cookie → 401', async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(401);
  });

  it('cookie ที่เซ็นด้วย secret อื่น (ปลอม) → 401', async () => {
    const res = await fetch(`${baseUrl}/api/me`, {
      headers: { cookie: sessionCookie(USER, 'attacker-secret') },
    });
    expect(res.status).toBe(401);
  });

  it('cookie หมดอายุแล้ว → 401', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const res = await fetch(`${baseUrl}/api/me`, {
      headers: { cookie: sessionCookie(USER, env.sessionSecret, eightDaysAgo) },
    });
    expect(res.status).toBe(401);
  });

  it('cookie ถูกต้อง → ได้ user ตาม session', async () => {
    const res = await fetch(`${baseUrl}/api/me`, { headers: { cookie: sessionCookie() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ userId: USER });
  });

  it('user_id ใน body ถูกเมิน — ใช้ของ session เสมอ', async () => {
    vi.mocked(createTransaction).mockResolvedValue({ id: 'tx-1' } as never);

    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { cookie: sessionCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'victim',
        user_id: 'victim',
        type: 'expense',
        amountSatang: 8000,
      }),
    });

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createTransaction).mock.calls[0]![0]).toMatchObject({
      userId: USER,
      amountSatang: 8000,
    });
  });

  it('POST จากเว็บอื่น (Origin ไม่ตรง) → 403 และไม่เขียนอะไรเลย', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: {
        cookie: sessionCookie(),
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({ type: 'expense', amountSatang: 8000 }),
    });

    expect(res.status).toBe(403);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('ยอดไม่ใช่จำนวนเต็มสตางค์ → 400 พร้อมเหตุผล ไม่ใช่ 500 (G3)', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { cookie: sessionCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amountSatang: 80.5 }),
    });

    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('error ที่ไม่ได้คาดไว้ → 500 แบบไม่หลุดรายละเอียดภายในออกไป', async () => {
    vi.mocked(createTransaction).mockRejectedValue(new Error('db password is hunter2'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { cookie: sessionCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amountSatang: 8000 }),
    });

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('at ');
    consoleError.mockRestore();
  });
});

describe('/jobs — ต้องแนบ CRON_SECRET', () => {
  it('ไม่มี header → 401 และไม่รันงาน', async () => {
    const res = await fetch(`${baseUrl}/jobs/run?job=cleanup`, { method: 'POST' });
    expect(res.status).toBe(401);
    expect(JOBS.cleanup).not.toHaveBeenCalled();
  });

  it('secret ผิด → 401', async () => {
    const res = await fetch(`${baseUrl}/jobs/run?job=cleanup`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong' },
    });
    expect(res.status).toBe(401);
    expect(JOBS.cleanup).not.toHaveBeenCalled();
  });

  it('secret ถูก แต่ชื่องานไม่มี → 404', async () => {
    const res = await fetch(`${baseUrl}/jobs/run?job=dropTables`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });
    expect(res.status).toBe(404);
  });

  it('secret ถูก → รันงานแล้วตอบ 200 พร้อมผล', async () => {
    vi.mocked(JOBS.cleanup).mockResolvedValue({ deleted: 3 });

    const res = await fetch(`${baseUrl}/jobs/run?job=cleanup`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, job: 'cleanup', result: { deleted: 3 } });
    expect(JOBS.cleanup).toHaveBeenCalledTimes(1);
  });

  it('งานพัง → 500 ให้ GitHub Actions เห็นเป็นสีแดง', async () => {
    vi.mocked(JOBS.cleanup).mockRejectedValue(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await fetch(`${baseUrl}/jobs/run?job=cleanup`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});

describe('/webhook — ต้องมีลายเซ็นของ LINE', () => {
  const event = {
    type: 'message',
    webhookEventId: 'evt-1',
    replyToken: 'reply-1',
    source: { userId: 'Uline' },
    message: { type: 'text', text: 'กาแฟ 80' },
  };
  const body = JSON.stringify({ destination: 'bot', events: [event] });

  it('ลายเซ็นผิด → 401 และไม่ประมวลผลอะไร', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-line-signature': signLine(body, 'nope') },
      body,
    });
    await flushBackgroundWork();

    expect(res.status).toBe(401);
    expect(handleText).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('ลายเซ็นถูก → ตอบ 200 แล้วส่งข้อความต่อให้ handler', async () => {
    const res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-line-signature': signLine(body) },
      body,
    });
    await flushBackgroundWork();

    expect(res.status).toBe(200);
    expect(supabaseMock.insert).toHaveBeenCalledWith({ id: 'evt-1' });
    expect(handleText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(handleText).mock.calls[0]![0]).toMatchObject({ message: { text: 'กาแฟ 80' } });
  });

  it('event ซ้ำ (LINE retry) → ไม่ประมวลผลซ้ำ', async () => {
    supabaseMock.insert.mockResolvedValue({ error: { code: '23505' } });

    const res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-line-signature': signLine(body) },
      body,
    });
    await flushBackgroundWork();

    expect(res.status).toBe(200);
    expect(handleText).not.toHaveBeenCalled();
  });

  it('handler พัง → ลบ marker ทิ้ง เพื่อให้ retry ของ LINE ทำงานได้', async () => {
    vi.mocked(handleText).mockRejectedValue(new Error('supabase down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-line-signature': signLine(body) },
      body,
    });
    await flushBackgroundWork();

    expect(supabaseMock.deleteEq).toHaveBeenCalledWith('id', 'evt-1');
    consoleError.mockRestore();
  });
});

describe('/auth — LINE Login', () => {
  it('/auth/login → เด้งไป LINE พร้อม state และฝาก state ไว้ใน cookie', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.origin).toBe('https://access.line.me');
    expect(location.searchParams.get('redirect_uri')).toBe('https://jodtang.test/auth/callback');

    const state = location.searchParams.get('state');
    expect(state).toMatch(/^[0-9a-f]{32}$/);
    expect(res.headers.get('set-cookie')).toContain(`jodtang_oauth_state=${state}`);
  });

  it('/auth/callback ที่ state ไม่ตรง → 400 ไม่แลก token (กัน login CSRF)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await fetch(`${baseUrl}/auth/callback?code=abc&state=attacker`, {
      headers: { cookie: 'jodtang_oauth_state=0123456789abcdef0123456789abcdef' },
      redirect: 'manual',
    });

    expect(res.status).toBe(400);
    // fetch ครั้งเดียวที่เกิดขึ้นคือของเทสต์เอง — เซิร์ฟเวอร์ไม่ได้ไปเรียก LINE ต่อ
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('api.line.me'))).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('/auth/callback ที่ไม่มี state cookie เลย → 400', async () => {
    const res = await fetch(`${baseUrl}/auth/callback?code=abc&state=whatever`, { redirect: 'manual' });
    expect(res.status).toBe(400);
  });
});
