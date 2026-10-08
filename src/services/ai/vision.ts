// ไฟล์นี้ทำหน้าที่อะไร: อ่านสลิปโอนเงินจากรูปด้วย Gemini Vision (T2 readSlip)
// ใครรับผิดชอบ: ⑤ Integration
// เขียนในสัปดาห์: W3
// อ้างอิง: SPEC.md §S9 Slip Reader + §S11.3 T2 (ใช้ guard เดียวกัน kind='vision')
// ⚖️ กฎเหล็ก G1, G4, G5
//
// 🔴 G5 ข้อบังคับที่เด็ดขาดที่สุดของไฟล์นี้: ห้ามเก็บรูปไว้ที่ใดเลย
// SPEC §S9 เขียนว่า "MUST NOT เก็บไฟล์รูปไว้ที่ใดเลย" — ไม่เขียนลงดิสก์ ไม่ลง DB
// ไม่ลง log ไม่ส่งต่อให้ service อื่น รูปเข้ามาเป็น Buffer ส่งให้ provider แล้วจบ
// สลิปโอนเงินมีทั้งชื่อคน เลขบัญชี และยอดเงิน หลุดครั้งเดียวเอากลับไม่ได้
//
// 🔴 G1: โมเดลมีหน้าที่ "อ่านตัวอักษรที่เห็นในรูป" เท่านั้น ห้ามคำนวณ ห้ามเดา
// การแปลงบาท → สตางค์ และการตรวจว่าวันที่สมเหตุสมผลเป็นงานของโค้ดในไฟล์นี้
//
// ⚠️ ไฟล์นี้ import @google/genai ได้ (เป็นข้อยกเว้นข้อที่ 2 ร่วมกับ gemini.ts)
// แต่ "ห้าม" เรียก provider โดยไม่ผ่าน guard — ดู readSlip() ที่เรียก checkAiAllowed เอง

import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { env } from '../../config/env';
import { MAX_AMOUNT_SATANG } from '../../config/constants';
import { insertAiUsageLog } from '../../db/queries/logs';
import { toSatang } from '../../utils/money';
import { redactSensitiveText } from '../../utils/redact';
import { checkAiAllowed, describeBlockReason } from './guard';

/** เผื่อนาฬิกาของธนาคารเดินเร็วกว่าเซิร์ฟเวอร์เล็กน้อย (SPEC §S9 "ไม่อยู่ในอนาคต") */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** ชนิดรูปที่รับ — LINE ส่งมาเป็น jpeg เสมอ แต่เผื่อ png ไว้ */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);

/** เพดานขนาดรูปที่ยอมส่งให้ provider (LINE ให้รูปได้ถึง 10 MB) */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export type SlipData = {
  /** ยอดบนสลิป หน่วยสตางค์ (แปลงด้วย money.ts แล้ว) */
  amountSatang: number;
  /** เวลาบนสลิปเป็น ISO timestamp เต็ม */
  occurredAtIso: string;
  /** ชื่อผู้รับโอน — ปิดเลขบัญชีแล้ว / null ถ้าอ่านไม่ได้ */
  receiver: string | null;
  /** ชื่อธนาคาร / null */
  bank: string | null;
  /** เลขอ้างอิงของรายการ ใช้กันซ้ำตาม S10 / null */
  refNumber: string | null;
};

export type ReadSlipResult =
  | { kind: 'slip'; slip: SlipData }
  /** AI ใช้ไม่ได้ (ปิด โควตาหมด ล่ม) — ผู้เรียกต้องบอกผู้ใช้ให้พิมพ์เอง (⚖️ G4) */
  | { kind: 'unavailable' }
  /** อ่านแล้วแต่ไม่ใช่สลิป หรือข้อมูลไม่ครบ/ไม่สมเหตุสมผล — บอกผู้ใช้ตรง ๆ */
  | { kind: 'unreadable'; reason: string };

