// ไฟล์นี้ทำหน้าที่อะไร: จัดการ pending actions เพื่อให้ผู้ใช้ยืนยันก่อนบันทึกจริง
// ใครรับผิดชอบ: ① Bot Core / ② Database
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S12 (วงจรและข้อกำหนดทั้ง 6 ข้อ)
// ⚖️ กฎเหล็ก G2, G6
//
// 🔴 นี่คือจุดที่ G2 เป็นรูปธรรม: "AI แตะข้อมูลได้เมื่อมนุษย์ยืนยันแล้วเท่านั้น"
// AI ไม่เคยเขียนฐานข้อมูลเอง มันเขียนได้แค่ "คำขอ" ลง pending_actions
// การเขียนจริงเกิดขึ้นในฟังก์ชัน confirmPendingAction() ซึ่งเรียกได้จากการที่
// ผู้ใช้กดปุ่มเท่านั้น (postbackHandler) — การกดปุ่มคือการยืนยันของมนุษย์
//
// ⚠️ payload ที่เก็บลง DB ต้อง "แปลงหน่วยเสร็จแล้ว" (สตางค์, วันที่จริง, ชื่อหมวดที่ตรวจแล้ว)
// ตาม §S12 เพื่อให้ตอนกดยืนยันไม่ต้องเรียก AI ซ้ำ ถ้าเก็บ args ดิบไว้แล้วแปลงตอนยืนยัน
// ผู้ใช้จะเห็นตัวเลขหนึ่งในการ์ด แต่ได้อีกตัวเลขในฐานข้อมูล ซึ่งผิดเจตนาของการยืนยัน

import { z } from 'zod';
import { PENDING_EXPIRE_HOURS } from '../config/constants';
import {
  cancelPendingAction,
  claimPendingAction,
  insertPendingAction,
  releasePendingAction,
  type PendingActionKind,
  type PendingActionRow,
  type PendingActionSource,
} from '../db/queries/pending';
import { createRecurringRule, RecurringError } from './recurring.service';
import {
  createTransaction,
  deleteTransactionForUser,
  TransactionError,
  updateTransactionForUser,
} from './transaction.service';
import { formatBaht } from '../utils/money';
import { isoDateToBangkokNoon } from '../utils/thaiDateText';

// ────────────────────────────────────────────────────────────────────────────
// รูปร่างของ payload แต่ละชนิด
// ────────────────────────────────────────────────────────────────────────────
//
// ตรวจด้วย Zod ตอนอ่านกลับมาจาก DB ด้วย ไม่ใช่เชื่อเลยว่าถูก
// เหตุผล: payload เป็น jsonb ที่ไม่มี schema บังคับฝั่ง DB แถวที่ถูกเขียนด้วยโค้ด
// เวอร์ชันเก่ากว่า (หรือถูกแก้มือ) อาจมีรูปร่างต่างไป ถ้าไม่ตรวจแล้วเอาไปใช้ตรง ๆ
// จะได้ NaN หรือ undefined ไหลเข้าไปถึงคอลัมน์เงิน

const entryPayloadSchema = z.object({
  type: z.enum(['income', 'expense']),
  amountSatang: z.number().int().positive(),
  totalSatang: z.number().int().positive(),
  splitCount: z.number().int().min(1),
  item: z.string().min(1),
  occurredAtIso: z.string().nullable(),
  categoryName: z.string().nullable(),
});

export type EntryPayload = z.infer<typeof entryPayloadSchema>;

