// ไฟล์นี้ทำหน้าที่อะไร: JSON API สำหรับหน้า LIFF — ข้อมูลจริงจาก DB ของผู้ใช้ที่ล็อกอินเท่านั้น
// ใครรับผิดชอบ: ④ Frontend / ① Bot Core
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G6, G7
//
// ทุก route ใต้ /api (ยกเว้น /api/ping) ผ่าน requireSession ก่อน
// แล้วอ่านเฉพาะข้อมูลของ req.userId เท่านั้น
//
// ⚠️ ความซื่อสัตย์ของตัวเลข: อะไรที่ backend ยังคำนวณไม่ได้จริง จะไม่ส่งเลขหลอกมาให้
// แต่จะบอกชื่อไว้ใน `unavailable` เพื่อให้หน้าเว็บแสดงสถานะ "ยังไม่มีข้อมูล" ได้ถูกต้อง
// แทนที่จะโชว์ ฿0.00 ซึ่งผู้ใช้จะอ่านว่า "ฉันมีเงินศูนย์บาท"

import express from 'express';
import { requireSession, type AuthedRequest } from '../middleware/auth';
import { getSafeToSpend, getUserSummary } from '../services/summary.service';
import {
  BudgetError,
  getBudgetOverview,
  removeBudget,
  setBudget,
} from '../services/budget.service';
import {
  cancelPlan,
  completeReachedPlans,
  confirmPlan,
  createSavingPlan,
  getPlanCapacity,
  listPlansWithProgress,
  PlanError,
  transferToPlan,
} from '../services/plan.service';
import { notifyPlanCompleted } from '../services/planCheck.service';
import {
  createRecurringRule,
  listRecurringRules,
  RecurringError,
  removeRecurringRule,
  type CreateRecurringInput,
} from '../services/recurring.service';
import { listTransactionsByUser } from '../db/queries/transactions';
import {
  assertTransactionAmount,
  createTransaction,
  deleteTransactionForUser,
  restoreTransactionForUser,
  TransactionError,
  updateTransactionForUser,
  type UpdateTransactionInput,
} from '../services/transaction.service';
import { listCategoriesByUser } from '../db/queries/categories';
import { ensureEmailIngestToken, rotateEmailIngestToken } from '../db/queries/users';
import { countUnparsedEmails } from '../db/queries/emails';
import { env } from '../config/env';
import { toSatang } from '../utils/money';
import { normalizeMonthIso } from '../utils/thaiDate';

export const apiRouter = express.Router();

/** จำนวนรายการสูงสุดที่หน้า LIFF ขอได้ต่อครั้ง */
const MAX_TRANSACTION_LIMIT = 200;

/** ping ไม่ต้องล็อกอิน ใช้เช็คว่า API ยังอยู่ ไม่มีข้อมูลผู้ใช้ปนอยู่ในนี้ */
apiRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, message: 'API ready' });
});

// ทุก route ใต้บรรทัดนี้ต้องล็อกอินแล้ว (มี session cookie ที่เราเซ็น)
apiRouter.use(requireSession);

/** ตัวช่วยห่อ handler ที่เป็น async ให้ error วิ่งไปที่ error handler กลางของ Express */
function handle(
  fn: (req: AuthedRequest, res: express.Response) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    fn(req as AuthedRequest, res).catch(next);
  };
}

/**
 * ผู้ใช้ที่ล็อกอินอยู่คือใคร — ชื่อกับรูปมาจาก id_token ตอนล็อกอิน เก็บไว้ใน session cookie
 * เดิมหน้าเว็บได้ข้อมูลนี้จาก liff.getProfile() ซึ่งไม่มีแล้วเมื่อเลิกใช้ LIFF
 */
apiRouter.get('/me', (req, res) => {
  const authed = req as AuthedRequest;
  res.json({
    userId: authed.userId,
    displayName: authed.displayName ?? null,
    pictureUrl: authed.pictureUrl ?? null,
  });
});

