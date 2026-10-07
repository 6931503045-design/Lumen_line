// ไฟล์นี้ทำหน้าที่อะไร: ด่านตรวจก่อนเรียก AI ทุกครั้ง — ปิด/โควตา/ความเป็นส่วนตัว
// ใครรับผิดชอบ: ③ AI
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S11.1 ① GUARD (6 ขั้นตามลำดับ)
// ⚖️ กฎเหล็ก G4, G5
//
// 🔴 ลำดับการตรวจสำคัญมาก และต้องเป็นลำดับนี้เท่านั้น:
//   1. ปิดอยู่ไหม  → ถูกที่สุด ไม่ต้องแตะ DB เลย
//   2. ผู้ใช้ปิดเองไหม → DB 1 query
//   3. โควตาต่อคน  → DB 1 query
//   4. โควตาทั้งระบบ → DB 1 query
// ถ้าสลับลำดับ (เช่น เช็คโควตาก่อนเช็คว่าปิดอยู่) ระบบที่ปิด AI ไว้จะยังยิง query ไปที่ DB
// ทุกข้อความที่ผู้ใช้พิมพ์ ซึ่งเปลืองเปล่า ๆ และขัดเจตนาของ G4
//
// ⚖️ G4: ฟังก์ชันนี้ "ห้าม throw" เด็ดขาด ไม่ว่า DB จะล่มหรืออะไรจะเกิดขึ้น
// ตอบ { ok: false } เสมอเมื่อมีปัญหา เพื่อให้ผู้เรียกไปใช้ทางที่ไม่ต้องมี AI ต่อได้
// ถ้าที่นี่ throw ข้อความของผู้ใช้จะพังทั้งข้อความ ทั้งที่ทางด่วน regex ยังทำงานได้อยู่

import { env } from '../../config/env';
import { countAiCallsByUserSince, countAiCallsGlobalSince } from '../../db/queries/logs';
import { isAiEnabledForUser } from '../../db/queries/users';
import { redactSensitiveText } from '../../utils/redact';
import { getTodayIso } from '../../utils/thaiDate';
import type { AiUsageKind } from '../../db/queries/logs';

/** สาเหตุที่ไม่ให้เรียก AI — ใช้เลือกข้อความตอบผู้ใช้และลง log */
export type GuardBlockReason =
  | 'ai_disabled_globally'
  | 'ai_disabled_for_user'
  | 'no_api_key'
  | 'user_daily_limit'
  | 'global_daily_limit';

export type GuardResult =
  | {
      ok: true;
      /** ข้อความที่ redact แล้ว — ผู้เรียกต้องส่งค่า "นี้" ให้ provider ไม่ใช่ข้อความเดิม (G5) */
      safeText: string;
    }
  | { ok: false; reason: GuardBlockReason };

export type GuardInput = {
  userId: string;
  kind: AiUsageKind;
  /** ข้อความดิบจากผู้ใช้ — guard จะ redact ให้ก่อนคืนออกไป */
  text: string;
  /** วันนี้ตามเวลาไทย (ISO date) — ส่งเข้ามาเพื่อให้เทสต์ล็อกวันได้ */
  todayIso?: string;
};

/**
 * เวลาเริ่มต้นของ "วันนี้" ตามเขตเวลาไทย ในรูป ISO timestamp
 *
 * โควตารายวันต้องรีเซ็ตตอนเที่ยงคืนเวลาไทย ไม่ใช่เที่ยงคืน UTC
 * (เที่ยงคืน UTC = 7 โมงเช้าที่กรุงเทพ ซึ่งผู้ใช้จะรู้สึกว่าโควตารีเซ็ตกลางวัน)
 */
function bangkokDayStartIso(todayIso: string): string {
  return `${todayIso}T00:00:00+07:00`;
}

export async function checkAiAllowed(input: GuardInput): Promise<GuardResult> {
  // ── ขั้น 1: ปิดทั้งระบบ (⚖️ G4) ──────────────────────────────────────────────
  if (!env.aiEnabled) {
    return { ok: false, reason: 'ai_disabled_globally' };
  }
  // ไม่มีกุญแจก็เรียกไม่ได้อยู่แล้ว — ตอบตรงนี้ดีกว่าปล่อยให้ SDK โยน error ทีหลัง
  if (!env.geminiApiKey) {
    return { ok: false, reason: 'no_api_key' };
  }

  const todayIso = input.todayIso ?? getTodayIso();
  const since = bangkokDayStartIso(todayIso);

  try {
    // ── ขั้น 2: ผู้ใช้คนนี้ปิด AI เองไหม (users.ai_enabled) ──────────────────
    if (!(await isAiEnabledForUser(input.userId))) {
      return { ok: false, reason: 'ai_disabled_for_user' };
    }

    // ── ขั้น 3: โควตาต่อคนต่อวัน ─────────────────────────────────────────────
    if (env.aiDailyLimitPerUser > 0) {
      const used = await countAiCallsByUserSince(input.userId, since);
      if (used >= env.aiDailyLimitPerUser) {
        return { ok: false, reason: 'user_daily_limit' };
      }
    }

    // ── ขั้น 4: โควตาทั้งระบบต่อวัน (0 = ไม่จำกัดในโค้ด) ──────────────────────
    // SPEC §S11.4 เตือนไว้ว่าเพดานในโค้ดอาจพังเพราะบั๊ก ให้ตั้งเพดานฝั่ง provider ด้วย
    if (env.aiDailyLimitGlobal > 0) {
      const usedGlobal = await countAiCallsGlobalSince(since);
      if (usedGlobal >= env.aiDailyLimitGlobal) {
        return { ok: false, reason: 'global_daily_limit' };
      }
    }
  } catch (err) {
    // นับโควตาไม่ได้ = ไม่รู้ว่าเกินหรือยัง → ไม่เรียก AI (⚖️ G4 มีทางไปต่ออยู่แล้ว)
    // เลือก "ปฏิเสธเมื่อไม่รู้" เพราะถ้าปล่อยผ่านเวลา DB ล่ม โควตาของ provider
    // อาจถูกใช้หมดในไม่กี่นาทีโดยไม่มีอะไรหยุดได้เลย
    console.error('[ai/guard] ตรวจโควตาไม่สำเร็จ ปฏิเสธการเรียก AI ไว้ก่อน:', err);
    return { ok: false, reason: 'global_daily_limit' };
  }

  // ── ขั้น 5: redact ก่อนส่งออก (⚖️ G5) ────────────────────────────────────────
  return { ok: true, safeText: redactSensitiveText(input.text) };
}

/** ข้อความอธิบายเหตุผลสำหรับขึ้น log — ไม่ได้ส่งให้ผู้ใช้อ่าน */
export function describeBlockReason(reason: GuardBlockReason): string {
  switch (reason) {
    case 'ai_disabled_globally':
      return 'AI_ENABLED=false';
    case 'ai_disabled_for_user':
      return 'users.ai_enabled=false';
    case 'no_api_key':
      return 'ไม่ได้ตั้ง GEMINI_API_KEY';
    case 'user_daily_limit':
      return `เกินโควตาต่อคนต่อวัน (${env.aiDailyLimitPerUser})`;
    case 'global_daily_limit':
      return `เกินโควตาทั้งระบบต่อวัน (${env.aiDailyLimitGlobal})`;
  }
}
