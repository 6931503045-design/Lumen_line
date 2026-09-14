// ไฟล์นี้ทำหน้าที่อะไร: ประกอบ Express app แล้วเปิดเซิร์ฟเวอร์
// ใครรับผิดชอบ: ① Bot Core
//
// ⚠️ ลำดับ middleware สำคัญมาก: `/webhook` ต้องมาก่อน และห้ามมี express.json() ครอบ
// เพราะ middleware ของ @line/bot-sdk ต้องอ่าน raw body เพื่อตรวจ x-line-signature
// ถ้ามี json parser กินไปก่อน ลายเซ็นจะตรวจไม่ผ่านทุก request — json parser จึงผูกไว้
// เฉพาะ /api และ /jobs เท่านั้น

import express, { type NextFunction, type Request, type Response } from 'express';
import { JSONParseError, SignatureValidationFailed } from '@line/bot-sdk';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhook';
import { apiRouter } from './routes/api';
import { jobsRouter } from './routes/jobs';
import { liffCors } from './middleware/cors';

const app = express();

app.use('/webhook', webhookRouter);
app.use('/health', healthRouter);
app.use('/api', liffCors, express.json(), apiRouter);
app.use('/jobs', express.json(), jobsRouter);

app.get('/', (_req, res) => {
  res.json({ name: 'JOD tang', status: 'scaffold-ready' });
});

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

  console.error('[index] unhandled error:', err);
  res.status(500).json({ ok: false, error: 'internal error' });
});

const port = env.port;
app.listen(port, () => {
  console.log(`JOD tang backend running on port ${port}`);
});