apiRouter.get(
  '/summary',
  handle(async (req, res) => {
    const [summary, safeToSpend] = await Promise.all([
      getUserSummary(req.userId!),
      getSafeToSpend(req.userId!),
    ]);
    res.json({
      ...summary,
      safeToSpend,
      // ตัวเลขที่ SPEC ออกแบบไว้แต่ยังไม่มี service คำนวณให้ — ห้ามเดา ห้ามส่ง 0 มาแทน
      // `confidence` มาจาก /api/plans (capacity.confidence) ไม่ได้อยู่ในนี้
      unavailable: [],
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

/** อ่านวันเวลาที่ผู้ใช้ส่งมา — รูปแบบผิดต้องปฏิเสธ ไม่ใช่เงียบๆ แล้วใช้เวลาปัจจุบันแทน */
function readOccurredAt(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new TransactionError('occurredAt ต้องเป็นข้อความรูปแบบวันเวลา', 400);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TransactionError(`วันเวลาไม่ถูกต้อง: "${value}"`, 400);
  }
  return date;
}

function readType(value: unknown): 'income' | 'expense' {
  if (value !== 'income' && value !== 'expense') {
    throw new TransactionError('type ต้องเป็น income หรือ expense', 400);
  }
  return value;
}

/**
 * ข้อความสั้นๆ ที่ผู้ใช้พิมพ์ — ตัดช่องว่างหัวท้าย ว่างเปล่านับเป็นไม่ได้ส่ง
 *
 * 🔴 แก้บั๊ก: เดิมโยน error เมื่อค่าเป็น undefined ทำให้ POST /api/transactions
 * ที่ไม่ส่ง categoryName มา (ซึ่งเป็นเรื่องปกติ) ตอบ 400 ทุกครั้ง = สร้างรายการไม่ได้เลย
 * undefined แปลว่า "ไม่ได้ส่งฟิลด์นี้มา" ต่างจาก null ที่แปลว่า "ส่งมาเพื่อล้างค่า"
 */
function readText(value: unknown, field: string, maxLength = 200): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new TransactionError(`${field} ต้องเป็นข้อความ`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new TransactionError(`${field} ยาวเกิน ${maxLength} ตัวอักษร`, 400);
  }
  return trimmed;
}

/**
 * บันทึกรายการใหม่จากหน้าเว็บ
 * body: { type, amountSatang, categoryName?, note?, occurredAt? }
 *
 * ⚖️ G2 ไม่บังคับให้ผ่าน pending_actions ที่นี่ เพราะผู้ใช้กดปุ่มเอง = ยืนยันแล้ว
 * (pending มีไว้กันกรณี AI ตีความผิดแล้วเขียนข้อมูลโดยผู้ใช้ไม่รู้ตัว)
 */
apiRouter.post(
  '/transactions',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const amountSatang = Number(body.amountSatang);
    if (!Number.isInteger(amountSatang)) {
      throw new TransactionError('amountSatang ต้องเป็นจำนวนเต็มหน่วยสตางค์', 400);
    }
    // ตรวจช่วงของยอดที่นี่ด้วย ไม่งั้น MoneyError จาก createTransaction จะหลุดไปเป็น 500
    assertTransactionAmount(amountSatang);

    const created = await createTransaction({
      userId: req.userId!,
      type: readType(body.type),
      amountSatang,
      categoryName: readText(body.categoryName, 'categoryName', 50) ?? undefined,
      note: readText(body.note, 'note', 500) ?? undefined,
      occurredAt: readOccurredAt(body.occurredAt),
      source: 'liff',
      parsedBy: 'manual',
    });

    res.status(201).json(created);
  })
);

/** แก้รายการ — ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยน / categoryName: null = ล้างหมวด */
apiRouter.patch(
  '/transactions/:transactionId',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: UpdateTransactionInput = {};

    if (body.type !== undefined) patch.type = readType(body.type);
    if (body.amountSatang !== undefined) {
      const amountSatang = Number(body.amountSatang);
      if (!Number.isInteger(amountSatang)) {
        throw new TransactionError('amountSatang ต้องเป็นจำนวนเต็มหน่วยสตางค์', 400);
      }
      patch.amountSatang = amountSatang;
    }
    if (body.categoryName !== undefined) patch.categoryName = readText(body.categoryName, 'categoryName', 50);
    if (body.note !== undefined) patch.note = readText(body.note, 'note', 500);
    if (body.occurredAt !== undefined) patch.occurredAt = readOccurredAt(body.occurredAt);

    if (Object.keys(patch).length === 0) {
      throw new TransactionError('ไม่มีฟิลด์ไหนให้แก้', 400);
    }

    res.json(await updateTransactionForUser(req.userId!, req.params.transactionId!, patch));
  })
);

