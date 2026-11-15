// ไฟล์นี้ทำหน้าที่อะไร: วัดว่าบอทเข้าใจประโยคจริงถูกทางไหม — ส่งเข้า handleText ตัวจริง แล้วดูว่าไปจบที่ไหน
// ใครรับผิดชอบ: ③ AI
// ⚖️ กฎเหล็ก G1, G3, G4
//
// ชุดประโยคอยู่ที่ tests/fixtures/chatEvalCases.ts — เพิ่มประโยคใหม่ทุกครั้งที่เจอบอทตอบผิดในแชทจริง
//
// ที่นี่ใช้ของจริงทุกชั้นที่ไม่แตะ DB/LINE/AI: ลำดับการตัดสินใจของ textHandler, ตารางคำสั่ง,
// ตัวแยกข้อความ (regex), ตัวอ่านเลขไทย, ตารางคำกลาง และการจับคู่หมวด — mock แค่ขอบนอก
// รายชื่อหมวดใช้หมวดตั้งต้นที่ผู้ใช้ใหม่ทุกคนได้ (DEFAULT_CATEGORIES)
//
// เคสที่ route = 'ai' ตรวจแค่ว่า "ส่งถึง AI" — การเลือก tool ของ Gemini วัดแยกที่ npm run eval:ai

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/users', () => ({ getUserIdByLineUserId: vi.fn() }));
vi.mock('../src/line/client', () => ({ lineClient: { showLoadingAnimation: vi.fn() } }));
vi.mock('../src/line/reply', () => ({
  replyText: vi.fn(),
  replyFlex: vi.fn(),
  replyTextWithQuickReply: vi.fn(),
}));
vi.mock('../src/db/queries/categories', () => ({
  listCategoriesByUser: vi.fn(),
  findOrCreateCategory: vi.fn(),
  findCategoryOwnedByUser: vi.fn(),
}));
vi.mock('../src/services/transaction.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/transaction.service')>()),
  createTransaction: vi.fn(),
}));
vi.mock('../src/services/command.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/command.service')>()),
  runCommand: vi.fn(),
  runCommandCard: vi.fn(),
  runSaveCommand: vi.fn(),
  runUndoLatest: vi.fn(),
}));
vi.mock('../src/services/ai/router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/ai/router')>()),
  interpretUserMessage: vi.fn(),
}));
vi.mock('../src/services/help.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/help.service')>();
  return { ...original, answerHelpTopic: vi.fn(original.answerHelpTopic) };
});

import { DEFAULT_CATEGORIES } from '../src/config/constants';
import { getUserIdByLineUserId } from '../src/db/queries/users';
import { listCategoriesByUser } from '../src/db/queries/categories';
import { createTransaction } from '../src/services/transaction.service';
import { runCommand, runCommandCard } from '../src/services/command.service';
import { interpretUserMessage } from '../src/services/ai/router';
import { answerHelpTopic } from '../src/services/help.service';
import { handleText } from '../src/handlers/textHandler';
import { CHAT_EVAL_CASES, type ChatEvalCase } from './fixtures/chatEvalCases';

type Outcome =
  | { route: 'command'; command: string }
  | { route: 'save'; type: string; amountSatang: number; category: string | null }
  | { route: 'help' }
  | { route: 'ai' }
  | { route: 'none' };

