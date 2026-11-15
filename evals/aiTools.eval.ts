// ไฟล์นี้ทำหน้าที่อะไร: วัดว่า Gemini "เลือก tool ถูก + ดึงตัวเลขตรง" กี่ % จากชุดประโยคจริง
// ใครรับผิดชอบ: ③ AI
// ⚖️ กฎเหล็ก G1, G5
//
// รัน:  GEMINI_API_KEY=xxx npm run eval:ai
//       (ใช้ GEMINI_MODEL เดียวกับระบบจริง ตั้งต่างได้ผ่าน env)
//
// 🔴 ไม่อยู่ใน npm test / CI โดยตั้งใจ: เรียก Gemini จริง เสียโควตา และผลแกว่งตามรุ่นโมเดล
// ใช้ตอนแก้ prompt.ts หรือคำอธิบาย tool ใน tools.ts — รันก่อนและหลังแก้ แล้วเทียบตัวเลข
// ถ้าไม่มี GEMINI_API_KEY ไฟล์นี้จะข้ามไปเฉย ๆ
//
// ⚖️ G5: ข้อความผ่าน redactSensitiveText ก่อนส่งเหมือนระบบจริง และไม่มีข้อมูลของผู้ใช้จริงในชุดประโยค
// ไม่บันทึก ai_usage_log (mock ไว้) — การวัดผลต้องไม่ปนสถิติการใช้งานจริง

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/logs', () => ({ insertAiUsageLog: vi.fn() }));

import { understandText } from '../src/services/ai/gemini';
import { redactSensitiveText } from '../src/utils/redact';
import { CHAT_EVAL_CASES } from '../tests/fixtures/chatEvalCases';

/** ต่ำกว่านี้ถือว่าแย่ลง — ปรับขึ้นได้เมื่อ prompt ดีขึ้นจนนิ่ง */
const MIN_ACCURACY = Number(process.env.EVAL_MIN_ACCURACY ?? 0.8);
/** เว้นช่วงระหว่างคำขอ กันชนเพดานต่อนาทีของ free tier */
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 1500);

const aiCases = CHAT_EVAL_CASES.filter(
  (c): c is typeof c & { expect: { route: 'ai'; tool: string; args?: Record<string, unknown> } } =>
    c.expect.route === 'ai' && typeof c.expect.tool === 'string'
);

function argsMismatch(expected: Record<string, unknown> | undefined, actual: Record<string, unknown>): string | null {
  for (const [key, want] of Object.entries(expected ?? {})) {
    const got = actual[key];
    const same = typeof want === 'number' ? Number(got) === want : got === want;
    if (!same) return `${key}=${JSON.stringify(got)} แทน ${JSON.stringify(want)}`;
  }
  return null;
}

describe.skipIf(!process.env.GEMINI_API_KEY)('Gemini เลือก tool ถูกไหม (ชุดประโยคจริง)', () => {
  it(`ถูกอย่างน้อย ${Math.round(MIN_ACCURACY * 100)}%`, async () => {
    const rows: string[] = [];
    let correct = 0;

    for (const testCase of aiCases) {
      const result = await understandText({
        userId: 'eval',
        safeText: redactSensitiveText(testCase.text),
        history: [],
        today: new Date(),
      });

      let verdict: string;
      if (result.kind !== 'tool') {
        verdict = result.kind === 'text' ? `ตอบเป็นข้อความ: "${result.text.slice(0, 60)}"` : `ล่ม: ${result.errorCode}`;
      } else if (result.name !== testCase.expect.tool) {
        verdict = `เลือก ${result.name} แทน ${testCase.expect.tool}`;
      } else {
        verdict = argsMismatch(testCase.expect.args, result.args as Record<string, unknown>) ?? 'ok';
      }

      if (verdict === 'ok') correct += 1;
      rows.push(`${verdict === 'ok' ? '✓' : '✗'} ${testCase.real ? '[จริง] ' : ''}"${testCase.text}"${verdict === 'ok' ? '' : ` — ${verdict}`}`);
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    const accuracy = correct / aiCases.length;
    console.log(`\n[eval:ai] ${process.env.GEMINI_MODEL ?? '(GEMINI_MODEL ค่าเริ่มต้น)'} ถูก ${correct}/${aiCases.length} (${Math.round(accuracy * 100)}%)\n${rows.join('\n')}`);
    expect(accuracy).toBeGreaterThanOrEqual(MIN_ACCURACY);
  }, 300_000);
});