/** ลบแบบ soft delete — กู้คืนได้ด้วย /restore */
apiRouter.delete(
  '/transactions/:transactionId',
  handle(async (req, res) => {
    await deleteTransactionForUser(req.userId!, req.params.transactionId!);
    res.json({ removed: true });
  })
);

apiRouter.post(
  '/transactions/:transactionId/restore',
  handle(async (req, res) => {
    await restoreTransactionForUser(req.userId!, req.params.transactionId!);
    res.json({ restored: true });
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

// ────────────────────────────────────────────────────────────────────────────
// แผนออม (SPEC §S5.3–§S5.6) — 🔴 Money Engine ห้ามมี AI ทุกตัวเลขมาจากสูตรตรงๆ
// ────────────────────────────────────────────────────────────────────────────

apiRouter.get(
  '/plans',
  handle(async (req, res) => {
    // เช็คแผนที่ออมครบเป้าก่อนอ่าน เพื่อให้ผู้ใช้เห็นสถานะ completed ทันทีที่เปิดหน้า
    // ไม่ต้องรอ job รอบถัดไป (S5.6) — ฟังก์ชันนี้ไม่ทำอะไรเลยถ้าไม่มีแผนไหนครบเป้า
    await completeReachedPlans(req.userId!);

    const [items, capacity] = await Promise.all([
      listPlansWithProgress(req.userId!),
      getPlanCapacity(req.userId!),
    ]);
    res.json({ items, capacity, available: true });
  })
);

/** กำลังออมอย่างเดียว (ไม่ต้องโหลดแผน) — หน้าเว็บใช้ตอนจะขึ้นฟอร์มสร้างแผน */
apiRouter.get(
  '/plans/capacity',
  handle(async (req, res) => {
    res.json(await getPlanCapacity(req.userId!));
  })
);

/**
 * สร้างชุด 3 ทางเลือก — body: { title, targetSatang, months? }
 * ทุกทางเลือกถูกบันทึกเป็น draft ผู้ใช้ต้องกดยืนยันอีกทีถึงจะ active (S5.4)
 */
apiRouter.post(
  '/plans',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (typeof body.title !== 'string') {
      throw new PlanError('ต้องส่ง title เป็นข้อความ', 400);
    }
    const targetSatang = Number(body.targetSatang);
    if (!Number.isInteger(targetSatang)) {
      throw new PlanError('targetSatang ต้องเป็นจำนวนเต็มหน่วยสตางค์', 400);
    }
    const months = body.months === undefined ? undefined : Number(body.months);

    res.status(201).json(await createSavingPlan(req.userId!, body.title, targetSatang, months));
  })
);

apiRouter.post(
  '/plans/:planId/confirm',
  handle(async (req, res) => {
    const plan = await confirmPlan(req.userId!, req.params.planId!);
    res.json({ planId: plan.id, status: plan.status, confirmedAt: plan.confirmed_at });
  })
);

/**
 * โอนเงินเข้าแผน — body: { amountSatang }
 * ⚖️ G7: บันทึกเป็น transfer ไม่ถูกนับเป็นรายจ่าย จึงไม่ไปหักยอด "ใช้ได้ต่อวัน" ซ้ำ
 * (S5.2 หัก monthly_save ของแผนออกไปแล้วรอบหนึ่ง)
 */
apiRouter.post(
  '/plans/:planId/transfer',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const amountSatang = Number(body.amountSatang);
    if (!Number.isInteger(amountSatang)) {
      throw new PlanError('amountSatang ต้องเป็นจำนวนเต็มหน่วยสตางค์', 400);
    }

    const result = await transferToPlan(req.userId!, req.params.planId!, amountSatang);

    // ครบเป้าพอดี — ส่งคำยินดีเลยไม่ต้องรอ job รอบเช้า
    // ใช้ dedup_key เดียวกับ job จึงไม่มีทางส่งซ้ำ
    if (result.justCompleted) {
      await notifyPlanCompleted(
        req.userId!,
        req.params.planId!,
        result.progress.title,
        result.progress.targetSatang
      ).catch(() => undefined); // ส่งไม่ได้ต้องไม่ทำให้การโอนที่สำเร็จแล้วกลายเป็นล้มเหลว
    }

    res.status(201).json(result);
  })
);

