// ไฟล์นี้ทำหน้าที่อะไร: ประกาศ tool ทั้ง 8 ตัวให้ Gemini เลือก และ "บังคับ" ตรวจ args ด้วย Zod
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.2 ตาราง Tool catalog + หัวข้อ "การแปลง args เป็นข้อมูลจริง" + Sanity check
// ⚖️ กฎเหล็ก G1, G3
//
// 🔴 ไฟล์นี้คือด่านที่เชื่อถือได้ ไม่ใช่ system prompt
// prompt ขอให้โมเดล "ห้ามคำนวณ" ได้ แต่ขอแล้วโมเดลอาจไม่ทำตาม ส่วนที่นี่คือกฎที่เลี่ยงไม่ได้:
// args ที่ไม่ผ่าน Zod หรือไม่ผ่าน sanity check จะไม่มีทางเดินต่อไปถึงฐานข้อมูลได้เลย
//
// ⚖️ G1 ในทางปฏิบัติ: ตัวเลขที่โมเดลส่งมาถือเป็น "ข้อความที่ผู้ใช้พิมพ์" เท่านั้น
// การแปลงบาท → สตางค์ และการหารบิลทำที่นี่ด้วย money.ts ทั้งหมด โมเดลไม่ได้คิดเลขให้
// ถ้าโมเดลส่งผลการคำนวณมาเอง (เช่น หารแล้ว) เราไม่มีทางรู้ จึงต้องสั่งใน prompt ว่า
// ให้ส่งยอดเต็ม + split_count มา แล้วหารด้วย splitEvenly() ที่นี่ เพื่อให้เศษสตางค์ไม่หาย
//
// ⚠️ ส่วนที่ต่างจาก SPEC และเหตุผล:
//   1. tool #8 ใน SPEC ชื่อ simulate_purchase_or_plan (ทำทั้งจำลองการซื้อและเสนอแผนออม)
//      ที่นี่เหลือแค่ simulate_purchase เพราะการเสนอแผนออมคือการเขียน (สร้าง plan draft)
//      ซึ่งตาม G2 ต้องผ่าน pending_actions แต่ CHECK constraint ของคอลัมน์ action
//      ไม่มีชนิด create_plan ให้ใช้ — เปิดทางนี้จึงต้องแก้ schema ก่อน ยกเป็นงานถัดไป
//      (การสร้างแผนยังทำได้ตามปกติผ่านหน้าเว็บและคำสั่ง `ออม`)
//   2. tool #1 ของ SPEC มี arg plan_name สำหรับโอนเข้าแผน ที่นี่ไม่มี
//      เพราะคำสั่ง `ออม <จำนวน>` ใน command.service ดักไว้ก่อนถึง AI อยู่แล้ว
//      และเส้นทางนั้นให้ผู้ใช้เลือกแผนด้วย quick reply ซึ่งปลอดภัยกว่าให้ AI เดาชื่อแผน

import { Type, type FunctionDeclaration, type Schema } from '@google/genai';
import { z } from 'zod';
import { MAX_AMOUNT_SATANG } from '../../config/constants';
import { splitEvenly, toSatang } from '../../utils/money';
import { parseThaiDateText } from '../../utils/thaiDateText';

/** จำนวนรายการสูงสุดใน 1 batch (SPEC §S11.2 tool #2) */
export const MAX_BATCH_ITEMS = 10;

/** ช่วงจำนวนคนที่หารบิลได้ (SPEC §S11.2 Sanity check) */
export const MIN_SPLIT_COUNT = 2;
export const MAX_SPLIT_COUNT = 50;

/** จำนวนรายการสูงสุดที่ query_transactions คืนได้ (SPEC §S11.2 tool #6) */
export const MAX_QUERY_LIMIT = 10;

export const AI_TOOL_NAMES = [
  'create_transaction',
  'create_transaction_batch',
  'update_transaction',
  'delete_transaction',
  'get_summary',
  'query_transactions',
  'create_recurring',
  'simulate_purchase',
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];

export function isAiToolName(value: string): value is AiToolName {
  return (AI_TOOL_NAMES as readonly string[]).includes(value);
}

/** tool ที่ "เขียนข้อมูล" → ต้องผ่าน pending_actions ให้ผู้ใช้กดยืนยันก่อน (G2) */
const WRITE_TOOLS: ReadonlySet<string> = new Set([
  'create_transaction',
  'create_transaction_batch',
  'update_transaction',
  'delete_transaction',
  'create_recurring',
]);