export type ReadSlipInput = {
  userId: string;
  /** เนื้อรูปใน memory — ผู้เรียกต้องไม่เขียนลงดิสก์ก่อนส่งมา (⚖️ G5) */
  image: Buffer;
  mimeType: string;
  /** เวลาปัจจุบัน — ส่งเข้ามาเพื่อให้เทสต์ล็อกเวลาได้ */
  now?: Date;
};

// ────────────────────────────────────────────────────────────────────────────
// schema ที่บังคับให้โมเดลตอบเป็น JSON รูปเดียวเท่านั้น
// ────────────────────────────────────────────────────────────────────────────
//
// ใช้ responseSchema ของ provider ไม่ใช่แค่ขอใน prompt
// เพราะ "ขอ" แล้วโมเดลอาจตอบเป็นข้อความธรรมดาหรือ JSON ที่ห่อด้วย ```json
// ซึ่งต้องมานั่งแกะ — ส่วน responseSchema เป็นการบังคับฝั่ง provider

const slipResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    is_slip: {
      type: Type.BOOLEAN,
      description: 'true เฉพาะเมื่อรูปนี้เป็นสลิปโอนเงินหรือใบเสร็จจริง ๆ',
    },
    amount: {
      type: Type.NUMBER,
      description: 'ยอดเงินหน่วยบาทที่พิมพ์อยู่บนสลิป อ่านไม่ได้ให้เป็น null',
    },
    datetime: {
      type: Type.STRING,
      description:
        'วันและเวลาบนสลิปในรูป YYYY-MM-DD HH:MM (เวลาไทยตามที่เห็นบนสลิป) อ่านไม่ได้ให้เป็น null',
    },
    receiver: {
      type: Type.STRING,
      description: 'ชื่อผู้รับโอนหรือชื่อร้าน ห้ามใส่เลขบัญชี อ่านไม่ได้ให้เป็น null',
    },
    bank: { type: Type.STRING, description: 'ชื่อธนาคาร อ่านไม่ได้ให้เป็น null' },
    ref_number: {
      type: Type.STRING,
      description: 'เลขอ้างอิงรายการ (Ref / Transaction ID) อ่านไม่ได้ให้เป็น null',
    },
  },
  required: ['is_slip'],
};

/** ⚖️ G1 + G5 รวมอยู่ใน prompt นี้ — ตรงตาม SPEC §S9 */
const SLIP_PROMPT = [
  'อ่านสลิปโอนเงินในรูปนี้แล้วตอบเป็น JSON ตาม schema',
  '',
  'กฎที่ห้ามฝ่าฝืน:',
  '1. อ่านเฉพาะตัวอักษรที่เห็นในรูปจริง ๆ ห้ามเดา ห้ามคำนวณ ห้ามเติมให้ครบ',
  '2. ช่องไหนอ่านไม่ได้หรือไม่มีในรูป ให้เป็น null ห้ามใส่ค่าที่คิดว่าน่าจะใช่',
  '3. ห้ามส่งเลขบัญชีธนาคารมาในช่องใดทั้งสิ้น รวมทั้งใน receiver',
  '4. amount ให้ส่งตัวเลขที่พิมพ์บนสลิปตรง ๆ ไม่ต้องแปลงหน่วย',
  '5. ถ้ารูปนี้ไม่ใช่สลิปโอนเงินหรือใบเสร็จ ให้ is_slip เป็น false แล้วช่องอื่นเป็น null',
].join('\n');

// ────────────────────────────────────────────────────────────────────────────
// ตรวจผลที่โมเดลส่งกลับ (ด่านบังคับ)
// ────────────────────────────────────────────────────────────────────────────

const rawSlipSchema = z.object({
  is_slip: z.boolean(),
  amount: z.union([z.number(), z.string()]).nullable().optional(),
  datetime: z.string().nullable().optional(),
  receiver: z.string().nullable().optional(),
  bank: z.string().nullable().optional(),
  ref_number: z.string().nullable().optional(),
});

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return client;
}

/** ใช้ในเทสต์เท่านั้น */
export function resetVisionClientForTest(): void {
  client = null;
}