apiRouter.delete(
  '/plans/:planId',
  handle(async (req, res) => {
    const plan = await cancelPlan(req.userId!, req.params.planId!);
    res.json({ planId: plan.id, status: plan.status });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// งบรายหมวด (SPEC §S5.8) — ยอดใช้คำนวณสดจาก transactions ทุกครั้ง ไม่มีการเก็บยอดสะสม
// ────────────────────────────────────────────────────────────────────────────

/**
 * อ่านพารามิเตอร์เดือนจาก query string (`?month=2026-09`) ถ้าไม่ส่งมา = เดือนปัจจุบัน
 * ค่าที่ผิดรูปแบบต้องปฏิเสธ ไม่ใช่เงียบๆ แล้วตอบข้อมูลของเดือนอื่น
 */
function readMonthParam(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new BudgetError('พารามิเตอร์ month ต้องเป็นข้อความรูปแบบ YYYY-MM', 400);
  }
  const month = normalizeMonthIso(value);
  if (!month) {
    throw new BudgetError(`เดือนไม่ถูกต้อง: "${value}" (ต้องเป็น YYYY-MM)`, 400);
  }
  return month;
}

apiRouter.get(
  '/budgets',
  handle(async (req, res) => {
    const month = readMonthParam(req.query.month);
    const overview = await getBudgetOverview(req.userId!, month);
    res.json({ ...overview, available: true });
  })
);

/**
 * ตั้ง/แก้งบของหมวดหนึ่ง — body: { limitSatang: number, month?: "YYYY-MM" }
 * รับเป็น "สตางค์" เท่านั้นตาม G3 หน้าเว็บมีค่าเป็นสตางค์อยู่แล้ว (keypad ทำงานหน่วยสตางค์)
 */
apiRouter.put(
  '/budgets/:categoryId',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as { limitSatang?: unknown; month?: unknown };
    const limitSatang = Number(body.limitSatang);
    if (!Number.isInteger(limitSatang)) {
      throw new BudgetError('limitSatang ต้องเป็นจำนวนเต็มหน่วยสตางค์', 400);
    }

    const month = readMonthParam(body.month);
    const status = await setBudget(req.userId!, req.params.categoryId!, limitSatang, month);
    res.json(status);
  })
);

apiRouter.delete(
  '/budgets/:categoryId',
  handle(async (req, res) => {
    const month = readMonthParam(req.query.month);
    const removed = await removeBudget(req.userId!, req.params.categoryId!, month);
    res.json({ removed });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// รายการประจำ (SPEC §S5.9) — เงินเดือน ค่าหอ ค่าเน็ต ที่เข้า/ออกตามรอบ
//
// งาน `recurring` (S7, 06:00 ไทย) เป็นตัวสร้าง transaction จริงจากกฎพวกนี้
// route ชุดนี้ทำแค่ให้ผู้ใช้ตั้ง/ดู/ปิดกฎเท่านั้น ไม่สร้างรายการเอง
// ────────────────────────────────────────────────────────────────────────────

apiRouter.get(
  '/recurring',
  handle(async (req, res) => {
    const items = await listRecurringRules(req.userId!);
    res.json({ items, available: true });
  })
);

apiRouter.post(
  '/recurring',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (typeof body.label !== 'string') {
      throw new RecurringError('ต้องส่ง label เป็นข้อความ', 400);
    }
    if (body.type !== 'income' && body.type !== 'expense') {
      throw new RecurringError('type ต้องเป็น income หรือ expense', 400);
    }
    const amountSatang = Number(body.amountSatang);
    if (!Number.isInteger(amountSatang)) {
      throw new RecurringError('amountSatang ต้องเป็นจำนวนเต็มหน่วยสตางค์', 400);
    }

    const input: CreateRecurringInput = {
      userId: req.userId!,
      label: body.label,
      type: body.type,
      amountSatang,
      frequency: body.frequency as CreateRecurringInput['frequency'],
      dayOfMonth: body.dayOfMonth === undefined ? undefined : Number(body.dayOfMonth),
      dayOfWeek: body.dayOfWeek === undefined ? undefined : Number(body.dayOfWeek),
      startDate: typeof body.startDate === 'string' ? body.startDate : undefined,
      endDate: typeof body.endDate === 'string' ? body.endDate : null,
    };

    res.status(201).json(await createRecurringRule(input));
  })
);

apiRouter.delete(
  '/recurring/:ruleId',
  handle(async (req, res) => {
    const removed = await removeRecurringRule(req.userId!, req.params.ruleId!);
    if (!removed) {
      throw new RecurringError('ไม่พบรายการประจำนี้ในบัญชีของคุณ', 404);
    }
    res.json({ removed });
  })
);

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