export function isWriteTool(name: AiToolName): boolean {
  return WRITE_TOOLS.has(name);
}

// ────────────────────────────────────────────────────────────────────────────
// ส่วนที่ 1 — ประกาศ tool ให้ Gemini (schema แบบ OpenAPI ที่ provider เข้าใจ)
// ────────────────────────────────────────────────────────────────────────────
//
// ⚠️ คำอธิบายของแต่ละ arg ต้องเขียนให้โมเดลอ่านรู้เรื่อง เพราะนี่คือสิ่งเดียวที่
// บอกโมเดลว่าช่องไหนใส่อะไร — เขียนกำกวมแล้วโมเดลจะใส่ผิดช่องแล้วตกด่าน Zod
// ซึ่งผู้ใช้จะเห็นเป็น "ขอใหม่อีกครั้ง" บ่อยขึ้นโดยไม่รู้สาเหตุ

type EntryProperties = {
  type: Schema;
  amount: Schema;
  item: Schema;
  split_count: Schema;
  date_text: Schema;
  category_hint: Schema;
};

const ENTRY_PROPERTIES: EntryProperties = {
  type: {
    type: Type.STRING,
    enum: ['income', 'expense'],
    description: 'income = เงินเข้า, expense = เงินออก',
  },
  amount: {
    type: Type.NUMBER,
    description:
      'จำนวนเงินหน่วยบาท "ตามที่ผู้ใช้พิมพ์" ห้ามคำนวณหรือหารมาก่อน เช่น ผู้ใช้พิมพ์ 300 ให้ส่ง 300',
  },
  item: {
    type: Type.STRING,
    description: 'ชื่อรายการสั้น ๆ ตามที่ผู้ใช้พูด เช่น "กาแฟ" "ค่าเน็ต"',
  },
  split_count: {
    type: Type.INTEGER,
    description:
      'จำนวนคนที่หารบิลกัน ใส่เมื่อผู้ใช้บอกว่าหารกับคนอื่น (2-50) ระบบจะหารให้เอง ห้ามหารมาก่อน',
  },
  date_text: {
    type: Type.STRING,
    description:
      'คำบอกวันที่ตามที่ผู้ใช้พูดแบบคำต่อคำ เช่น "เมื่อวาน" "1 ต.ค." ห้ามแปลงเป็นวันที่เอง ไม่ระบุ = วันนี้',
  },
  category_hint: {
    type: Type.STRING,
    description: 'หมวดที่คาดว่าใช่ เช่น "อาหาร" "เดินทาง" ไม่มั่นใจก็ไม่ต้องใส่',
  },
};