class TimeoutError extends Error {
  constructor() {
    super('vision: เกินเวลาที่กำหนด');
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
}

/**
 * T2 — อ่านสลิปจากรูป
 *
 * ฟังก์ชันนี้ไม่ throw: ความล้มเหลวทุกแบบคืนเป็น unavailable หรือ unreadable
 * เพื่อให้ผู้เรียกบอกผู้ใช้ให้พิมพ์เองได้เสมอ (⚖️ G4)
 *
 * 🔴 รูปถูกแปลงเป็น base64 ในตัวแปรท้องถิ่นเท่านั้น ไม่มีบรรทัดไหนในไฟล์นี้
 * เขียนรูปลงที่ใด และไม่มีบรรทัดไหน log เนื้อรูป
 */
export async function readSlip(input: ReadSlipInput): Promise<ReadSlipResult> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    return { kind: 'unreadable', reason: 'รองรับเฉพาะรูปภาพ JPEG หรือ PNG ครับ' };
  }
  if (input.image.byteLength === 0) {
    return { kind: 'unreadable', reason: 'รูปที่ส่งมาว่างเปล่าครับ ลองส่งใหม่อีกครั้ง' };
  }
  if (input.image.byteLength > MAX_IMAGE_BYTES) {
    return { kind: 'unreadable', reason: 'รูปใหญ่เกินไปครับ ลองถ่ายใหม่หรือย่อขนาดก่อนส่ง' };
  }

  // ── guard เดียวกับฝั่งข้อความ แต่ kind='vision' (SPEC §S11.3) ──────────────
  // ⚖️ G5: ไม่มีข้อความของผู้ใช้ในขั้นนี้ จึงส่ง text ว่างไป — guard ใช้แค่เช็คโควตา
  const allowed = await checkAiAllowed({
    userId: input.userId,
    kind: 'vision',
    text: '',
  });

  if (!allowed.ok) {
    console.info('[ai/vision] ไม่เรียก AI:', describeBlockReason(allowed.reason));
    return { kind: 'unavailable' };
  }

  const now = input.now ?? new Date();
  const startedAt = Date.now();

  // 1 ครั้ง + retry 1 ครั้ง เฉพาะ timeout / network / 5xx (เหมือน T1)
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await withTimeout(
        getClient().models.generateContent({
          model: env.geminiModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: input.image.toString('base64'),
                  },
                },
                { text: SLIP_PROMPT },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: slipResponseSchema,
            // อ่านตัวอักษรให้ตรง ไม่ใช่งานแต่ง — คำตอบต้องเหมือนกันทุกครั้งสำหรับรูปเดิม
            temperature: 0,
          },
        }),
        env.aiTimeoutMs
      );

      const latencyMs = Date.now() - startedAt;
      const text = response.text?.trim();

      if (!text) {
        await logVision(input.userId, false, 'empty_response', latencyMs);
        return { kind: 'unavailable' };
      }

      const validated = validateSlipJson(text, now);
      await logVision(
        input.userId,
        validated.kind === 'slip',
        validated.kind === 'slip' ? null : 'invalid_slip',
        latencyMs
      );

      // ⚖️ G5: log ได้แค่ว่าอ่านออกไหมกับใช้เวลาเท่าไหร่ ห้ามใส่ยอดเงินหรือชื่อผู้รับ
      console.info(
        `[ai/vision] ${validated.kind === 'slip' ? '✅ อ่านสลิปได้' : '⚠️ อ่านสลิปไม่ได้'} (${latencyMs}ms)`
      );
      return validated;
    } catch (err) {
      const retryable = isRetryable(err);
      if (retryable && attempt === 1) {
        console.error('[ai/vision] เรียกไม่สำเร็จ ลองอีกครั้ง:', err);
        continue;
      }

      const errorCode = err instanceof TimeoutError ? 'timeout' : 'provider_error';
      console.error(`[ai/vision] เรียกไม่สำเร็จ (${errorCode}):`, err);
      await logVision(input.userId, false, errorCode, Date.now() - startedAt);
      return { kind: 'unavailable' };
    }
  }

  return { kind: 'unavailable' };
}

