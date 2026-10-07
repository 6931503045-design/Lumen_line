// ไฟล์นี้ทำหน้าที่อะไร: ทางเดินของข้อความที่ regex อ่านไม่ออก (L4) — guard → AI → tool → คำตอบ
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S4 L4, §S11.2, §S12 / SRS FR-13
// ⚖️ กฎเหล็ก G1, G2, G4, G5, G6
//
// 🔴 แผนที่ความรับผิดชอบของไฟล์นี้ — อ่านก่อนแก้:
//   AI ทำแค่      : เลือก tool + ดึงคำที่ผู้ใช้พิมพ์
//   tools.ts ทำ   : ตรวจ args + แปลงบาท→สตางค์ + หารบิล + แปลงคำบอกวันที่
//   ไฟล์นี้ทำ      : หาหมวดจริงจาก hint, เรียก service, สร้าง pending สำหรับคำสั่งที่เขียนข้อมูล
//   S5 Money Engine: คำนวณเงินทุกบาท (ไฟล์นี้ไม่คิดเลขเงินเองแม้แต่ที่เดียว ⚖️ G1)
//
// ⚖️ G2: tool ที่เขียนข้อมูลจะไม่ถูกบันทึกจากที่นี่ มันถูกแปลงเป็น pending_actions
// แล้วรอผู้ใช้กดปุ่มเท่านั้น — ดู pending.service.ts
//
// ⚖️ G4: ทุกเส้นทางที่ AI ใช้ไม่ได้ คืน { kind: 'unavailable' } ให้ผู้เรียกไปใช้
// ทางด่วน regex และคำสั่งตายตัวต่อได้ ไม่มีเส้นทางไหนที่ throw ออกไปถึงผู้ใช้

import { AI_DISCLAIMER, CHAT_HISTORY_TURNS } from '../../config/constants';
import { listCategoriesByUser } from '../../db/queries/categories';
import { listTransactionsByUser } from '../../db/queries/transactions';
import { formatBaht, toSatang } from '../../utils/money';
import { getTodayIso } from '../../utils/thaiDate';
import { runCommand, type CommandName } from '../command.service';
import { createPending } from '../pending.service';
import { simulatePurchase } from '../simulate.service';
import { understandText } from './gemini';
import { checkAiAllowed, describeBlockReason } from './guard';
import { validateToolCall, type ValidatedEntry, type ValidatedToolCall } from './tools';

export type AiReply =
  /** AI ใช้ไม่ได้ (ปิด / โควตาหมด / ล่ม) — ผู้เรียกต้องตอบด้วยทางที่ไม่ใช้ AI (⚖️ G4) */
  | { kind: 'unavailable' }
  /** ตอบได้เลย — ทั้งกรณี AI ถามกลับ และกรณีอ่านข้อมูลมาตอบ */
  | { kind: 'text'; text: string }
  /** ต้องให้ผู้ใช้กดยืนยันก่อน (⚖️ G2) */
  | { kind: 'pending'; pendingId: string; text: string };

export type InterpretInput = {
  userId: string;
  text: string;
  /** วันนี้ตามเวลาไทย — ส่งเข้ามาเพื่อให้เทสต์ล็อกวันได้ */
  todayIso?: string;
  now?: Date;
};

// ────────────────────────────────────────────────────────────────────────────
// ประวัติแชทในหน่วยความจำ (SPEC §S11.2: 3 turn ล่าสุด หมดอายุ 30 นาที)
// ────────────────────────────────────────────────────────────────────────────
//
// ⚠️ จงใจเก็บใน memory ไม่ลง DB (⚖️ G5 เก็บน้อยที่สุดเท่าที่ทำงานได้)
// ผลที่ตามมาและยอมรับ: deploy ใหม่หรือ Render ปลุกเครื่องจากหลับ ประวัติจะหาย
// ผู้ใช้จะต้องพูดให้ครบในข้อความเดียว ซึ่งไม่ร้ายแรงเท่าการเก็บข้อความผู้ใช้ไว้ถาวร
//
// ⚠️ เก็บเฉพาะข้อความที่ redact แล้ว ไม่เก็บข้อความดิบ

