// ไฟล์นี้ทำหน้าที่อะไร: query สำหรับ log ของ webhook, push, AI usage, และ audit trail
// ใครรับผิดชอบ: ① Bot Core / ⑤ Integration
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.1 ข้อ 6 "log ai_usage_log (ทุกครั้ง)" + §S11.1 ข้อ 2-3 (โควตารายวัน)
// ⚖️ กฎเหล็ก G5, G6
//
// ⚠️ ที่นี่ "ห้าม" เก็บข้อความของผู้ใช้ลง log เด็ดขาด
// ตาราง ai_usage_log ไม่มีคอลัมน์สำหรับ prompt หรือคำตอบ และจะไม่เพิ่มด้วย — ตาม G5
// เก็บแค่ว่า "ใครเรียก เรียกงานอะไร สำเร็จไหม ใช้เวลาเท่าไหร่" ซึ่งพอสำหรับดูโควตาและ debug
//
// ⚠️ ข้อยกเว้น G6 ที่ตั้งใจ: countAiCallsGlobalSince() นับของผู้ใช้ทุกคน
// เพราะโควตา AI_DAILY_LIMIT_GLOBAL เป็นเพดานของ "ทั้งระบบ" ไม่ใช่ของใครคนใดคนหนึ่ง
// (โควตา free tier ของ Gemini ผูกกับ API key ไม่ใช่ผูกกับผู้ใช้)

import { supabase } from '../supabase';

export type AiUsageKind = 'text' | 'vision';

export type InsertAiUsageLogInput = {
  /** null ได้เมื่อยังหาตัวผู้ใช้ไม่ได้ (เช่น ถูกบล็อกก่อนรู้ว่าใคร) — คอลัมน์เป็น nullable */
  userId: string | null;
  kind: AiUsageKind;
  /** ชื่อ tool ที่ AI เลือก — null เมื่อ AI ตอบเป็นข้อความ หรือเรียกไม่สำเร็จ */
  toolName?: string | null;
  success: boolean;
  /** รหัสสั้น ๆ ของสาเหตุที่ล้มเหลว เช่น 'timeout', 'invalid_args', 'no_api_key' */
  errorCode?: string | null;
  latencyMs?: number | null;
};

/**
 * บันทึกการเรียก AI 1 ครั้ง
 *
 * 🔴 ฟังก์ชันนี้ "ห้ามโยน error ออกไป" เด็ดขาด
 * log ล้มเหลวไม่ใช่เหตุผลที่จะทำให้คำตอบที่ผู้ใช้รออยู่พังไปด้วย
 * (ถ้า throw ที่นี่ ผู้ใช้จะได้ "บันทึกไม่สำเร็จ" ทั้งที่ AI ทำงานสำเร็จแล้ว)
 */
export async function insertAiUsageLog(input: InsertAiUsageLogInput): Promise<void> {
  try {
    const { error } = await supabase.from('ai_usage_log').insert({
      user_id: input.userId,
      kind: input.kind,
      tool_name: input.toolName ?? null,
      success: input.success,
      error_code: input.errorCode ?? null,
      latency_ms: input.latencyMs ?? null,
    });

    if (error) {
      console.error('[queries/logs] insertAiUsageLog error:', error.message);
    }
  } catch (err) {
    console.error('[queries/logs] insertAiUsageLog ล้มเหลว:', err);
  }
}

/**
 * นับจำนวนครั้งที่ผู้ใช้คนนี้เรียก AI ตั้งแต่เวลาที่กำหนด (⚖️ G6: กรอง user_id)
 *
 * นับทั้งที่สำเร็จและไม่สำเร็จ เพราะการเรียกที่ล้มเหลวก็กินโควตาของ provider ไปแล้ว
 * (ยกเว้นที่ถูก guard บล็อกไว้ก่อน ซึ่งไม่ได้ยิงออกไปจึงไม่ถูกบันทึกเป็น usage)
 */
export async function countAiCallsByUserSince(userId: string, sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sinceIso);

  if (error) {
    throw error;
  }
  return count ?? 0;
}

/** นับการเรียก AI ของทั้งระบบตั้งแต่เวลาที่กำหนด (ดูหมายเหตุข้อยกเว้น G6 ด้านบน) */
export async function countAiCallsGlobalSince(sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);

  if (error) {
    throw error;
  }
  return count ?? 0;
}
