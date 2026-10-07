// ไฟล์นี้ทำหน้าที่อะไร: wrapper สำหรับ Google Gemini SDK
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.2 T1 understandText (Function Calling)
// ⚖️ กฎเหล็ก G1, G4, G5
//
// 🔴 นี่คือ "จุดเดียว" ในระบบที่ import @google/genai ได้ (SPEC §S11)
// โมดูลอื่นห้าม import ตรง — เพื่อให้ทุกการเรียก AI ผ่าน guard + log ที่เดียวกันหมด
// ถ้ามีไฟล์ไหน import @google/genai เพิ่ม แปลว่ามีทางเลี่ยง guard เกิดขึ้นแล้ว
//
// ⚠️ เรื่อง retry: SPEC กำหนด "1 ครั้ง + retry 1 ครั้ง เฉพาะ timeout / network / 5xx"
// ห้าม retry เมื่อ 4xx เพราะนั่นคือคำขอของเราผิดเอง (args ไม่ถูก, กุญแจหมดอายุ,
// โควตา provider หมด) ยิงซ้ำก็ผิดซ้ำ ได้แต่เปลืองโควตาและทำให้ผู้ใช้รอนานขึ้นเท่าตัว
//
// ⚠️ เรื่อง timeout: ใช้ Promise.race แทน AbortSignal เพราะ SDK เวอร์ชันนี้ไม่รับ signal
// ผลข้างเคียงที่ยอมรับ: คำขอที่ช้าเกินยังวิ่งต่อข้างหลังจนจบ (เสียโควตา 1 ครั้ง)
// แต่ผู้ใช้ไม่ต้องรอ — ซึ่งสำคัญกว่า เพราะ reply token ของ LINE หมดอายุใน 30 วินาที

import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';
import { insertAiUsageLog } from '../../db/queries/logs';
import { getTodayIso } from '../../utils/thaiDate';
import { buildSystemPrompt } from './prompt';
import { geminiToolDeclarations } from './tools';

/** ผลจาก T1 — ได้อย่างใดอย่างหนึ่งเท่านั้น (SPEC §S11.2) */
export type UnderstandResult =
  | { kind: 'tool'; name: string; args: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'error'; errorCode: 'timeout' | 'provider_error' | 'empty_response' };

export type UnderstandInput = {
  userId: string;
  /** ข้อความที่ผ่าน redact จาก guard มาแล้ว (⚖️ G5) */
  safeText: string;
  /** ข้อความก่อนหน้าไม่เกิน CHATHISTORY turn ล่าสุด เรียงเก่าไปใหม่ (redact แล้ว) */
  history?: string[];
  /** วันนี้ — ส่งเข้ามาเพื่อให้เทสต์ล็อกวันได้ */
  today?: Date;
};

/**
 * client ถูกสร้างครั้งเดียวตอนเรียกใช้ครั้งแรก (lazy)
 *
 * ทำไมไม่สร้างตอน import: ไฟล์เทสต์ที่ไม่ได้แตะ AI เลยจะต้องมี GEMINI_API_KEY
 * ไปด้วยทุกไฟล์ และระบบที่ปิด AI ไว้ (⚖️ G4) ก็ไม่ควรต้องสร้าง client ทิ้งไว้เปล่า ๆ
 */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return client;
}

/** ใช้ในเทสต์เท่านั้น — ล้าง client ที่ cache ไว้ */
export function resetGeminiClientForTest(): void {
  client = null;
}