async function logVision(
  userId: string,
  success: boolean,
  errorCode: string | null,
  latencyMs: number
): Promise<void> {
  await insertAiUsageLog({
    userId,
    kind: 'vision',
    toolName: 'read_slip',
    success,
    errorCode,
    latencyMs,
  });
}

function isRetryable(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  const message = err instanceof Error ? err.message : String(err);
  if (/\b5\d\d\b/.test(message)) return true;
  return /network|fetch failed|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|unavailable|overloaded/i.test(
    message
  );
}

/**
 * ตรวจ JSON ที่โมเดลส่งกลับ แล้วแปลงเป็นข้อมูลจริง (⚖️ G1)
 *
 * export ออกมาเพื่อให้เทสต์ยิงเคสแปลก ๆ ได้ตรง ๆ โดยไม่ต้อง mock provider
 */
export function validateSlipJson(rawText: string, now: Date): ReadSlipResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return { kind: 'unreadable', reason: 'อ่านสลิปไม่สำเร็จครับ ลองส่งรูปที่ชัดกว่านี้อีกครั้ง' };
  }

  const parsed = rawSlipSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { kind: 'unreadable', reason: 'อ่านสลิปไม่สำเร็จครับ ลองส่งรูปที่ชัดกว่านี้อีกครั้ง' };
  }

  const raw = parsed.data;

  if (!raw.is_slip) {
    return {
      kind: 'unreadable',
      reason: 'รูปนี้ดูไม่ใช่สลิปโอนเงินครับ 🙏 ถ้าจะจดรายการ พิมพ์แบบนี้ได้เลย เช่น "ค่าข้าว 60"',
    };
  }

  // ── amount: บังคับ และต้องผ่านเพดานเดียวกับทุกช่องทาง ───────────────────
  const amountSatang = toSatangOrNull(raw.amount);
  if (amountSatang === null) {
    return {
      kind: 'unreadable',
      reason: 'อ่านยอดเงินบนสลิปไม่ชัดครับ พิมพ์ยอดมาได้เลย เช่น "โอนค่าหอ 3500"',
    };
  }

  // ── datetime: บังคับ และห้ามอยู่ในอนาคต (SPEC §S9) ──────────────────────
  const occurredAt = parseSlipDateTime(raw.datetime ?? null);
  if (!occurredAt) {
    return {
      kind: 'unreadable',
      reason: 'อ่านวันเวลาบนสลิปไม่ชัดครับ ลองส่งรูปที่เห็นวันที่ชัดกว่านี้',
    };
  }
  if (occurredAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    // สลิปลงวันอนาคตแปลว่าอ่านผิด (เช่น อ่านปี พ.ศ. เป็น ค.ศ.) ไม่ใช่สลิปจริง
    return {
      kind: 'unreadable',
      reason: 'วันเวลาบนสลิปอ่านออกมาเป็นอนาคต ซึ่งไม่น่าถูกครับ ลองส่งรูปใหม่อีกครั้ง',
    };
  }

  return {
    kind: 'slip',
    slip: {
      amountSatang,
      occurredAtIso: occurredAt.toISOString(),
      // ⚖️ G5: ปิดเลขบัญชีในผลลัพธ์ตาม SPEC §S9 เผื่อโมเดลไม่ทำตาม prompt ข้อ 3
      // 🔴 ห้าม redact ref_number: เลขอ้างอิงยาว 9+ หลักจะถูกปิดไปทั้งก้อน
      // แล้วกุญแจกันซ้ำที่แม่นที่สุดตาม S10 จะใช้ไม่ได้เลย
      receiver: cleanText(raw.receiver, true),
      bank: cleanText(raw.bank, false),
      refNumber: cleanRefNumber(raw.ref_number),
    },
  };
}