const HISTORY_TTL_MS = 30 * 60 * 1000;

type HistoryEntry = { turns: string[]; updatedAt: number };

const history = new Map<string, HistoryEntry>();

function readHistory(userId: string, now: number): string[] {
  const entry = history.get(userId);
  if (!entry) return [];
  if (now - entry.updatedAt > HISTORY_TTL_MS) {
    history.delete(userId);
    return [];
  }
  return entry.turns;
}

function pushHistory(userId: string, safeText: string, now: number): void {
  const turns = [...readHistory(userId, now), safeText].slice(-CHAT_HISTORY_TURNS);
  history.set(userId, { turns, updatedAt: now });
}

/** ใช้ในเทสต์เท่านั้น — ล้างประวัติทั้งหมด */
export function resetAiHistoryForTest(): void {
  history.clear();
}

// ────────────────────────────────────────────────────────────────────────────
// ทางเดินหลัก
// ────────────────────────────────────────────────────────────────────────────

export async function interpretUserMessage(input: InterpretInput): Promise<AiReply> {
  const now = input.now ?? new Date();
  const todayIso = input.todayIso ?? getTodayIso(now);

  // ── ด่าน guard (⚖️ G4, G5) ───────────────────────────────────────────────
  const allowed = await checkAiAllowed({
    userId: input.userId,
    kind: 'text',
    text: input.text,
    todayIso,
  });

  if (!allowed.ok) {
    console.info('[ai/router] ไม่เรียก AI:', describeBlockReason(allowed.reason));
    return { kind: 'unavailable' };
  }

  // ── ถาม AI ว่าควรใช้ tool ไหน ─────────────────────────────────────────────
  const understood = await understandText({
    userId: input.userId,
    safeText: allowed.safeText,
    history: readHistory(input.userId, now.getTime()),
    today: now,
  });

  // เก็บประวัติหลังเรียกสำเร็จ ไม่ใช่ก่อน — ไม่งั้นข้อความที่ AI ล่มตอนอ่าน
  // จะค้างในประวัติแล้วไปกวนบริบทของข้อความถัดไปโดยไม่มีประโยชน์
  pushHistory(input.userId, allowed.safeText, now.getTime());

  if (understood.kind === 'error') {
    return { kind: 'unavailable' };
  }

  if (understood.kind === 'text') {
    // ⚖️ G1 ด่านสุดท้าย: AI ตอบเป็นข้อความได้เฉพาะ "ถามกลับ" ถ้ามีตัวเลขเงิน
    // ที่ไม่ได้อยู่ในข้อความของผู้ใช้ ให้ทิ้งทั้งคำตอบ (SPEC §S11.2)
    if (mentionsUnseenNumber(understood.text, input.text)) {
      console.warn('[ai/router] ทิ้งคำตอบของ AI เพราะมีตัวเลขที่ผู้ใช้ไม่ได้พิมพ์');
      return { kind: 'unavailable' };
    }
    return { kind: 'text', text: understood.text };
  }

  // ── ตรวจ args ด้วย Zod + sanity check (ด่านบังคับ) ────────────────────────
  const validated = validateToolCall(understood.name, understood.args, todayIso);
  if (!validated.ok) {
    console.info('[ai/router] args ไม่ผ่านด่าน:', validated.errorCode);
    return { kind: 'text', text: validated.askUser };
  }

  try {
    const reply = await runToolCall(input.userId, validated.call, todayIso, now);

    // ⚖️ G5: log ได้แค่ชื่อ tool กับผลลัพธ์ปลายทาง ห้ามใส่เนื้อหาคำตอบ
    // (คำตอบของ tool อ่านข้อมูลมียอดเงินจริงของผู้ใช้อยู่)
    //
    // ทำไมต้องมีบรรทัดนี้: ทางที่ล้มเหลวมี log ครบอยู่แล้ว แต่ทางที่สำเร็จเงียบสนิท
    // ทำให้แยกไม่ออกระหว่าง "ไม่มีใครส่งข้อความมา" กับ "ทำงานได้ปกติ"
    // ซึ่งตอนไล่ปัญหาบน Render เสียเวลามาก
    console.info(`[ai/router] ✅ tool "${validated.call.name}" → ${reply.kind}`);
    return reply;
  } catch (err) {
    console.error('[ai/router] ทำงานตาม tool ไม่สำเร็จ:', err);
    return { kind: 'unavailable' };
  }
}