export const geminiToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'create_transaction',
    description: 'บันทึกรายรับหรือรายจ่าย 1 รายการ ใช้เมื่อผู้ใช้เล่าว่าใช้เงินหรือได้เงินมา',
    parameters: {
      type: Type.OBJECT,
      properties: { ...ENTRY_PROPERTIES },
      required: ['type', 'amount', 'item'],
    },
  },
  {
    name: 'create_transaction_batch',
    description: `บันทึกหลายรายการในข้อความเดียว (สูงสุด ${MAX_BATCH_ITEMS} รายการ) ใช้เมื่อผู้ใช้เล่าหลายอย่างในประโยคเดียว`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          description: 'รายการทั้งหมดที่อยู่ในข้อความ',
          items: {
            type: Type.OBJECT,
            properties: { ...ENTRY_PROPERTIES },
            required: ['type', 'amount', 'item'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'update_transaction',
    description: 'แก้ไขรายการที่บันทึกไว้แล้ว ใช้เมื่อผู้ใช้บอกว่าจดผิด',
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: {
          type: Type.STRING,
          description: 'ใส่ "last" เมื่อผู้ใช้หมายถึงรายการล่าสุด หรือใส่ id ของรายการถ้ารู้',
        },
        changes: {
          type: Type.OBJECT,
          description: 'เฉพาะช่องที่ต้องแก้ ช่องที่ผู้ใช้ไม่ได้พูดถึงห้ามใส่',
          properties: {
            amount: ENTRY_PROPERTIES.amount,
            item: ENTRY_PROPERTIES.item,
            category_hint: ENTRY_PROPERTIES.category_hint,
            date_text: ENTRY_PROPERTIES.date_text,
          },
        },
      },
      required: ['target', 'changes'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'ลบรายการที่บันทึกไว้ ใช้เมื่อผู้ใช้บอกว่าจดเกินหรือไม่ต้องการรายการนั้น',
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: {
          type: Type.STRING,
          description: 'ใส่ "last" เมื่อผู้ใช้หมายถึงรายการล่าสุด หรือใส่ id ของรายการถ้ารู้',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'get_summary',
    description:
      'ดูตัวเลขสรุปของผู้ใช้ ใช้ทุกครั้งที่ผู้ใช้ถามเรื่องยอดเงิน ห้ามตอบตัวเลขเอง',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          enum: ['this_month', 'remaining', 'budget', 'plans'],
          description:
            'this_month = รายรับรายจ่ายเดือนนี้, remaining = ใช้ได้อีกวันละเท่าไหร่, budget = งบรายหมวด, plans = แผนออม',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'query_transactions',
    description: 'ค้นหารายการที่บันทึกไว้ ใช้เมื่อผู้ใช้ถามว่าจดอะไรไว้บ้าง',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category_hint: ENTRY_PROPERTIES.category_hint,
        keyword: { type: Type.STRING, description: 'คำที่ใช้ค้นในชื่อรายการ' },
        limit: {
          type: Type.INTEGER,
          description: `จำนวนรายการที่ต้องการ สูงสุด ${MAX_QUERY_LIMIT}`,
        },
      },
    },
  },
  {
    name: 'create_recurring',
    description: 'ตั้งรายการประจำที่เกิดซ้ำทุกรอบ เช่น เงินเดือน ค่าหอ ค่าเน็ต',
    parameters: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: 'ชื่อรายการประจำ เช่น "ค่าหอ"' },
        type: ENTRY_PROPERTIES.type,
        amount: ENTRY_PROPERTIES.amount,
        frequency: {
          type: Type.STRING,
          enum: ['daily', 'weekly', 'monthly', 'yearly'],
          description: 'ความถี่ของรอบ',
        },
        day: {
          type: Type.INTEGER,
          description:
            'วันของรอบ: monthly ใส่วันที่ 1-31, weekly ใส่ 0-6 (0 = อาทิตย์), นอกนั้นไม่ต้องใส่',
        },
      },
      required: ['label', 'type', 'amount', 'frequency'],
    },
  },
  {
    name: 'simulate_purchase',
    description:
      'จำลองว่าถ้าซื้อของชิ้นนี้แล้วงบเดือนนี้จะเหลือเท่าไหร่ ใช้เมื่อผู้ใช้ถามว่า "ซื้อได้ไหม"',
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_name: { type: Type.STRING, description: 'ชื่อของที่อยากซื้อ' },
        price: {
          type: Type.NUMBER,
          description: 'ราคาหน่วยบาทตามที่ผู้ใช้พิมพ์ ห้ามคำนวณ',
        },
      },
      required: ['item_name', 'price'],
    },
  },
];

// ────────────────────────────────────────────────────────────────────────────
// ส่วนที่ 2 — Zod + sanity check (ด่านบังคับ)
// ────────────────────────────────────────────────────────────────────────────

/** ราคาตามที่ผู้ใช้พิมพ์ (บาท) — รับ string ด้วยเพราะโมเดลส่งเลขมาเป็น string ได้ */
const bahtSchema = z.union([z.number(), z.string()]);

const itemSchema = z.string().trim().min(1).max(100);

const entrySchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: bahtSchema,
  item: itemSchema,
  split_count: z.union([z.number(), z.string()]).optional(),
  date_text: z.string().optional(),
  category_hint: z.string().trim().max(50).optional(),
});

const schemas = {
  create_transaction: entrySchema,
  create_transaction_batch: z.object({
    items: z.array(entrySchema).min(1).max(MAX_BATCH_ITEMS),
  }),
  update_transaction: z.object({
    target: z.string().trim().min(1),
    changes: z
      .object({
        amount: bahtSchema.optional(),
        item: itemSchema.optional(),
        category_hint: z.string().trim().max(50).optional(),
        date_text: z.string().optional(),
      })
      .refine((value) => Object.values(value).some((field) => field !== undefined), {
        message: 'ต้องมีสิ่งที่จะแก้อย่างน้อย 1 อย่าง',
      }),
  }),
  delete_transaction: z.object({ target: z.string().trim().min(1) }),
  get_summary: z.object({
    period: z.enum(['this_month', 'remaining', 'budget', 'plans']),
  }),
  query_transactions: z.object({
    category_hint: z.string().trim().max(50).optional(),
    keyword: z.string().trim().max(100).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
  }),
  create_recurring: z.object({
    label: z.string().trim().min(1).max(100),
    type: z.enum(['income', 'expense']),
    amount: bahtSchema,
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    day: z.union([z.number(), z.string()]).optional(),
  }),
  simulate_purchase: z.object({
    item_name: itemSchema,
    price: bahtSchema,
  }),
} as const;