class TimeoutError extends Error {
  constructor() {
    super('gemini: เกินเวลาที่กำหนด');
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
 * error นี้ควร retry ไหม — เฉพาะ timeout / network / 5xx (SPEC §S11.2)
 *
 * SDK ของ Gemini ไม่ได้ให้ status code แบบตรงไปตรงมาทุกกรณี จึงต้องดูจากข้อความ
 * ซึ่งเปราะ แต่ดีกว่า retry ทุกอย่าง — เลือกผิดฝั่งไหนก็มีราคาที่ต้องจ่าย:
 * retry เกิน = เปลืองโควตา / retry ขาด = ผู้ใช้เจอ fallback ทั้งที่ลองอีกครั้งก็ได้
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;

  const message = err instanceof Error ? err.message : String(err);
  if (/\b5\d\d\b/.test(message)) return true;
  return /network|fetch failed|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|unavailable|overloaded/i.test(
    message
  );
}

/**
 * T1 — ให้ Gemini เลือก tool จากข้อความของผู้ใช้
 *
 * 🔴 ไม่ส่งผลของ tool กลับเข้าโมเดลเด็ดขาด (SPEC §S11.2)
 * โมเดลมีหน้าที่ "เลือกเครื่องมือและดึงคำ" จบแค่นั้น การคำนวณและการสร้างคำตอบ
 * เป็นงานของ S5 Money Engine กับโค้ดฝั่งเรา — ⚖️ G1
 *
 * ฟังก์ชันนี้ไม่ throw: ความล้มเหลวทุกแบบคืนเป็น { kind: 'error' } เพื่อให้ผู้เรียก
 * มีทางไปต่อแบบไม่ใช้ AI ได้เสมอ (⚖️ G4)
 */
export async function understandText(input: UnderstandInput): Promise<UnderstandResult> {
  const startedAt = Date.now();

  // 1 ครั้ง + retry 1 ครั้ง = วนได้ไม่เกิน 2 รอบ
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await withTimeout(
        getClient().models.generateContent({
          model: env.geminiModel,
          contents: buildContents(input),
          config: {
            systemInstruction: buildSystemPrompt(input.today),
            tools: [{ functionDeclarations: geminiToolDeclarations }],
            // temperature 0 เพราะงานนี้คือการ "อ่านให้ตรง" ไม่ใช่การแต่ง
            // คำตอบที่ต่างกันทุกครั้งสำหรับข้อความเดิมเป็นปัญหา ไม่ใช่คุณสมบัติ
            temperature: 0,
          },
        }),
        env.aiTimeoutMs
      );

      // เรียกมาหลาย tool = เอาตัวแรกตัวเดียว ไม่ไล่ทำทั้งชุด
      // (SPEC ให้ 1 ข้อความ = 1 การตัดสินใจ การทำหลายอย่างซ้อนกันผู้ใช้ตามไม่ทัน)
      const picked = response.functionCalls?.[0];
      const toolName = picked?.name;
      if (picked && toolName) {
        await insertAiUsageLog({
          userId: input.userId,
          kind: 'text',
          toolName,
          success: true,
          latencyMs: Date.now() - startedAt,
        });
        return { kind: 'tool', name: toolName, args: picked.args ?? {} };
      }

      const text = response.text?.trim();
      if (text) {
        await insertAiUsageLog({
          userId: input.userId,
          kind: 'text',
          toolName: null,
          success: true,
          latencyMs: Date.now() - startedAt,
        });
        return { kind: 'text', text };
      }

      // ตอบกลับมาแต่ว่างเปล่า (safety filter บล็อก หรือ finishReason ไม่ปกติ)
      // ไม่ใช่กรณีที่ retry แล้วจะดีขึ้น เพราะ temperature 0 ได้ผลเดิม
      await insertAiUsageLog({
        userId: input.userId,
        kind: 'text',
        success: false,
        errorCode: 'empty_response',
        latencyMs: Date.now() - startedAt,
      });
      return { kind: 'error', errorCode: 'empty_response' };
    } catch (err) {
      const retryable = isRetryable(err);
      const lastAttempt = attempt === 2;

      if (retryable && !lastAttempt) {
        console.error('[ai/gemini] เรียกไม่สำเร็จ ลองอีกครั้ง:', err);
        continue;
      }

      const errorCode = err instanceof TimeoutError ? 'timeout' : 'provider_error';
      console.error(`[ai/gemini] เรียกไม่สำเร็จ (${errorCode}):`, err);
      await insertAiUsageLog({
        userId: input.userId,
        kind: 'text',
        success: false,
        errorCode,
        latencyMs: Date.now() - startedAt,
      });
      return { kind: 'error', errorCode };
    }
  }

  // ไปถึงที่นี่ไม่ได้ในทางปฏิบัติ (ลูปคืนค่าหรือ throw ทุกเส้นทาง)
  // แต่ TypeScript ต้องเห็นว่าฟังก์ชันคืนค่าครบทุกทาง
  return { kind: 'error', errorCode: 'provider_error' };
}

/**
 * ประกอบ contents ให้ SDK — ประวัติเก่าก่อน ข้อความล่าสุดท้ายสุด
 *
 * ประวัติถูกส่งเป็น role 'user' ทั้งหมด ไม่แยก model/user เพราะเราไม่เก็บคำตอบของบอท
 * (⚖️ G5 เก็บน้อยที่สุดเท่าที่ทำงานได้) โมเดลยังเข้าใจบริบทได้จากลำดับข้อความ
 */
function buildContents(input: UnderstandInput) {
  const turns = [...(input.history ?? []), input.safeText];
  return turns.map((text) => ({ role: 'user' as const, parts: [{ text }] }));
}

/** วันนี้ตามเวลาไทยในรูป ISO date — ใช้ร่วมกันระหว่าง router และ tools */
export function todayIsoForAi(today?: Date): string {
  return today ? getTodayIso(today) : getTodayIso();
}