function toSatangOrNull(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  try {
    // สลิปมักพิมพ์ยอดแบบมี comma คั่นหลักพัน ซึ่ง toSatang ไม่รับ ต้องเอาออกก่อน
    const cleaned = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
    const satang = toSatang(cleaned);
    if (satang <= 0 || satang > MAX_AMOUNT_SATANG) return null;
    return satang;
  } catch {
    return null;
  }
}

/**
 * แปลงวันเวลาบนสลิปเป็น Date
 *
 * รับ "YYYY-MM-DD HH:MM" ตามที่สั่งใน schema และเผื่อรูป ISO ที่โมเดลอาจส่งมา
 * ค่าที่ไม่มีเวลาติดมาถือเป็นเที่ยงวัน เพื่อไม่ให้เลื่อนวันข้ามเขตเวลา
 *
 * ⚠️ ตีความเวลาบนสลิปเป็น "เวลาไทย" เสมอ (+07:00) เพราะสลิปของธนาคารไทย
 * พิมพ์เวลาท้องถิ่น ถ้าตีความเป็น UTC รายการจะเลื่อนไป 7 ชั่วโมง ซึ่งพอทำให้
 * รายการตอนเช้าตรู่ข้ามไปเป็นวันก่อนหน้าได้
 */
function parseSlipDateTime(value: string | null): Date | null {
  if (!value) return null;

  const text = value.trim();
  if (!text) return null;

  // "YYYY-MM-DD HH:MM" หรือ "YYYY-MM-DDTHH:MM(:SS)" — ไม่มีเขตเวลาติดมา = เวลาไทย
  const local = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (local) {
    const [, year, month, day, hour, minute, second] = local;
    const time = hour === undefined ? '12:00:00' : `${hour}:${minute}:${second ?? '00'}`;
    const built = new Date(`${year}-${month}-${day}T${time}+07:00`);
    if (Number.isNaN(built.getTime())) return null;

    // 🔴 JS ปัดวันที่ที่ไม่มีอยู่จริงให้เองแบบเงียบ ๆ:
    //    new Date('2026-02-31T10:00:00+07:00') -> 3 มี.ค. 2026
    // ถ้าไม่ดักไว้ สลิปที่โมเดลอ่านวันผิดจะถูกบันทึกเป็นวันอื่นที่เลื่อนไป 3 วัน
    // โดยไม่มีใครรู้ — ต้องปฏิเสธ ไม่ใช่ปัดให้
    const bangkok = new Date(built.getTime() + 7 * 60 * 60 * 1000);
    const sameDate =
      bangkok.getUTCFullYear() === Number(year) &&
      bangkok.getUTCMonth() + 1 === Number(month) &&
      bangkok.getUTCDate() === Number(day);

    return sameDate ? built : null;
  }

  // มีเขตเวลาติดมาเอง (ลงท้าย Z หรือ +07:00) — เชื่อตามที่ส่งมา
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const built = new Date(text);
    return Number.isNaN(built.getTime()) ? null : built;
  }

  return null;
}

/** ตัดช่องว่าง จำกัดความยาว และปิดเลขบัญชีถ้าสั่ง — คืน null ถ้าไม่เหลืออะไร */
function cleanText(value: string | null | undefined, redact: boolean): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const safe = redact ? redactSensitiveText(trimmed) : trimmed;
  return safe.slice(0, 100);
}

/**
 * เลขอ้างอิง: เก็บเฉพาะตัวอักษรและตัวเลข
 *
 * ธนาคารแต่ละแห่งพิมพ์คนละรูป ("Ref: 0123 4567 89" / "0123456789")
 * ถ้าไม่ normalize สลิปใบเดิมที่ถ่ายสองครั้งอาจได้ ref ต่างกันแล้วกันซ้ำไม่ได้
 */
function cleanRefNumber(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^A-Za-z0-9]/g, '');
  if (normalized.length < 4) return null; // สั้นเกินกว่าจะเป็นเลขอ้างอิงจริง
  return normalized.slice(0, 64);
}