/** รายการเงิน 1 ก้อนที่ตรวจและแปลงหน่วยเสร็จแล้ว พร้อมเขียนลง pending payload */
export type ValidatedEntry = {
  type: 'income' | 'expense';
  /** ยอดที่จะบันทึกจริง = ก้อนของผู้ใช้หลังหารบิลแล้ว (สตางค์) */
  amountSatang: number;
  /** ยอดเต็มก่อนหาร (สตางค์) — เก็บไว้โชว์ให้ผู้ใช้เห็นที่มาของตัวเลข */
  totalSatang: number;
  /** 1 = ไม่ได้หารบิล */
  splitCount: number;
  item: string;
  /** null = ใช้เวลาปัจจุบันตอนบันทึก */
  occurredAtIso: string | null;
  categoryHint: string | null;
};

export type ValidatedToolCall =
  | { name: 'create_transaction'; entry: ValidatedEntry }
  | { name: 'create_transaction_batch'; entries: ValidatedEntry[] }
  | {
      name: 'update_transaction';
      target: string;
      changes: {
        amountSatang?: number;
        item?: string;
        categoryHint?: string;
        occurredAtIso?: string;
      };
    }
  | { name: 'delete_transaction'; target: string }
  | { name: 'get_summary'; period: 'this_month' | 'remaining' | 'budget' | 'plans' }
  | {
      name: 'query_transactions';
      categoryHint: string | null;
      keyword: string | null;
      limit: number;
    }
  | {
      name: 'create_recurring';
      label: string;
      type: 'income' | 'expense';
      amountSatang: number;
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      dayOfMonth: number | null;
      dayOfWeek: number | null;
    }
  | { name: 'simulate_purchase'; itemName: string; priceSatang: number };

export type ToolValidation =
  | { ok: true; call: ValidatedToolCall }
  | {
      /**
       * ตกด่าน — errorCode ใช้ลง ai_usage_log (ภาษาอังกฤษ สั้น)
       * askUser คือข้อความไทยที่ส่งให้ผู้ใช้อ่าน ต้องบอกว่าต้องทำอะไรต่อ ไม่ใช่แค่บอกว่าผิด
       */
      ok: false;
      errorCode: string;
      askUser: string;
    };

function fail(errorCode: string, askUser: string): ToolValidation {
  return { ok: false, errorCode, askUser };
}

/**
 * แปลงบาท → สตางค์ โดยไม่ปล่อยให้ MoneyError หลุดออกไป
 * คืน null เมื่อแปลงไม่ได้ (รูปแบบผิด ติดลบ เกินเพดาน) ให้ผู้เรียกตัดสินใจเอง
 */
function toSatangOrNull(baht: unknown): number | null {
  if (typeof baht !== 'number' && typeof baht !== 'string') return null;
  if (typeof baht === 'number' && !Number.isFinite(baht)) return null;
  try {
    const satang = toSatang(baht);
    // toSatang ยอมรับ 0 แต่รายการเงิน 0 บาทไม่มีความหมาย (SPEC: 0 < amount)
    if (satang <= 0 || satang > MAX_AMOUNT_SATANG) return null;
    return satang;
  } catch {
    return null;
  }
}

