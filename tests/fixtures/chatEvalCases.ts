// ไฟล์นี้ทำหน้าที่อะไร: ชุดประโยคที่ผู้ใช้พิมพ์จริง + คำตอบที่ "ควรได้" — ใช้วัดว่าบอทเข้าใจถูกแค่ไหน
// ใครรับผิดชอบ: ③ AI
//
// ใช้สองที่:
//   1. tests/chatEval.test.ts      — ทุกเคสที่ไม่ต้องใช้ AI (คำสั่ง / ทางด่วน / คู่มือ) รันใน npm test ทุกครั้ง
//   2. evals/aiTools.eval.ts       — เคส route 'ai' ส่งให้ Gemini จริง วัด % ที่เลือก tool ถูก (รันเอง: npm run eval:ai)
//
// 🔴 คำตอบที่ใส่คือสิ่งที่ "ถูกต้อง" ไม่ใช่สิ่งที่ระบบตอบอยู่ตอนนี้
// เคสที่ระบบยังตอบไม่ถูกให้ใส่ gap พร้อมเหตุผล — เทสต์จะคาดว่าเคสนั้น "ยังพัง" (it.fails)
// วันที่แก้แล้วเทสต์จะแดงเตือนให้ลบ gap ออก ตัวเลขความแม่นยำจึงไม่โกหก
//
// แหล่งที่มา: [จริง] = ประโยคจากแชททดสอบจริงของทีม · ที่เหลือคือรูปประโยคที่นักศึกษาพิมพ์บ่อย
// เพิ่มเคสใหม่ทุกครั้งที่เจอบอทตอบผิดในแชทจริง — ไฟล์นี้คือความจำของทีมว่าเคยพังตรงไหน

import type { CommandName } from '../../src/services/command.service';

export type ChatExpectation =
  /** คำสั่งตายตัว (สรุป/เหลือ/งบ/แผน/...) — ตอบจาก command.service ไม่ใช้ AI */
  | { route: 'command'; command: CommandName }
  /** ทางด่วนบันทึกเงิน — category: null = ไม่ตรวจหมวด (กำกวมจริง ๆ) */
  | { route: 'save'; type: 'expense' | 'income'; amountSatang: number; category: string | null }
  /** หลายรายการในข้อความเดียว อ่านด้วยกฎ บันทึกทันที */
  | { route: 'save_batch'; items: Array<{ type: 'expense' | 'income'; amountSatang: number; category: string | null }> }
  /** คำถามวิธีใช้ ตอบจากคู่มือ */
  | { route: 'help' }
  /** ต้องให้ AI ตีความ — tool/args ใช้กับการวัดผลแบบใช้ AI จริงเท่านั้น */
  | { route: 'ai'; tool?: string; args?: Record<string, unknown> }
  /** ต้องไม่บันทึกอะไรเลย (เช่น ยอดติดลบ) — จะไปทาง AI หรือคู่มือก็ได้ */
  | { route: 'not_saved' };

export type ChatEvalCase = {
  text: string;
  expect: ChatExpectation;
  /** ระบบยังทำไม่ได้ — บอกเหตุผลสั้น ๆ */
  gap?: string;
  /** ประโยคจากแชททดสอบจริง */
  real?: boolean;
};

