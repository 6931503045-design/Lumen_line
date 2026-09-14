// ไฟล์นี้ทำหน้าที่อะไร: JSON API สำหรับหน้า LIFF — ข้อมูลจริงจาก DB ของผู้ใช้ที่ล็อกอินเท่านั้น
// ใครรับผิดชอบ: ④ Frontend / ① Bot Core
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G6, G7
//
// 🆕 เดิมทุก route คืน mock ก้อนเดียวกันหมดและไม่มี auth เลย ตอนนี้ทุก route ใต้ /api
// (ยกเว้น /api/ping) ผ่าน liffAuth ก่อน แล้วอ่านเฉพาะข้อมูลของ req.userId เท่านั้น
//
// ⚠️ ความซื่อสัตย์ของตัวเลข: อะไรที่ backend ยังคำนวณไม่ได้จริง จะไม่ส่งเลขหลอกมาให้
// แต่จะบอกชื่อไว้ใน `unavailable` เพื่อให้หน้าเว็บแสดงสถานะ "ยังไม่มีข้อมูล" ได้ถูกต้อง
// แทนที่จะโชว์ ฿0.00 ซึ่งผู้ใช้จะอ่านว่า "ฉันมีเงินศูนย์บาท"

import express from 'express';
import { liffAuth, type AuthedRequest } from '../middleware/liffAuth';
import { getUserSummary } from '../services/summary.service';
import { listTransactionsByUser } from '../db/queries/transactions';
import { listCategoriesByUser } from '../db/queries/categories';
import { ensureEmailIngestToken, rotateEmailIngestToken } from '../db/queries/users';
import { countUnparsedEmails } from '../db/queries/emails';
import { env } from '../config/env';
import { toSatang } from '../utils/money';

export const apiRouter = express.Router();

/** จำนวนรายการสูงสุดที่หน้า LIFF ขอได้ต่อครั้ง */
const MAX_TRANSACTION_LIMIT = 200;

/** ping ไม่ต้องล็อกอิน ใช้เช็คว่า API ยังอยู่ ไม่มีข้อมูลผู้ใช้ปนอยู่ในนี้ */
apiRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, message: 'API ready' });
});

// ทุก route ใต้บรรทัดนี้ต้องมี LIFF ID token
apiRouter.use(liffAuth);

/** ตัวช่วยห่อ handler ที่เป็น async ให้ error วิ่งไปที่ error handler กลางของ Express */
function handle(
  fn: (req: AuthedRequest, res: express.Response) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    fn(req as AuthedRequest, res).catch(next);
  };
}

apiRouter.get(
  '/summary',
  handle(async (req, res) => {
    const summary = await getUserSummary(req.userId!);
    res.json({
      ...summary,
      // ตัวเลขที่ SPEC ออกแบบไว้แต่ยังไม่มี service คำนวณให้ — ห้ามเดา ห้ามส่ง 0 มาแทน
      unavailable: ['safeToSpend', 'confidence', 'monthlyBudget', 'savingProgress'],
    });
  })
);

apiRouter.get(
  '/transactions',
  handle(async (req, res) => {
    const requested = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), MAX_TRANSACTION_LIMIT)
      : 100;

    const rows = await listTransactionsByUser(req.userId!, limit);
    res.json(
      rows.map((row) => ({
        id: row.id,
        // note คือสิ่งที่ผู้ใช้พิมพ์ ถ้าไม่มีก็ใช้ชื่อหมวดแทนเพื่อให้การ์ดไม่ว่าง
        title: row.note ?? row.categories?.name ?? 'ไม่ระบุ',
        type: row.type,
        amountSatang: toSatang(row.amount),
        category: row.categories?.name ?? null,
        emoji: row.categories?.emoji ?? null,
        occurredAt: row.occurred_at,
        parsedBy: row.parsed_by,
        source: row.source,
      }))
    );
  })
);

apiRouter.get(
  '/categories',
  handle(async (req, res) => {
    const categories = await listCategoriesByUser(req.userId!);
    res.json(
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        emoji: category.emoji,
        isEssential: category.is_essential,
        isDefault: category.is_default,
      }))
    );
  })
);

/**
 * แผนออมยังไม่เปิดใช้งาน: ตาราง plans มีแล้วแต่ services/plan.service.ts ยังว่าง
 * และไม่มีโค้ดไหนเขียนแถวลง plans เลย จึงตอบ [] พร้อมบอกเหตุผลตรงๆ
 * แทนที่จะส่งแผนปลอมมาให้หน้าเว็บวาด
 */
apiRouter.get('/plans', (_req, res) => {
  res.json({
    items: [],
    available: false,
    reason: 'ยังไม่ได้ทำ plan.service — ตาราง plans ยังไม่มีข้อมูลจากที่ไหนเลย',
  });
});

/**
 * งบประมาณรายเดือนยังไม่เปิดใช้งานด้วยเหตุผลเดียวกัน (budget.service.ts ยังว่าง)
 */
apiRouter.get('/budgets', (_req, res) => {
  res.json({
    items: [],
    available: false,
    reason: 'ยังไม่ได้ทำ budget.service — ตาราง budgets ยังไม่มีข้อมูลจากที่ไหนเลย',
  });
});

/**
 * ที่อยู่อีเมลสำหรับ forward ของผู้ใช้คนนี้ (SPEC §S8 ขั้นตอนตั้งค่าของผู้ใช้)
 * รูปแบบ: <ส่วนหน้าของ GMAIL_USER>+<email_ingest_token>@<โดเมนของ GMAIL_USER>
 * ผู้ใช้เอาที่อยู่นี้ไปตั้ง Gmail filter ให้ forward อีเมลธนาคารเข้ามา
 */
function buildIngestAddress(token: string): string | null {
  if (!env.gmailUser || !env.gmailUser.includes('@')) return null;
  const [localPart, domain] = env.gmailUser.split('@') as [string, string];
  return `${localPart}+${token}@${domain}`;
}

apiRouter.get(
  '/settings',
  handle(async (req, res) => {
    const token = await ensureEmailIngestToken(req.userId!);
    const unparsedEmails = await countUnparsedEmails(req.userId!);

    res.json({
      emailIngest: {
        // ไม่ได้ตั้ง GMAIL_USER = ระบบรับอีเมลยังไม่พร้อม บอกตรงๆ ไม่ต้องแสดงที่อยู่ครึ่งๆ
        address: buildIngestAddress(token),
        available: Boolean(env.gmailUser),
        unparsedCount: unparsedEmails,
      },
      aiEnabled: env.aiEnabled,
    });
  })
);

/**
 * สุ่ม token ใหม่ — ที่อยู่เดิมใช้ไม่ได้ทันที (SPEC: "ที่อยู่เดิมใช้ไม่ได้ทันที")
 * ใช้เมื่อผู้ใช้สงสัยว่าที่อยู่หลุดไปถึงคนอื่น
 */
apiRouter.post(
  '/settings/email-token/rotate',
  handle(async (req, res) => {
    const token = await rotateEmailIngestToken(req.userId!);
    res.json({ ok: true, address: buildIngestAddress(token) });
  })
);