/** จำนวนเต็มจากค่าที่โมเดลส่งมา (number หรือ string) — คืน null ถ้าไม่ใช่จำนวนเต็ม */
function toIntOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/** ตรวจและแปลงรายการเงิน 1 ก้อน — รวมการหารบิลด้วย splitEvenly (G1, G3) */
function validateEntry(
  raw: z.infer<typeof entrySchema>,
  todayIso: string | undefined
): { ok: true; entry: ValidatedEntry } | { ok: false; errorCode: string; askUser: string } {
  const totalSatang = toSatangOrNull(raw.amount);
  if (totalSatang === null) {
    return {
      ok: false,
      errorCode: 'bad_amount',
      askUser: 'ขอจำนวนเงินเป็นตัวเลขอีกครั้งนะครับ เช่น "กาแฟ 80"',
    };
  }

  let splitCount = 1;
  if (raw.split_count !== undefined) {
    const parsed = toIntOrNull(raw.split_count);
    if (parsed === null || parsed < MIN_SPLIT_COUNT || parsed > MAX_SPLIT_COUNT) {
      return {
        ok: false,
        errorCode: 'bad_split_count',
        askUser: `หารกันกี่คนครับ (ใส่ได้ ${MIN_SPLIT_COUNT}-${MAX_SPLIT_COUNT} คน)`,
      };
    }
    splitCount = parsed;
  }

  // ⚖️ G1 + G3: หารด้วย splitEvenly เท่านั้น เศษสตางค์จะถูกแจกให้ครบ ไม่หายไป
  // ก้อนของผู้ใช้คือก้อนแรก (ก้อนที่ได้เศษ) เพื่อไม่ให้ผู้ใช้จดน้อยกว่าที่จ่ายจริง
  const amountSatang =
    splitCount === 1 ? totalSatang : splitEvenly(totalSatang, splitCount)[0]!;

  let occurredAtIso: string | null = null;
  if (raw.date_text !== undefined && raw.date_text.trim() !== '') {
    occurredAtIso = parseThaiDateText(raw.date_text, todayIso);
    if (occurredAtIso === null) {
      return {
        ok: false,
        errorCode: 'bad_date_text',
        askUser: `ขอวันที่ชัดเจนกว่านี้นะครับ เช่น "เมื่อวาน" หรือ "1 ต.ค." (รายการของ "${raw.date_text.trim()}" ยังอ่านไม่ออก)`,
      };
    }
  }

  return {
    ok: true,
    entry: {
      type: raw.type,
      amountSatang,
      totalSatang,
      splitCount,
      item: raw.item,
      occurredAtIso,
      categoryHint: raw.category_hint?.trim() || null,
    },
  };
}

/**
 * ตรวจ tool call ที่โมเดลส่งมา แล้วคืนค่าที่แปลงหน่วยเสร็จแล้ว
 *
 * @param name ชื่อ tool ที่โมเดลเลือก (ยังไม่เชื่อว่าถูก)
 * @param rawArgs args ดิบจากโมเดล (ยังไม่เชื่อว่าถูก)
 * @param todayIso วันนี้ตามเวลาไทย — ส่งเข้ามาเพื่อให้เทสต์ล็อกวันได้
 */
