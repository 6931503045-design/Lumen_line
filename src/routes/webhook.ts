import crypto from 'node:crypto';

import { Router } from 'express';

import { config } from '../config.js';
import { parseUserText } from '../services/parser.js';
import { replyText } from '../services/line.js';
import { createTransaction, getSummary } from '../services/transactions.js';

const router = Router();

export function verifyLineSignature(rawBody: Buffer, signature?: string | string[]): boolean {
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    return false;
  }

  const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;

  if (!normalizedSignature || !normalizedSignature.trim()) {
    return false;
  }

  const channelSecret = config.line.channelSecret || 'development-secret';

  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedSignature));
  } catch {
    return false;
  }
}

function formatSummary(userId: string): string {
  const summary = getSummary(userId);
  return `รายรับ: ${summary.income / 100} บาท\nรายจ่าย: ${summary.expense / 100} บาท\nคงเหลือ: ${summary.net / 100} บาท`;
}

router.post('/', async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === 'string'
      ? Buffer.from(req.body)
      : Buffer.from(JSON.stringify(req.body ?? {}));
  const signature = req.headers['x-line-signature'];

  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      events?: Array<{ type?: string; replyToken?: string; source?: { userId?: string }; message?: { type?: string; text?: string } }>;
    };

    for (const event of payload.events ?? []) {
      if (event.type !== 'message' || event.message?.type !== 'text') {
        continue;
      }

      const messageText = event.message?.text;
      if (!messageText) {
        continue;
      }

      const parsed = parseUserText(messageText);
      if (!parsed) {
        continue;
      }

      const userId = event.source?.userId ?? 'demo-user';

      if (parsed.kind === 'summary') {
        await replyText(event.replyToken ?? '', formatSummary(userId));
        continue;
      }

      if (parsed.kind === 'balance') {
        const summary = getSummary(userId);
        await replyText(event.replyToken ?? '', `ยอดคงเหลือ: ${(summary.net / 100).toFixed(2)} บาท`);
        continue;
      }

      if (parsed.kind === 'plan' || parsed.kind === 'help') {
        await replyText(event.replyToken ?? '', 'แผน/ช่วยเหลือ: พิมพ์ข้อความแบบ “กาแฟ 80”, “+เงินเดือน 35000”, หรือ “ออม 2000” เพื่อเริ่มใช้งาน');
        continue;
      }

      if (parsed.amountSatang === undefined) {
        continue;
      }

      if (parsed.kind === 'expense') {
        createTransaction({
          userId,
          type: 'expense',
          amount: parsed.amountSatang,
          label: parsed.label,
          category: 'general',
          parsedBy: 'manual',
        });
      }

      if (parsed.kind === 'income') {
        createTransaction({
          userId,
          type: 'income',
          amount: parsed.amountSatang,
          label: parsed.label,
          category: 'general',
          parsedBy: 'manual',
        });
      }

      if (parsed.kind === 'transfer') {
        createTransaction({
          userId,
          type: 'transfer',
          amount: parsed.amountSatang,
          label: parsed.label,
          category: 'general',
          parsedBy: 'manual',
        });
      }

      await replyText(event.replyToken ?? '', `บันทึกสำเร็จ: ${parsed.label} ${parsed.amountSatang / 100} บาท`);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