const payloadSchemas = {
  create_transaction: entryPayloadSchema,
  create_transaction_batch: z.object({ entries: z.array(entryPayloadSchema).min(1) }),
  update_transaction: z.object({
    transactionId: z.string().min(1),
    changes: z.object({
      amountSatang: z.number().int().positive().optional(),
      item: z.string().min(1).optional(),
      categoryName: z.string().min(1).optional(),
      occurredAtIso: z.string().optional(),
    }),
    /** ค่าเดิมก่อนแก้ — เก็บไว้แสดง "ก่อน → หลัง" ในการ์ด (§S12) */
    before: z.object({
      amountSatang: z.number().int().positive(),
      item: z.string().nullable(),
      occurredAtIso: z.string(),
    }),
  }),
  delete_transaction: z.object({
    transactionId: z.string().min(1),
    before: z.object({
      amountSatang: z.number().int().positive(),
      item: z.string().nullable(),
      occurredAtIso: z.string(),
    }),
  }),
  create_recurring: z.object({
    label: z.string().min(1),
    type: z.enum(['income', 'expense']),
    amountSatang: z.number().int().positive(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    dayOfMonth: z.number().int().min(1).max(31).nullable(),
    dayOfWeek: z.number().int().min(0).max(6).nullable(),
  }),
} as const;

export class PendingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400
  ) {
    super(message);
    this.name = 'PendingError';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// สร้างคำขอ
// ────────────────────────────────────────────────────────────────────────────

export type CreatePendingInput = {
  userId: string;
  action: PendingActionKind;
  payload: Record<string, unknown>;
  source: PendingActionSource;
  /** เวลาอ้างอิงสำหรับคำนวณวันหมดอายุ — ส่งเข้ามาเพื่อให้เทสต์ล็อกเวลาได้ */
  now?: Date;
};

export type CreatedPending = {
  id: string;
  expiresAt: string;
  /** ข้อความสรุปสิ่งที่จะเกิดขึ้น ให้ผู้ใช้อ่านก่อนกดยืนยัน */
  summary: string;
};

export async function createPending(input: CreatePendingInput): Promise<CreatedPending> {
  // ตรวจ payload ก่อนเขียนลง DB ด้วย ไม่ใช่ตรวจแค่ตอนอ่านกลับ
  // จับความผิดพลาดตรงจุดที่เกิดเสมอ ดีกว่าจับตอนผู้ใช้กดยืนยันไปแล้ว
  const parsed = payloadSchemas[input.action].safeParse(input.payload);
  if (!parsed.success) {
    throw new PendingError(`payload ของ ${input.action} ไม่ถูกต้อง: ${parsed.error.message}`);
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + PENDING_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

  const row = await insertPendingAction({
    userId: input.userId,
    action: input.action,
    payload: input.payload,
    source: input.source,
    expiresAt,
  });

  return {
    id: row.id,
    expiresAt: row.expires_at,
    summary: describePending(input.action, parsed.data),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// ยืนยัน / ยกเลิก
// ────────────────────────────────────────────────────────────────────────────

export type ConfirmOutcome =
  | { kind: 'done'; text: string; transactionId?: string }
  | { kind: 'already'; text: string }
  | { kind: 'failed'; text: string };

/**
 * ผู้ใช้กดยืนยัน → บันทึกจริง (§S12)
 *
 * ลำดับสำคัญ:
 *   1. จองแถวแบบ atomic (claimPendingAction) — ไม่ได้แถว = กดซ้ำหรือหมดอายุ จบ
 *   2. บันทึกจริงผ่าน service ปกติ ซึ่งมีการตรวจของตัวเองอยู่แล้วทุกชั้น
 *   3. ถ้าขั้น 2 ล้มเหลว → คืนสถานะเป็น waiting ให้ผู้ใช้กดได้อีกครั้ง
 *
 * ⚖️ G6: ส่ง userId ลงไปทุกชั้น และ claim เช็คเจ้าของไปพร้อมกับการจองในคำสั่งเดียว
 */
export async function confirmPending(
  userId: string,
  pendingId: string,
  now: Date = new Date()
): Promise<ConfirmOutcome> {
  const claimed = await claimPendingAction(pendingId, userId, now.toISOString());
  if (!claimed) {
    return {
      kind: 'already',
      text: 'คำขอนี้ดำเนินการไปแล้ว หรือหมดอายุแล้วครับ (คำขอมีอายุ 24 ชั่วโมง)',
    };
  }

  try {
    return await executePending(userId, claimed);
  } catch (err) {
    // คืนสถานะก่อนเสมอ ไม่งั้นผู้ใช้กดยืนยันอีกครั้งไม่ได้เลย ทั้งที่ยังไม่ได้บันทึก
    await releasePendingAction(pendingId, userId);
    console.error('[pending.service] บันทึกจริงไม่สำเร็จหลังจองแถวแล้ว:', err);

    // error ของ service เป็นข้อความไทยที่ผู้ใช้อ่านรู้เรื่องอยู่แล้ว ส่งต่อได้
    const reason =
      err instanceof TransactionError || err instanceof RecurringError || err instanceof PendingError
        ? err.message
        : 'บันทึกไม่สำเร็จ ลองกดยืนยันอีกครั้งนะครับ 🙏';
    return { kind: 'failed', text: reason };
  }
}

/** ผู้ใช้กดยกเลิก — กดซ้ำแล้วไม่เกิดผลซ้ำ (G2) */
export async function cancelPending(userId: string, pendingId: string): Promise<ConfirmOutcome> {
  const cancelled = await cancelPendingAction(pendingId, userId);
  if (!cancelled) {
    return { kind: 'already', text: 'คำขอนี้ดำเนินการไปแล้ว หรือหมดอายุแล้วครับ' };
  }
  return { kind: 'done', text: 'ยกเลิกคำขอแล้วครับ ไม่มีอะไรถูกบันทึก ✅' };
}

/** เรียก service จริงตามชนิดของคำขอ — จุดเดียวที่ pending กลายเป็นข้อมูลจริง */
async function executePending(
  userId: string,
  row: PendingActionRow
): Promise<ConfirmOutcome> {
  const parsed = payloadSchemas[row.action].safeParse(row.payload);
  if (!parsed.success) {
    // payload เสีย = กดยืนยันอีกครั้งก็เสียเหมือนเดิม ไม่ควรคืนเป็น waiting
    // แต่ throw ที่นี่จะทำให้ confirmPending คืนสถานะ ซึ่งยอมรับได้
    // (ผู้ใช้กดได้อีกแต่จะเจอข้อความเดิม ดีกว่าแถวค้างสถานะที่กดไม่ได้)
    throw new PendingError('ข้อมูลคำขอนี้เสียหาย กรุณาพิมพ์ใหม่อีกครั้ง', 400);
  }

  switch (row.action) {
    case 'create_transaction': {
      const entry = parsed.data as EntryPayload;
      const tx = await saveEntry(userId, entry);
      return {
        kind: 'done',
        transactionId: tx.id,
        text: `บันทึกแล้วครับ ✅ ${entry.item} ${formatBaht(entry.amountSatang)}`,
      };
    }

    case 'create_transaction_batch': {
      const { entries } = parsed.data as z.infer<typeof payloadSchemas.create_transaction_batch>;
      // ⚠️ ไม่ใช่ atomic จริงระดับฐานข้อมูล: createTransaction เขียนทีละแถว
      // §S12 บอกว่า batch ควรเป็น insert ชุดเดียว แต่ createTransaction มีงานต่อแถว
      // (หาหมวด + เช็คงบ) ที่ทำรวมทีเดียวไม่ได้ ถ้าล้มกลางทาง รายการที่เขียนไปแล้ว
      // จะค้างอยู่ — จึงบอกผู้ใช้ตรง ๆ ว่าบันทึกได้กี่รายการ แล้วให้กดยืนยันซ้ำได้
      const saved: string[] = [];
      for (const entry of entries) {
        const tx = await saveEntry(userId, entry);
        saved.push(`${entry.item} ${formatBaht(entry.amountSatang)}`);
        void tx;
      }
      return {
        kind: 'done',
        text: [`บันทึก ${saved.length} รายการแล้วครับ ✅`, ...saved.map((line) => `• ${line}`)].join('\n'),
      };
    }

    case 'update_transaction': {
      const data = parsed.data as z.infer<typeof payloadSchemas.update_transaction>;
      await updateTransactionForUser(userId, data.transactionId, {
        ...(data.changes.amountSatang !== undefined
          ? { amountSatang: data.changes.amountSatang }
          : {}),
        ...(data.changes.item !== undefined ? { note: data.changes.item } : {}),
        ...(data.changes.categoryName !== undefined
          ? { categoryName: data.changes.categoryName }
          : {}),
        ...(data.changes.occurredAtIso !== undefined
          ? { occurredAt: isoDateToBangkokNoon(data.changes.occurredAtIso) }
          : {}),
      });
      return { kind: 'done', transactionId: data.transactionId, text: 'แก้รายการแล้วครับ ✅' };
    }

    case 'delete_transaction': {
      const data = parsed.data as z.infer<typeof payloadSchemas.delete_transaction>;
      await deleteTransactionForUser(userId, data.transactionId);
      return {
        kind: 'done',
        transactionId: data.transactionId,
        text: `ลบรายการแล้วครับ ✅ (${data.before.item ?? 'ไม่มีชื่อ'} ${formatBaht(data.before.amountSatang)})`,
      };
    }

    case 'create_recurring': {
      const data = parsed.data as z.infer<typeof payloadSchemas.create_recurring>;
      const rule = await createRecurringRule({
        userId,
        label: data.label,
        type: data.type,
        amountSatang: data.amountSatang,
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
      });
      return {
        kind: 'done',
        text: `ตั้งรายการประจำ "${rule.label}" แล้วครับ ✅ รอบถัดไป ${rule.nextRun}`,
      };
    }
  }
}

/** บันทึกรายการเงิน 1 ก้อนจาก payload — parsedBy เป็น 'ai' เสมอ เพราะมาจาก AI */
async function saveEntry(userId: string, entry: EntryPayload) {
  return createTransaction({
    userId,
    type: entry.type,
    amountSatang: entry.amountSatang,
    ...(entry.categoryName ? { categoryName: entry.categoryName } : {}),
    note: entry.item,
    ...(entry.occurredAtIso ? { occurredAt: isoDateToBangkokNoon(entry.occurredAtIso) } : {}),
    source: 'chat',
    parsedBy: 'ai',
  });
}

// ────────────────────────────────────────────────────────────────────────────
// ข้อความสรุปให้ผู้ใช้อ่านก่อนกดยืนยัน
// ────────────────────────────────────────────────────────────────────────────

/**
 * สรุปว่าคำขอนี้จะทำอะไร — ผู้ใช้ต้องอ่านแล้วตัดสินใจได้ทันทีว่าถูกหรือผิด
 *
 * ⚠️ ต้องโชว์ตัวเลขที่จะบันทึก "จริง" ไม่ใช่ตัวเลขที่ผู้ใช้พิมพ์
 * กรณีหารบิลสองตัวเลขนี้ต่างกัน ถ้าโชว์ยอดเต็มแล้วบันทึกยอดที่หารแล้ว
 * ผู้ใช้จะกดยืนยันโดยเข้าใจผิด = การยืนยันนั้นไม่มีความหมายตาม G2
 */
export function describePending(action: PendingActionKind, payload: unknown): string {
  switch (action) {
    case 'create_transaction': {
      const entry = payload as EntryPayload;
      return [describeEntry(entry), '', 'กดยืนยันเพื่อบันทึกนะครับ'].join('\n');
    }
    case 'create_transaction_batch': {
      const { entries } = payload as { entries: EntryPayload[] };
      return [
        `จะบันทึก ${entries.length} รายการ:`,
        ...entries.map((entry) => `• ${describeEntry(entry)}`),
        '',
        'กดยืนยันเพื่อบันทึกนะครับ',
      ].join('\n');
    }
    case 'update_transaction': {
      const data = payload as z.infer<typeof payloadSchemas.update_transaction>;
      const lines = [`จะแก้รายการ "${data.before.item ?? 'ไม่มีชื่อ'}"`];
      if (data.changes.amountSatang !== undefined) {
        lines.push(
          `ยอด: ${formatBaht(data.before.amountSatang)} → ${formatBaht(data.changes.amountSatang)}`
        );
      }
      if (data.changes.item !== undefined) {
        lines.push(`ชื่อ: ${data.before.item ?? 'ไม่มีชื่อ'} → ${data.changes.item}`);
      }
      if (data.changes.categoryName !== undefined) {
        lines.push(`หมวด: → ${data.changes.categoryName}`);
      }
      if (data.changes.occurredAtIso !== undefined) {
        lines.push(`วันที่: ${data.before.occurredAtIso.slice(0, 10)} → ${data.changes.occurredAtIso}`);
      }
      lines.push('', 'กดยืนยันเพื่อแก้นะครับ');
      return lines.join('\n');
    }
    case 'delete_transaction': {
      const data = payload as z.infer<typeof payloadSchemas.delete_transaction>;
      return [
        `จะลบรายการ "${data.before.item ?? 'ไม่มีชื่อ'}" ${formatBaht(data.before.amountSatang)}`,
        `วันที่ ${data.before.occurredAtIso.slice(0, 10)}`,
        '',
        'กดยืนยันเพื่อลบนะครับ (ลบแล้วเอากลับคืนได้)',
      ].join('\n');
    }
    case 'create_recurring': {
      const data = payload as z.infer<typeof payloadSchemas.create_recurring>;
      const label = data.type === 'income' ? 'รายรับประจำ' : 'รายจ่ายประจำ';
      return [
        `จะตั้ง${label} "${data.label}" ${formatBaht(data.amountSatang)}`,
        `ความถี่: ${describeFrequency(data.frequency, data.dayOfMonth, data.dayOfWeek)}`,
        '',
        'กดยืนยันเพื่อตั้งนะครับ',
      ].join('\n');
    }
  }
}

function describeEntry(entry: EntryPayload): string {
  const direction = entry.type === 'income' ? 'รายรับ' : 'รายจ่าย';
  const parts = [`${direction} "${entry.item}" ${formatBaht(entry.amountSatang)}`];

  if (entry.splitCount > 1) {
    parts.push(`(หาร ${entry.splitCount} คน จาก ${formatBaht(entry.totalSatang)})`);
  }
  if (entry.categoryName) {
    parts.push(`หมวด ${entry.categoryName}`);
  }
  if (entry.occurredAtIso) {
    parts.push(`วันที่ ${entry.occurredAtIso}`);
  }
  return parts.join(' ');
}

const WEEKDAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function describeFrequency(
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
  dayOfMonth: number | null,
  dayOfWeek: number | null
): string {
  switch (frequency) {
    case 'daily':
      return 'ทุกวัน';
    case 'weekly':
      return dayOfWeek === null ? 'ทุกสัปดาห์' : `ทุกวัน${WEEKDAY_NAMES[dayOfWeek] ?? ''}`;
    case 'monthly':
      return dayOfMonth === null ? 'ทุกเดือน' : `ทุกวันที่ ${dayOfMonth} ของเดือน`;
    case 'yearly':
      return 'ทุกปี';
  }
}
