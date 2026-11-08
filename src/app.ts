// ไฟล์นี้ทำหน้าที่อะไร: ประกอบ Express app (route + middleware + error handler) — ยังไม่เปิดพอร์ต
// ใครรับผิดชอบ: ① Bot Core
//
// แยกจาก index.ts เพื่อให้เทสต์ import app ไปเปิดบนพอร์ตสุ่มได้ โดยไม่ต้องเปิดเซิร์ฟเวอร์จริง
//
// ⚠️ ลำดับ middleware สำคัญมาก: `/webhook` ต้องมาก่อน และห้ามมี express.json() ครอบ
// เพราะ middleware ของ @line/bot-sdk ต้องอ่าน raw body เพื่อตรวจ x-line-signature
// ถ้ามี json parser กินไปก่อน ลายเซ็นจะตรวจไม่ผ่านทุก request — json parser จึงผูกไว้
// เฉพาะ /api และ /jobs เท่านั้น

import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { JSONParseError, SignatureValidationFailed } from '@line/bot-sdk';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhook';
import { apiRouter } from './routes/api';
import { jobsRouter } from './routes/jobs';
import { authRouter } from './routes/auth';
import { BudgetError } from './services/budget.service';
import { RecurringError } from './services/recurring.service';
import { PlanError } from './services/plan.service';
import { TransactionError } from './services/transaction.service';
import { CategoryError } from './services/category.service';
import { SimulateError } from './services/simulate.service';
import { MoneyError } from './utils/money';

export const app = express();

// ไม่บอกคนนอกว่าใช้ Express เวอร์ชันไหน ลดข้อมูลที่ผู้โจมตีใช้เลือกช่องโหว่ได้
app.disable('x-powered-by');

// header ความปลอดภัยพื้นฐาน — เขียนเองแทน helmet เพราะต้องการแค่ไม่กี่ตัวและไม่อยากเพิ่ม dependency
//
// ⚠️ ยังไม่ใส่ Content-Security-Policy เต็มรูปแบบ เพราะหน้าเว็บยังมี onclick แบบ inline (boot.js)
// ถ้าใส่ CSP ตอนนี้ปุ่มพวกนั้นจะกดไม่ติด — ใช้ frame-ancestors อย่างเดียวพอสำหรับกัน clickjacking
app.use((_req, res, next) => {
  // กันเว็บอื่นฝังหน้าเราใน iframe แล้วหลอกให้ผู้ใช้กดปุ่มลบ/โอนเงิน (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  // ห้ามเบราว์เซอร์เดาชนิดไฟล์เอง ไฟล์ที่ประกาศเป็น text จะไม่ถูกรันเป็นสคริปต์
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // ไม่ส่ง URL เต็ม (ซึ่งอาจมี code/state ของ OAuth) ไปให้เว็บภายนอกที่ลิงก์ออกไป
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/webhook', webhookRouter);
app.use('/health', healthRouter);
app.use('/auth', express.urlencoded({ extended: false }), authRouter);
app.use('/api', express.json(), apiRouter);
app.use('/jobs', express.json(), jobsRouter);

// เสิร์ฟหน้าเว็บจากโดเมนเดียวกับ API
//
// ทำไมต้องโดเมนเดียว: session เก็บใน cookie ถ้าหน้าเว็บอยู่คนละโดเมนกับ API
// cookie จะกลายเป็น third-party cookie ซึ่ง Safari บล็อกโดยปริยายและ Chrome กำลังทยอยเลิกรองรับ
// = ล็อกอินค้างไม่ได้กับผู้ใช้บางกลุ่มแบบพังเงียบๆ อยู่โดเมนเดียวกันตัดปัญหานี้ทิ้งทั้งหมด
// และเป็นเหตุผลที่ middleware/cors.ts ถูกลบไปแล้ว — ไม่มี cross-origin ให้ต้องอนุญาตอีก
//
// วางไว้ท้ายสุดของ route ทั้งหมด เพื่อไม่ให้ไฟล์ static ไปบังเส้นทาง /api หรือ /auth
const WEB_ROOT = path.join(__dirname, '..', 'web');
app.use(express.static(WEB_ROOT));

// error handler ต้องอยู่ท้ายสุดและต้องรับครบ 4 พารามิเตอร์ Express ถึงจะรู้ว่าเป็น error handler
//
// 🔒 เดิมไม่มีตัวนี้ ทำให้ error จาก middleware ของ LINE ตกไปที่ default handler ของ Express
// = ตอบ 500 พร้อม stack trace ผลเสียสองอย่าง: LINE เห็น 5xx แล้ว retry ซ้ำเรื่อยๆ โดยไม่จำเป็น
// และ stack trace ของเซิร์ฟเวอร์หลุดออกไปข้างนอก
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // ลายเซ็นไม่ผ่าน = ไม่ได้มาจาก LINE จริง ตอบ 401 เพื่อให้ LINE เลิก retry
  if (err instanceof SignatureValidationFailed) {
    console.warn('[index] webhook signature ไม่ผ่าน:', err.message);
    res.status(401).json({ ok: false, error: 'invalid signature' });
    return;
  }

  // body ไม่ใช่ JSON ที่อ่านได้ = request เสีย ตอบ 400 (ไม่ใช่ความผิดของเซิร์ฟเวอร์)
  if (err instanceof JSONParseError) {
    console.warn('[index] webhook body ไม่ใช่ JSON ที่อ่านได้:', err.message);
    res.status(400).json({ ok: false, error: 'invalid body' });
    return;
  }

  // คำขอที่ผู้ใช้ส่งมาไม่ถูกต้อง (งบติดลบ, หมวดไม่ใช่ของเขา, เดือนผิดรูปแบบ)
  // ต้องตอบ 4xx พร้อมเหตุผลภาษาไทย ไม่ใช่ 500 ที่หน้าเว็บแปลว่า "เซิร์ฟเวอร์พัง"
  if (
    err instanceof BudgetError ||
    err instanceof RecurringError ||
    err instanceof PlanError ||
    err instanceof TransactionError ||
    err instanceof CategoryError ||
    err instanceof SimulateError
  ) {
    res.status(err.status).json({ ok: false, error: err.message });
    return;
  }

  // MoneyError เกิดจากค่าเงินที่ส่งเข้ามาไม่ถูกต้องเสมอ ไม่ใช่เซิร์ฟเวอร์พัง
  if (err instanceof MoneyError) {
    res.status(400).json({ ok: false, error: err.message });
    return;
  }

  console.error('[index] unhandled error:', err);
  res.status(500).json({ ok: false, error: 'internal error' });
});