export function validateToolCall(
  name: string,
  rawArgs: unknown,
  todayIso?: string
): ToolValidation {
  if (!isAiToolName(name)) {
    return fail('unknown_tool', 'ยังทำสิ่งนี้ให้ไม่ได้ครับ 🙏 ลองพิมพ์ "ช่วยเหลือ" เพื่อดูสิ่งที่ทำได้');
  }

  const parsed = schemas[name].safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return fail(
      'invalid_args',
      'ขอข้อความใหม่อีกครั้งนะครับ ยังจับใจความไม่ครบ เช่น "ค่าข้าว 60 เมื่อวาน"'
    );
  }

  switch (name) {
    case 'create_transaction': {
      const result = validateEntry(parsed.data as z.infer<typeof entrySchema>, todayIso);
      if (!result.ok) return fail(result.errorCode, result.askUser);
      return { ok: true, call: { name, entry: result.entry } };
    }

    case 'create_transaction_batch': {
      const { items } = parsed.data as z.infer<typeof schemas.create_transaction_batch>;
      const entries: ValidatedEntry[] = [];
      for (const item of items) {
        const result = validateEntry(item, todayIso);
        // ทั้ง batch ต้องผ่านหมดหรือไม่ผ่านเลย — บันทึกบางรายการแล้วทิ้งบางรายการ
        // ผู้ใช้จะไม่รู้ว่าอันไหนเข้าอันไหนไม่เข้า (SPEC §S12 "สำเร็จหรือล้มทั้งหมด")
        if (!result.ok) return fail(result.errorCode, result.askUser);
        entries.push(result.entry);
      }
      return { ok: true, call: { name, entries } };
    }

    case 'update_transaction': {
      const data = parsed.data as z.infer<typeof schemas.update_transaction>;
      const changes: Extract<ValidatedToolCall, { name: 'update_transaction' }>['changes'] = {};

      if (data.changes.amount !== undefined) {
        const satang = toSatangOrNull(data.changes.amount);
        if (satang === null) {
          return fail('bad_amount', 'ขอยอดใหม่เป็นตัวเลขอีกครั้งนะครับ');
        }
        changes.amountSatang = satang;
      }
      if (data.changes.item !== undefined) changes.item = data.changes.item;
      if (data.changes.category_hint !== undefined) {
        changes.categoryHint = data.changes.category_hint;
      }
      if (data.changes.date_text !== undefined && data.changes.date_text.trim() !== '') {
        const iso = parseThaiDateText(data.changes.date_text, todayIso);
        if (iso === null) {
          return fail('bad_date_text', 'ขอวันที่ชัดเจนกว่านี้นะครับ เช่น "เมื่อวาน" หรือ "1 ต.ค."');
        }
        changes.occurredAtIso = iso;
      }

      if (Object.keys(changes).length === 0) {
        return fail('empty_changes', 'จะแก้อะไรครับ บอกยอด ชื่อรายการ หมวด หรือวันที่ได้เลย');
      }
      return { ok: true, call: { name, target: data.target, changes } };
    }

    case 'delete_transaction': {
      const data = parsed.data as z.infer<typeof schemas.delete_transaction>;
      return { ok: true, call: { name, target: data.target } };
    }

    case 'get_summary': {
      const data = parsed.data as z.infer<typeof schemas.get_summary>;
      return { ok: true, call: { name, period: data.period } };
    }

    case 'query_transactions': {
      const data = parsed.data as z.infer<typeof schemas.query_transactions>;
      const rawLimit = data.limit === undefined ? MAX_QUERY_LIMIT : toIntOrNull(data.limit);
      // limit ที่เพี้ยนไม่ใช่เรื่องที่ต้องรบกวนผู้ใช้ — หนีบให้อยู่ในช่วงแล้วเดินต่อ
      const limit = Math.min(Math.max(rawLimit ?? MAX_QUERY_LIMIT, 1), MAX_QUERY_LIMIT);
      return {
        ok: true,
        call: {
          name,
          categoryHint: data.category_hint?.trim() || null,
          keyword: data.keyword?.trim() || null,
          limit,
        },
      };
    }

    case 'create_recurring': {
      const data = parsed.data as z.infer<typeof schemas.create_recurring>;
      const amountSatang = toSatangOrNull(data.amount);
      if (amountSatang === null) {
        return fail('bad_amount', 'ขอจำนวนเงินของรายการประจำเป็นตัวเลขอีกครั้งนะครับ');
      }

      let dayOfMonth: number | null = null;
      let dayOfWeek: number | null = null;

      if (data.day !== undefined) {
        const day = toIntOrNull(data.day);
        if (day === null) {
          return fail('bad_day', 'ขอวันของรอบเป็นตัวเลขอีกครั้งนะครับ');
        }
        if (data.frequency === 'monthly') {
          if (day < 1 || day > 31) {
            return fail('bad_day', 'วันที่ของเดือนต้องอยู่ระหว่าง 1-31 ครับ');
          }
          dayOfMonth = day;
        } else if (data.frequency === 'weekly') {
          if (day < 0 || day > 6) {
            return fail('bad_day', 'วันในสัปดาห์ต้องอยู่ระหว่าง 0 (อาทิตย์) ถึง 6 (เสาร์) ครับ');
          }
          dayOfWeek = day;
        }
        // daily / yearly ไม่ใช้ day — ทิ้งไปเงียบ ๆ ไม่ต้องรบกวนผู้ใช้
      }

      return {
        ok: true,
        call: {
          name,
          label: data.label,
          type: data.type,
          amountSatang,
          frequency: data.frequency,
          dayOfMonth,
          dayOfWeek,
        },
      };
    }

    case 'simulate_purchase': {
      const data = parsed.data as z.infer<typeof schemas.simulate_purchase>;
      const priceSatang = toSatangOrNull(data.price);
      if (priceSatang === null) {
        return fail('bad_amount', 'ขอราคาเป็นตัวเลขอีกครั้งนะครับ เช่น "ซื้อหูฟัง 1500 ได้ไหม"');
      }
      return { ok: true, call: { name, itemName: data.item_name, priceSatang } };
    }
  }
}