async function runToolCall(
  userId: string,
  call: ValidatedToolCall,
  todayIso: string,
  now: Date
): Promise<AiReply> {
  switch (call.name) {
    // ── tool ที่เขียนข้อมูล → pending ทั้งหมด (⚖️ G2) ────────────────────────
    case 'create_transaction': {
      const entry = await resolveEntryCategory(userId, call.entry);
      const pending = await createPending({
        userId,
        action: 'create_transaction',
        payload: entry,
        source: 'chat',
        now,
      });
      return { kind: 'pending', pendingId: pending.id, text: pending.summary };
    }

    case 'create_transaction_batch': {
      const entries = [];
      for (const entry of call.entries) {
        entries.push(await resolveEntryCategory(userId, entry));
      }
      const pending = await createPending({
        userId,
        action: 'create_transaction_batch',
        payload: { entries },
        source: 'chat',
        now,
      });
      return { kind: 'pending', pendingId: pending.id, text: pending.summary };
    }

    case 'update_transaction': {
      const target = await resolveTarget(userId, call.target);
      if (!target) {
        return { kind: 'text', text: 'ไม่พบรายการที่จะแก้ครับ ลองพิมพ์ "สรุป" ดูรายการล่าสุดก่อนนะครับ' };
      }

      const changes: Record<string, unknown> = {};
      if (call.changes.amountSatang !== undefined) changes.amountSatang = call.changes.amountSatang;
      if (call.changes.item !== undefined) changes.item = call.changes.item;
      if (call.changes.occurredAtIso !== undefined) {
        changes.occurredAtIso = call.changes.occurredAtIso;
      }
      if (call.changes.categoryHint !== undefined) {
        const resolved = await resolveCategoryName(userId, call.changes.categoryHint, target.type);
        // หมวดที่หาไม่เจอ = ไม่แก้หมวด ดีกว่าไปสร้างหมวดใหม่ตามคำที่ AI เดามา
        if (resolved) changes.categoryName = resolved;
      }

      if (Object.keys(changes).length === 0) {
        return { kind: 'text', text: 'จะแก้อะไรครับ บอกยอด ชื่อรายการ หมวด หรือวันที่ได้เลย' };
      }

      const pending = await createPending({
        userId,
        action: 'update_transaction',
        payload: {
          transactionId: target.id,
          changes,
          before: {
            amountSatang: target.amountSatang,
            item: target.item,
            occurredAtIso: target.occurredAtIso,
          },
        },
        source: 'chat',
        now,
      });
      return { kind: 'pending', pendingId: pending.id, text: pending.summary };
    }

    case 'delete_transaction': {
      const target = await resolveTarget(userId, call.target);
      if (!target) {
        return { kind: 'text', text: 'ไม่พบรายการที่จะลบครับ' };
      }
      const pending = await createPending({
        userId,
        action: 'delete_transaction',
        payload: {
          transactionId: target.id,
          before: {
            amountSatang: target.amountSatang,
            item: target.item,
            occurredAtIso: target.occurredAtIso,
          },
        },
        source: 'chat',
        now,
      });
      return { kind: 'pending', pendingId: pending.id, text: pending.summary };
    }

    case 'create_recurring': {
      const pending = await createPending({
        userId,
        action: 'create_recurring',
        payload: {
          label: call.label,
          type: call.type,
          amountSatang: call.amountSatang,
          frequency: call.frequency,
          dayOfMonth: call.dayOfMonth,
          dayOfWeek: call.dayOfWeek,
        },
        source: 'chat',
        now,
      });
      return { kind: 'pending', pendingId: pending.id, text: pending.summary };
    }

    // ── tool ที่อ่านข้อมูล → ตอบได้เลย ตัวเลขทุกตัวมาจาก S5 (⚖️ G1) ──────────
    case 'get_summary': {
      // ใช้ runCommand ตัวเดียวกับคำสั่งตายตัว เพื่อให้ผู้ใช้ถามด้วยภาษาคน
      // แล้วได้ตัวเลขชุดเดียวกับที่พิมพ์ "สรุป" เป๊ะ ๆ ไม่มีสองความจริงในระบบ
      const command: CommandName =
        call.period === 'this_month'
          ? 'summary'
          : call.period === 'remaining'
            ? 'remaining'
            : call.period === 'budget'
              ? 'budget'
              : 'plans';
      return { kind: 'text', text: await runCommand(userId, command) };
    }

    case 'query_transactions':
      return { kind: 'text', text: await answerQueryTransactions(userId, call) };

    case 'simulate_purchase': {
      const result = await simulatePurchase(userId, call.priceSatang, todayIso);
      return { kind: 'text', text: describeSimulation(call.itemName, result) };
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// หาหมวดจริงจาก category_hint ที่ AI เดามา
// ────────────────────────────────────────────────────────────────────────────
//
// 🔴 ห้ามส่ง hint ของ AI เข้า findOrCreateCategory ตรง ๆ
// เพราะมันจะ "สร้างหมวดใหม่" ตามคำที่ AI แต่งมา ("กาแฟ", "ค่ากาแฟ", "เครื่องดื่ม"
// จาก 3 ข้อความ = 3 หมวดใหม่) แล้วหน้าสรุปรายหมวดของผู้ใช้จะพังในไม่กี่วัน
// ที่นี่จึงจับคู่กับหมวดที่ผู้ใช้ "มีอยู่แล้ว" เท่านั้น ไม่เจอก็ปล่อยให้ระบบเลือกค่าเริ่มต้น

/** หมวดสำรองของรายจ่ายเมื่อจับคู่ไม่ได้ (SPEC §S11.2 "ไม่เจอ = อื่นๆ") */
const FALLBACK_EXPENSE_CATEGORY = 'อื่นๆ';

async function resolveCategoryName(
  userId: string,
  hint: string | null,
  type: 'income' | 'expense'
): Promise<string | null> {
  if (!hint) return null;

  const categories = await listCategoriesByUser(userId);
  const sameType = categories.filter((category) => category.type === type);
  const needle = hint.trim().toLowerCase();
  if (!needle) return null;

  const exact = sameType.find((category) => category.name.trim().toLowerCase() === needle);
  if (exact) return exact.name;

  // จับคู่แบบมีคำของกันและกัน เช่น hint "ค่าอาหาร" กับหมวด "อาหาร"
  const partial = sameType.find((category) => {
    const name = category.name.trim().toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
  return partial ? partial.name : null;
}

/**
 * เติมชื่อหมวดจริงลงใน entry ก่อนเก็บเป็น payload ของ pending
 *
 * รายจ่ายที่จับคู่ไม่ได้ → "อื่นๆ" (เป็นหมวดเริ่มต้นที่ผู้ใช้ทุกคนมี)
 * รายรับที่จับคู่ไม่ได้ → ปล่อยว่าง เพราะไม่มีหมวด "อื่นๆ" ฝั่งรายรับ
 * และการโยนเงินเดือนเข้า "รายได้เสริม" คือการติดป้ายผิด ไม่ใช่ค่าเริ่มต้นที่ปลอดภัย
 */
async function resolveEntryCategory(
  userId: string,
  entry: ValidatedEntry
): Promise<Record<string, unknown>> {
  const matched = await resolveCategoryName(userId, entry.categoryHint, entry.type);
  const categoryName =
    matched ?? (entry.type === 'expense' ? FALLBACK_EXPENSE_CATEGORY : null);

  return {
    type: entry.type,
    amountSatang: entry.amountSatang,
    totalSatang: entry.totalSatang,
    splitCount: entry.splitCount,
    item: entry.item,
    occurredAtIso: entry.occurredAtIso,
    categoryName,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// หา "รายการที่ผู้ใช้หมายถึง" สำหรับคำสั่งแก้/ลบ
// ────────────────────────────────────────────────────────────────────────────

type ResolvedTarget = {
  id: string;
  type: 'income' | 'expense';
  amountSatang: number;
  item: string | null;
  occurredAtIso: string;
};

/**
 * แปลง target ของ AI เป็นรายการจริง — รับได้แค่ "last" หรือ id ที่เป็นของผู้ใช้คนนี้
 *
 * ⚖️ G6: ทั้งสองเส้นทางอ่านจากรายการของ userId เท่านั้น id ที่ AI แต่งขึ้นมา
 * หรือ id ของคนอื่นจะหาไม่เจอและคืน null
 */
async function resolveTarget(userId: string, target: string): Promise<ResolvedTarget | null> {
  // อ่านรายการล่าสุดมาชุดเล็ก ๆ แล้วหาในนั้น — ครอบทั้งกรณี "last" และกรณีระบุ id
  // ใช้ query เดียวกันกับที่หน้าเว็บใช้ จึงไม่ต้องเพิ่ม query ใหม่ให้ต้องดูแลอีกตัว
  const rows = await listTransactionsByUser(userId, 20);
  const wanted = target.trim().toLowerCase();

  const row = wanted === 'last' ? rows[0] : rows.find((candidate) => candidate.id === target.trim());
  if (!row) return null;

  // ⚖️ G7: รายการโอนเข้าแผนไม่ใช่รายรับหรือรายจ่าย ห้ามให้ AI แก้หรือลบผ่านทางนี้
  // (การถอนเงินออกจากแผนมีเส้นทางของตัวเองที่คิดยอดแผนให้ถูกด้วย)
  if (row.type === 'transfer') return null;

  return {
    id: row.id,
    type: row.type,
    amountSatang: toSatang(row.amount),
    item: row.note,
    occurredAtIso: row.occurred_at,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// คำตอบของ tool ที่อ่านข้อมูล
// ────────────────────────────────────────────────────────────────────────────

async function answerQueryTransactions(
  userId: string,
  call: Extract<ValidatedToolCall, { name: 'query_transactions' }>
): Promise<string> {
  // ดึงมาเผื่อไว้มากกว่าที่ขอ เพราะต้องกรองด้วยหมวด/คำค้นในโค้ดอีกชั้น
  const rows = await listTransactionsByUser(userId, 100);
  const keyword = call.keyword?.toLowerCase() ?? null;
  const categoryHint = call.categoryHint?.toLowerCase() ?? null;

  const matched = rows
    .filter((row) => row.type !== 'transfer') // ⚖️ G7
    .filter((row) => {
      if (keyword && !(row.note ?? '').toLowerCase().includes(keyword)) return false;
      if (categoryHint) {
        const name = (row.categories?.name ?? '').toLowerCase();
        if (!name.includes(categoryHint) && !categoryHint.includes(name)) return false;
      }
      return true;
    })
    .slice(0, call.limit);

  if (matched.length === 0) {
    return 'ไม่พบรายการที่ตรงกับที่ถามครับ';
  }

  return [
    `พบ ${matched.length} รายการ:`,
    ...matched.map((row) => {
      const sign = row.type === 'income' ? '+' : '-';
      const category = row.categories?.name ? ` · ${row.categories.name}` : '';
      return `• ${row.occurred_at.slice(0, 10)} ${row.note ?? 'ไม่มีชื่อ'} ${sign}${formatBaht(toSatang(row.amount))}${category}`;
    }),
  ].join('\n');
}

/**
 * เขียนคำตอบของการจำลองการซื้อจากผล S5.7
 *
 * ⚖️ G1: ตัวเลขทุกตัวในข้อความนี้มาจาก simulate.service ตรง ๆ
 * ฟังก์ชันนี้แค่จัดรูปแบบ ไม่มีการคำนวณใด ๆ เลยแม้แต่การบวกลบ
 */
function describeSimulation(
  itemName: string,
  result: Awaited<ReturnType<typeof simulatePurchase>>
): string {
  if (!result.hasBudget) {
    return [
      `"${itemName}" ราคา ${formatBaht(result.priceSatang)}`,
      'ยังบอกไม่ได้ว่ากระทบงบแค่ไหน เพราะยังไม่ได้ตั้งงบเดือนนี้ไว้ครับ',
      'ตั้งงบในหน้าเว็บก่อน แล้วถามอีกครั้งได้เลย',
    ].join('\n');
  }

  const lines = [
    `"${itemName}" ราคา ${formatBaht(result.priceSatang)}`,
    `งบเหลือตอนนี้ ${formatBaht(result.budgetLeftSatang)}`,
  ];

  if (result.tone === 'over') {
    lines.push(
      `ซื้อแล้วจะเกินงบ ${formatBaht(result.overBySatang)}`,
      result.monthsToSave === null
        ? 'ตอนนี้ยังไม่มีเงินเหลือต่อเดือนให้เก็บ จึงประเมินเวลาที่ต้องรอไม่ได้'
        : `ถ้าเก็บก่อนซื้อ ใช้เวลาประมาณ ${result.monthsToSave} เดือน`
    );
  } else {
    lines.push(
      `ซื้อแล้วเหลือ ${formatBaht(result.afterBuySatang)}`,
      `ใช้ได้วันละ ${formatBaht(result.perDayBeforeSatang)} → ${formatBaht(result.perDayAfterSatang)} (เหลืออีก ${result.daysLeft} วัน)`
    );
  }

  lines.push('', AI_DISCLAIMER);
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// ด่านสุดท้ายของ G1
// ────────────────────────────────────────────────────────────────────────────

/**
 * คำตอบแบบข้อความของ AI มีตัวเลขที่ผู้ใช้ไม่ได้พิมพ์มาไหม (SPEC §S11.2)
 *
 * ทำไมต้องเช็ค: โมเดลอาจ "ช่วย" ตอบว่า "เดือนนี้คุณใช้ไป 3,200 บาท" ซึ่งเป็นตัวเลข
 * ที่มันแต่งเอง ไม่ได้มาจากฐานข้อมูล ผู้ใช้อ่านแล้วเชื่อ = ข้อมูลการเงินผิดจากปากบอท
 * เจอแบบนี้ให้ทิ้งคำตอบทั้งก้อน แล้วไปใช้ทาง fallback แทน
 *
 * ตัวเลข 1-2 หลักปล่อยผ่าน เพราะมักเป็นลำดับข้อ ("1." "2.") หรือจำนวนคน ไม่ใช่ยอดเงิน
 */
function mentionsUnseenNumber(aiText: string, userText: string): boolean {
  const userDigits = new Set((userText.match(/\d+/g) ?? []).map((group) => group));
  const aiNumbers = aiText.match(/\d[\d,]*/g) ?? [];

  return aiNumbers.some((raw) => {
    const digits = raw.replace(/,/g, '');
    if (digits.length <= 2) return false;
    return !userDigits.has(digits);
  });
}