async function run(text: string): Promise<Outcome> {
  vi.clearAllMocks();
  vi.mocked(getUserIdByLineUserId).mockResolvedValue('user-1');
  vi.mocked(listCategoriesByUser).mockResolvedValue(
    DEFAULT_CATEGORIES.map((category, index) => ({
      id: `c${index}`,
      name: category.name,
      type: category.type,
      emoji: category.emoji,
      is_essential: category.isEssential,
      is_default: true,
    })) as never
  );
  vi.mocked(createTransaction).mockResolvedValue({
    id: 'tx', amountSatang: 0, type: 'expense', occurredAt: '2026-11-15T05:00:00Z',
    budgetAlert: null, budgetStatus: null,
  });
  vi.mocked(runCommandCard).mockResolvedValue(null);
  vi.mocked(runCommand).mockResolvedValue('ok');
  vi.mocked(interpretUserMessage).mockResolvedValue({ kind: 'text', text: 'ai' });

  await handleText({ replyToken: 'tok', source: { userId: 'U1' }, message: { type: 'text', text } });

  const command = vi.mocked(runCommandCard).mock.calls[0]?.[1];
  if (command) return { route: 'command', command };
  const saved = vi.mocked(createTransaction).mock.calls[0]?.[0];
  if (saved) {
    return { route: 'save', type: saved.type, amountSatang: saved.amountSatang, category: saved.categoryName ?? null };
  }
  if (vi.mocked(answerHelpTopic).mock.calls.length > 0) return { route: 'help' };
  if (vi.mocked(interpretUserMessage).mock.calls.length > 0) return { route: 'ai' };
  return { route: 'none' };
}

/** ผลตรงกับที่คาดไหม — คืนเหตุผลถ้าไม่ตรง */
function mismatch(testCase: ChatEvalCase, outcome: Outcome): string | null {
  const want = testCase.expect;
  if (want.route === 'not_saved') return outcome.route === 'save' ? 'บันทึกไปแล้ว ทั้งที่ต้องไม่บันทึก' : null;
  if (want.route !== outcome.route) return `ไปทาง ${outcome.route} แทน ${want.route}`;
  if (want.route === 'command' && outcome.route === 'command' && want.command !== outcome.command) {
    return `ได้คำสั่ง ${outcome.command} แทน ${want.command}`;
  }
  if (want.route === 'save' && outcome.route === 'save') {
    if (want.type !== outcome.type) return `ได้ ${outcome.type} แทน ${want.type}`;
    if (want.amountSatang !== outcome.amountSatang) return `ได้ยอด ${outcome.amountSatang} แทน ${want.amountSatang}`;
    if (want.category !== null && want.category !== outcome.category) {
      return `ได้หมวด ${outcome.category ?? '(ว่าง)'} แทน ${want.category}`;
    }
  }
  return null;
}

const results: Array<{ text: string; ok: boolean; gap?: string; why: string | null }> = [];

describe('ชุดประโยคจริง — บอทเข้าใจถูกทางไหม (ไม่ใช้ AI)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  for (const testCase of CHAT_EVAL_CASES) {
    const label = `${testCase.real ? '[จริง] ' : ''}"${testCase.text}" → ${describeExpect(testCase)}`;
    const body = async () => {
      const outcome = await run(testCase.text);
      const why = mismatch(testCase, outcome);
      results.push({ text: testCase.text, ok: why === null, gap: testCase.gap, why });
      expect(why).toBeNull();
    };
    // เคสที่ยังทำไม่ได้ (gap) คาดว่าพัง — แก้ได้แล้วเทสต์จะแดงเตือนให้ลบ gap ออก
    if (testCase.gap) it.fails(`${label}  ⚠️ ยังทำไม่ได้: ${testCase.gap}`, body);
    else it(label, body);
  }

  afterAll(() => {
    const passed = results.filter((r) => r.ok).length;
    console.log(`\n[chatEval] เข้าใจถูก ${passed}/${results.length} ประโยค (${Math.round((passed / results.length) * 100)}%)`);
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  ✗ "${r.text}" — ${r.why}${r.gap ? ` (gap: ${r.gap})` : ''}`);
    }
  });
});

function describeExpect(testCase: ChatEvalCase): string {
  const want = testCase.expect;
  if (want.route === 'command') return `คำสั่ง ${want.command}`;
  if (want.route === 'save') return `บันทึก${want.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${want.amountSatang / 100}${want.category ? ` หมวด ${want.category}` : ''}`;
  if (want.route === 'ai') return 'ส่งให้ AI';
  if (want.route === 'help') return 'ตอบจากคู่มือ';
  return 'ไม่บันทึก';
}