export const CHAT_EVAL_CASES: ChatEvalCase[] = [
  // ── คำสั่งตายตัว ──────────────────────────────────────────────────────────
  { text: 'สรุป', expect: { route: 'command', command: 'summary' } },
  { text: 'สรุปเดือนนี้', expect: { route: 'command', command: 'summary' } },
  { text: 'เหลือ', expect: { route: 'command', command: 'remaining' }, real: true },
  { text: 'วันนี้เหลือเงินเท่าไหร่ครับ', expect: { route: 'command', command: 'remaining' } },
  { text: 'ใช้ได้อีกเท่าไหร่วันนี้', expect: { route: 'command', command: 'remaining' }, real: true },
  { text: 'วันนี้ใช้ได้อีกกี่บาท', expect: { route: 'command', command: 'remaining' } },
  { text: 'พรุ่งนี้ใช้ได้เท่าไหร่', expect: { route: 'command', command: 'remaining_tomorrow' } },
  { text: 'สัปดาห์นี้เหลือเท่าไหร่', expect: { route: 'command', command: 'remaining_week' } },
  { text: 'เดือนนี้เหลือเท่าไหร่', expect: { route: 'command', command: 'remaining_month' } },
  { text: 'งบ', expect: { route: 'command', command: 'budget' } },
  { text: 'งบเดือนนี้เหลือเท่าไหร่', expect: { route: 'command', command: 'budget' }, real: true },
  { text: 'แผน', expect: { route: 'command', command: 'plans' }, real: true },
  { text: 'เพดาน', expect: { route: 'command', command: 'limits' }, real: true },
  { text: 'เพดานการใช้จ่ายทั้งหมดเท่าไหร่', expect: { route: 'command', command: 'limits' }, real: true },
  { text: 'ช่วยเหลือ', expect: { route: 'command', command: 'help' } },
  { text: 'How much can I spend today?', expect: { route: 'command', command: 'remaining' } },

  // ── ทางด่วนบันทึกเงิน: รายจ่าย ─────────────────────────────────────────────
  { text: 'กาแฟ 80', expect: { route: 'save', type: 'expense', amountSatang: 8000, category: 'อาหาร' }, real: true },
  { text: 'กาแฟ ห้าสิบ', expect: { route: 'save', type: 'expense', amountSatang: 5000, category: 'อาหาร' } },
  { text: 'ข้าว 1.2k', expect: { route: 'save', type: 'expense', amountSatang: 120000, category: 'อาหาร' } },
  { text: 'ข้าวมันไก่ 50', expect: { route: 'save', type: 'expense', amountSatang: 5000, category: 'อาหาร' } },
  { text: 'ชานมไข่มุก 65', expect: { route: 'save', type: 'expense', amountSatang: 6500, category: 'อาหาร' } },
  { text: 'coffee 80', expect: { route: 'save', type: 'expense', amountSatang: 8000, category: 'อาหาร' } },
  { text: 'lineman 89', expect: { route: 'save', type: 'expense', amountSatang: 8900, category: 'อาหาร' } },
  { text: 'ค่าไฟ 900', expect: { route: 'save', type: 'expense', amountSatang: 90000, category: 'ที่พัก/บิล' } },
  { text: 'ค่าน้ำ 150', expect: { route: 'save', type: 'expense', amountSatang: 15000, category: 'ที่พัก/บิล' } },
  { text: 'ค่าหอ 3500', expect: { route: 'save', type: 'expense', amountSatang: 350000, category: 'ที่พัก/บิล' } },
  { text: 'ค่าเน็ต 1.2k', expect: { route: 'save', type: 'expense', amountSatang: 120000, category: 'ที่พัก/บิล' } },
  { text: 'grab 120', expect: { route: 'save', type: 'expense', amountSatang: 12000, category: 'เดินทาง' } },
  { text: 'ค่ารถเมล์ 15', expect: { route: 'save', type: 'expense', amountSatang: 1500, category: 'เดินทาง' } },
  { text: 'น้ำมัน 300', expect: { route: 'save', type: 'expense', amountSatang: 30000, category: 'เดินทาง' } },
  { text: 'bts 42', expect: { route: 'save', type: 'expense', amountSatang: 4200, category: 'เดินทาง' } },
  { text: 'ยา 120', expect: { route: 'save', type: 'expense', amountSatang: 12000, category: 'สุขภาพ' } },
  { text: 'หนังสือ 350', expect: { route: 'save', type: 'expense', amountSatang: 35000, category: 'การศึกษา' } },
  { text: 'ค่าเทอม 25000', expect: { route: 'save', type: 'expense', amountSatang: 2500000, category: 'การศึกษา' } },
  { text: 'ค่าชีท 80', expect: { route: 'save', type: 'expense', amountSatang: 8000, category: 'การศึกษา' } },
  { text: 'shopee 299', expect: { route: 'save', type: 'expense', amountSatang: 29900, category: 'ช้อปปิ้ง' } },
  { text: 'เสื้อ 390', expect: { route: 'save', type: 'expense', amountSatang: 39000, category: 'ช้อปปิ้ง' } },
  { text: 'netflix 169', expect: { route: 'save', type: 'expense', amountSatang: 16900, category: 'บันเทิง' } },
  { text: 'ดูหนัง 220', expect: { route: 'save', type: 'expense', amountSatang: 22000, category: 'บันเทิง' } },
  { text: 'อเมซอน 60', expect: { route: 'save', type: 'expense', amountSatang: 6000, category: 'อาหาร' } },
  { text: 'foodpanda 150', expect: { route: 'save', type: 'expense', amountSatang: 15000, category: 'อาหาร' } },
  { text: 'ais 299', expect: { route: 'save', type: 'expense', amountSatang: 29900, category: 'ที่พัก/บิล' } },
  { text: 'ค่าสมัครสอบ 500', expect: { route: 'save', type: 'expense', amountSatang: 50000, category: 'การศึกษา' } },
  { text: 'toeic 1800', expect: { route: 'save', type: 'expense', amountSatang: 180000, category: 'การศึกษา' } },
  { text: 'แว่นตา 1500', expect: { route: 'save', type: 'expense', amountSatang: 150000, category: 'สุขภาพ' } },
  { text: 'ค่าวิน 20', expect: { route: 'save', type: 'expense', amountSatang: 2000, category: 'เดินทาง' } },
  { text: 'ไส้กรอกอีสาน 50', expect: { route: 'save', type: 'expense', amountSatang: 5000, category: 'อาหาร' }, real: true },
  { text: 'ข้าวเย็น 46', expect: { route: 'save', type: 'expense', amountSatang: 4600, category: 'อาหาร' }, real: true },
  { text: 'กะเพราหมูกรอบ 60', expect: { route: 'save', type: 'expense', amountSatang: 6000, category: 'อาหาร' } },
  // "ค่าขนม" ฝั่งรายจ่าย = ของกิน (คำว่า "ขนม" ในตาราง) ไม่ใช่เงินที่พ่อแม่ให้
  { text: 'ค่าขนม 20', expect: { route: 'save', type: 'expense', amountSatang: 2000, category: 'อาหาร' } },
  // คำที่ไม่มีใครรู้จัก (ยังไม่ได้สอน) → "อื่นๆ" ถูกต้องตามกติกา ผู้ใช้กดเปลี่ยนหมวดแล้วระบบจะจำ
  { text: 'ซื้อกาแฟ 80', expect: { route: 'save', type: 'expense', amountSatang: 8000, category: 'อาหาร' } },
  { text: 'จ่ายค่าหอ 3500', expect: { route: 'save', type: 'expense', amountSatang: 350000, category: 'ที่พัก/บิล' } },
  { text: 'ร้านป้าแดง 50', expect: { route: 'save', type: 'expense', amountSatang: 5000, category: 'อื่นๆ' } },

  // ── หลายรายการในข้อความเดียว (เดิมไป AI ทั้งหมด) ─────────────────────────
  {
    text: 'เมื่อวานซื้อไส้กรอกอีสาน 50 บาท กับข้าวเย็น 46',
    expect: { route: 'save_batch', items: [
      { type: 'expense', amountSatang: 5000, category: 'อาหาร' },
      { type: 'expense', amountSatang: 4600, category: 'อาหาร' },
    ] },
    real: true,
  },
  {
    text: 'ข้าว 50 กาแฟ 40',
    expect: { route: 'save_batch', items: [
      { type: 'expense', amountSatang: 5000, category: 'อาหาร' },
      { type: 'expense', amountSatang: 4000, category: 'อาหาร' },
    ] },
  },
  {
    text: 'ค่ารถ 30, ข้าว 45, ชานม 55',
    expect: { route: 'save_batch', items: [
      { type: 'expense', amountSatang: 3000, category: 'เดินทาง' },
      { type: 'expense', amountSatang: 4500, category: 'อาหาร' },
      { type: 'expense', amountSatang: 5500, category: 'อาหาร' },
    ] },
  },
  {
    text: 'grab 120\nlineman 89',
    expect: { route: 'save_batch', items: [
      { type: 'expense', amountSatang: 12000, category: 'เดินทาง' },
      { type: 'expense', amountSatang: 8900, category: 'อาหาร' },
    ] },
  },
  {
    text: 'กับข้าว 30 และ ข้าวเหนียว 10',
    expect: { route: 'save_batch', items: [
      { type: 'expense', amountSatang: 3000, category: 'อาหาร' },
      { type: 'expense', amountSatang: 1000, category: 'อาหาร' },
    ] },
  },

  // ── ทางด่วนบันทึกเงิน: รายรับ ─────────────────────────────────────────────
  { text: '+เงินเดือน 15000', expect: { route: 'save', type: 'income', amountSatang: 1500000, category: 'เงินเดือน' } },
  { text: 'เงินเดือน 15000', expect: { route: 'save', type: 'income', amountSatang: 1500000, category: 'เงินเดือน' } },
  { text: 'ได้เงินค่าขนม 500', expect: { route: 'save', type: 'income', amountSatang: 50000, category: null } },
  { text: 'แม่โอน 3000', expect: { route: 'save', type: 'income', amountSatang: 300000, category: 'เงินคืน/รับโอน' } },
  { text: 'พ่อให้ 1000', expect: { route: 'save', type: 'income', amountSatang: 100000, category: 'เงินคืน/รับโอน' } },
  { text: 'salary 35000', expect: { route: 'save', type: 'income', amountSatang: 3500000, category: 'เงินเดือน' } },

  // ── ต้องไม่บันทึก ─────────────────────────────────────────────────────────
  { text: 'กาแฟ -80', expect: { route: 'not_saved' } },
  { text: 'สวัสดี', expect: { route: 'not_saved' } },

  // ── คำถามวิธีใช้ ──────────────────────────────────────────────────────────
  { text: 'ตั้งงบยังไง', expect: { route: 'help' } },
  { text: 'ลบรายการยังไง', expect: { route: 'help' } },

  // ── ต้องให้ AI ตีความ (tool/args ใช้วัดผลกับ Gemini จริง) ─────────────────
  {
    text: 'อยากสร้างแผนการออมซื้อ CPU 4500บาท ออมกี่เดือนดี',
    expect: { route: 'ai', tool: 'plan_goal', args: { target: 4500 } },
    real: true,
  },
  { text: 'อยากเก็บเงินซื้อโน้ตบุ๊ก 25000 ภายใน 10 เดือน', expect: { route: 'ai', tool: 'plan_goal', args: { target: 25000, months: 10 } } },
  // "กับเพื่อน" ไม่ใช่การหาร — split_count ต้องไม่มี (วัดผลจริงเคยได้ split_count=2 → บันทึกแค่ครึ่ง)
  { text: 'เมื่อวานกินข้าวกับเพื่อนหมดไปสามร้อย', expect: { route: 'ai', tool: 'create_transaction', args: { amount: 300, split_count: undefined } } },
  { text: 'ค่าข้าว 300 หาร 3 คน', expect: { route: 'ai', tool: 'create_transaction', args: { amount: 300, split_count: 3 } } },
  { text: 'ซื้อหูฟัง 1500 ได้ไหม', expect: { route: 'ai', tool: 'simulate_purchase', args: { price: 1500 } } },
  { text: 'แก้รายการล่าสุดเป็น 90', expect: { route: 'ai', tool: 'update_transaction' } },
  { text: 'ลบรายการล่าสุดให้หน่อย', expect: { route: 'ai', tool: 'delete_transaction' } },
  { text: 'ค่าหอจ่ายทุกวันที่ 5 เดือนละ 3500', expect: { route: 'ai', tool: 'create_recurring', args: { amount: 3500, frequency: 'monthly' } } },
  { text: 'เดือนนี้ใช้ค่ากาแฟไปกี่ครั้ง', expect: { route: 'ai', tool: 'query_transactions' } },
  // ── คำถามที่เดิมไปถึง AI — ตอนนี้จับจากคำสำคัญ ───────────────────────────────
  { text: 'งบอาหารเหลืออีกเท่าไหร่', expect: { route: 'command', command: 'budget' } },
  { text: 'วันนี้ใช้ไปเท่าไหร่', expect: { route: 'command', command: 'today' } },
  { text: 'เดือนนี้ใช้ไปเท่าไหร่แล้ว', expect: { route: 'command', command: 'summary' } },
  { text: 'สรุปให้หน่อย', expect: { route: 'command', command: 'summary' } },
  { text: 'แผนออมไปถึงไหนแล้ว', expect: { route: 'command', command: 'plans' } },
  { text: 'สวัสดีครับ', expect: { route: 'command', command: 'greeting' } },
  { text: 'ขอบคุณครับ', expect: { route: 'command', command: 'thanks' } },
];
