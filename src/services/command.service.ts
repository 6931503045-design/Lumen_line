// ไฟล์นี้ทำหน้าที่อะไร: แปลคำสั่งตายตัวในแชทเป็นข้อความตอบกลับ
// ใครรับผิดชอบ: ① Bot Core
// เขียนในสัปดาห์: W2
// อ้างอิง: SPEC.md §S1 ตาราง "คำสั่งในแชท", §S5.2, §S5.6, §S5.8
// ⚖️ กฎเหล็ก G1, G4
//
// G4 — ทุกคำสั่งที่นี่ทำงานได้เมื่อ AI_ENABLED=false เพราะไม่มี AI เกี่ยวข้องเลย
//      ข้อความทั้งหมดประกอบจากตัวเลขที่ service คำนวณมาให้ ไม่มีการสร้างประโยคด้วยโมเดล
//
// SPEC §S1: "การจับคำสั่งตายตัวต้องตรงทั้งข้อความ (ตัดช่องว่างหัวท้าย)
//            ยกเว้น `ออม <จำนวน>` ที่ใช้ regex"
// จับแบบตรงทั้งข้อความโดยตั้งใจ ไม่ใช่ includes() — ไม่งั้น "จ่ายค่าสรุปโครงการ 200"
// จะถูกมองว่าเป็นคำสั่ง `สรุป` แทนที่จะเป็นการบันทึกเงิน

import { PRIVACY_NOTICE } from '../config/privacy';
import { formatBaht, toSatang } from '../utils/money';
import { getTodayIso, formatThaiMonthLabel } from '../utils/thaiDate';
import { buildSummaryCard } from '../line/flex/summaryCard';
import { buildPlanCarousel, type PlanCardInput } from '../line/flex/planCard';
import { AI_DISCLAIMER } from '../config/constants';
import { getSafeToSpend, getUserSummary } from './summary.service';
import { getBudgetOverview } from './budget.service';
import { listPlansWithProgress, transferToPlan } from './plan.service';
import { parseThaiNumber } from '../utils/thaiNumber';
import { findLatestChatTransaction, softDeleteTransaction } from '../db/queries/transactions';

export type CommandName = 'summary' | 'remaining' | 'plans' | 'budget' | 'help' | 'privacy';

/**
 * คำสั่งที่รองรับ — คีย์คือข้อความที่ผู้ใช้พิมพ์
 * `งบ` ไม่ได้อยู่ในตารางของ SPEC §S1 แต่เพิ่มเข้ามาเพราะงบรายหมวด (S5.8) ทำเสร็จแล้ว
 * และเป็นข้อมูลที่ผู้ใช้อยากดูบ่อยพอๆ กับสรุป
 */
const COMMANDS: Record<string, CommandName> = {
  'สรุป': 'summary',
  'เหลือ': 'remaining',
  'แผน': 'plans',
  'งบ': 'budget',
  'ช่วยเหลือ': 'help',
  'help': 'help',
  // SPEC §S11.4 / NFR-6: ผู้ใช้ต้องอ่านประกาศความเป็นส่วนตัวซ้ำได้
  // ข้อความต้อนรับเลื่อนหายไปในแชทภายในไม่กี่วัน ถ้าไม่มีทางเรียกอ่านอีก
  // การแจ้งครั้งแรกก็เท่ากับแจ้งแล้วหายไป
  'ความเป็นส่วนตัว': 'privacy',
  'privacy': 'privacy',
};

/** คำสั่งนี้คืออะไร — null ถ้าไม่ใช่คำสั่ง (ให้ไปเข้าทางด่วนบันทึกเงินแทน) */
export function matchCommand(text: string): CommandName | null {
  return COMMANDS[text.trim()] ?? null;
}

const HELP_TEXT = [
  '📖 วิธีใช้ JOD tang',
  '',
  '💰 บันทึกเงิน — พิมพ์ "ชื่อ จำนวน"',
  '   กาแฟ 80 · กาแฟ ห้าสิบ · ค่าเน็ต 1.2k',
  '   ขึ้นต้นด้วย + คือรายรับ เช่น +เงินเดือน 35000',
  '',
  '📊 คำสั่ง',
  '   สรุป — รายรับรายจ่ายเดือนนี้',
  '   เหลือ — ใช้ได้วันละเท่าไหร่',
  '   แผน — แผนออมและความคืบหน้า',
  '   งบ — งบรายหมวดเดือนนี้',
  '   ช่วยเหลือ — ข้อความนี้',
  '   ความเป็นส่วนตัว — ข้อมูลของคุณถูกใช้อย่างไร',
  '',
  '🧾 ส่งรูปสลิปมาได้ ระบบอ่านยอดให้แล้วถามยืนยันก่อนบันทึก',
  '📧 อีเมลธนาคารเข้าระบบเองอัตโนมัติ ตั้งค่าได้ในหน้าเว็บ',
].join('\n');

async function buildSummary(userId: string): Promise<string> {
  const summary = await getUserSummary(userId);
  const lines = [
    '📊 สรุปเดือนนี้',
    `รายรับ  ${formatBaht(summary.monthIncomeSatang)}`,
    `รายจ่าย ${formatBaht(summary.monthExpenseSatang)}`,
    `ส่วนต่าง ${formatBaht(summary.monthIncomeSatang - summary.monthExpenseSatang)}`,
  ];

  // top 3 หมวด ตาม SPEC §S1 summaryCard (ไม่รวม transfer อยู่แล้วจาก G7)
  const top = summary.expenseByCategory.slice(0, 3);
  if (top.length > 0) {
    lines.push('', 'จ่ายมากสุด');
    for (const item of top) {
      lines.push(`  ${item.name} ${formatBaht(item.amountSatang)}`);
    }
  }

  if (summary.transactionCount === 0) {
    lines.push('', 'ยังไม่มีรายการเลย — ลองพิมพ์ "กาแฟ 80" ดูครับ');
  }
  return lines.join('\n');
}

async function buildRemaining(userId: string): Promise<string> {
  const safe = await getSafeToSpend(userId, getTodayIso());

  // S5.2: ผลติดลบต้องเตือนทันทีว่าใช้เกินแล้วเท่าไหร่ ไม่ใช่แสดง 0 เฉยๆ
  if (safe.overspentSatang > 0) {
    return [
      '⚠️ เดือนนี้ใช้เกินแล้ว',
      `เกินไป ${formatBaht(safe.overspentSatang)}`,
      `เหลืออีก ${safe.daysLeft} วันจะสิ้นเดือน`,
      '',
      AI_DISCLAIMER,
    ].join('\n');
  }

  return [
    `💸 ใช้ได้วันละ ${formatBaht(safe.perDaySatang)}`,
    '',
    `คงเหลือเดือนนี้ ${formatBaht(safe.monthRemainingSatang)}`,
    `เหลืออีก ${safe.daysLeft} วัน`,
    safe.breakdown.planCommitmentSatang > 0
      ? `(กันไว้ให้แผนออมแล้ว ${formatBaht(safe.breakdown.planCommitmentSatang)})`
      : '',
    '',
    AI_DISCLAIMER,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

async function buildPlans(userId: string): Promise<string> {
  const plans = (await listPlansWithProgress(userId)).filter(
    (plan) => plan.status === 'active'
  );

  if (plans.length === 0) {
    return '🎯 ยังไม่มีแผนออมที่กำลังทำอยู่\n\nสร้างแผนใหม่ได้ที่หน้าวิเคราะห์ในเว็บครับ';
  }

  const lines = ['🎯 แผนออมของคุณ'];
  for (const plan of plans) {
    lines.push(
      '',
      plan.title,
      `  ${formatBaht(plan.savedSatang)} / ${formatBaht(plan.targetSatang)} (${plan.percentComplete}%)`,
      plan.offTrack ? '  ⚠️ ออมช้ากว่าเป้า' : `  เดือนละ ${formatBaht(plan.monthlySaveSatang)}`
    );
  }
  lines.push('', AI_DISCLAIMER);
  return lines.join('\n');
}

async function buildBudget(userId: string): Promise<string> {
  const overview = await getBudgetOverview(userId);

  if (overview.items.length === 0) {
    return '📋 ยังไม่ได้ตั้งงบรายหมวด\n\nตั้งได้ที่หน้าหมวดหมู่ในเว็บครับ';
  }

  const lines = ['📋 งบเดือนนี้'];
  for (const item of overview.items) {
    const icon = item.level === 'over' ? '🔴' : item.level === 'warning' ? '🟡' : '🟢';
    lines.push(
      `${icon} ${item.emoji ?? ''} ${item.categoryName} ${item.percentUsed}%`,
      `   ${formatBaht(item.spentSatang)} / ${formatBaht(item.limitSatang)}`
    );
  }
  lines.push(
    '',
    `รวม ${formatBaht(overview.totalSpentSatang)} จาก ${formatBaht(overview.totalLimitSatang)}`
  );
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// เวอร์ชัน Flex ของคำสั่งที่มีข้อมูลเป็นโครงสร้าง (SPEC §S1 ตาราง Flex Message)
//
// ทำไมแยกจาก runCommand แทนที่จะเปลี่ยน return type ของมัน: runCommand ยังถูกใช้เป็น
// ทางสำรองสำหรับคำสั่งที่ยังเป็นข้อความล้วน (เหลือ/งบ/ช่วยเหลือ) ถ้ารวมเป็นฟังก์ชันเดียว
// ผู้เรียกต้องแยกชนิดผลลัพธ์ทุกครั้งทั้งที่ 3 ใน 5 คำสั่งไม่มีการ์ด
//
// ⚖️ G1: ที่นี่แปลงข้อมูลเป็นรูปที่การ์ดใช้เท่านั้น ยอดเงินทุกตัว format ด้วย formatBaht
// ส่วนเปอร์เซ็นต์ที่คำนวณเป็นสัดส่วนสำหรับ "ความกว้างแถบ" ไม่ใช่ยอดเงินที่ผู้ใช้เอาไปใช้ต่อ
// ────────────────────────────────────────────────────────────────────────────

/** YYYY-MM-DD -> "ก.ย. 2569" (พ.ศ.) ใช้กับป้ายเดือนบนการ์ด */
function thaiMonthYear(isoDate: string): string {
  const monthIso = isoDate.slice(0, 7);
  const year = Number(monthIso.slice(0, 4)) + 543;
  return `${formatThaiMonthLabel(monthIso)} ${year}`;
}

async function buildSummaryFlex(userId: string) {
  const summary = await getUserSummary(userId);
  const balanceSatang = summary.monthIncomeSatang - summary.monthExpenseSatang;
  const totalExpense = summary.monthExpenseSatang;

  return buildSummaryCard({
    monthLabel: thaiMonthYear(getTodayIso()),
    formattedIncome: formatBaht(summary.monthIncomeSatang),
    formattedExpense: formatBaht(summary.monthExpenseSatang),
    formattedBalance: formatBaht(balanceSatang),
    balanceIsNegative: balanceSatang < 0,
    topCategories: summary.expenseByCategory.slice(0, 3).map((item) => ({
      name: item.name,
      formattedAmount: formatBaht(item.amountSatang),
      // สัดส่วนของหมวดเทียบรายจ่ายทั้งเดือน ใช้วาดความกว้างแถบเท่านั้น
      // ถ้าเดือนนี้ยังไม่มีรายจ่ายเลย ให้เป็น 0 แทนการหารด้วยศูนย์
      percent: totalExpense > 0 ? Math.round((item.amountSatang / totalExpense) * 100) : 0,
    })),
    footnote:
      summary.transactionCount === 0
        ? 'ยังไม่มีรายการเลย — ลองพิมพ์ "กาแฟ 80" ดูครับ'
        : undefined,
  });
}

async function buildPlansFlex(userId: string) {
  const plans = (await listPlansWithProgress(userId)).filter(
    (plan) => plan.status === 'active'
  );
  if (plans.length === 0) return null;

  const cards: PlanCardInput[] = plans.map((plan) => ({
    title: plan.title,
    formattedTarget: formatBaht(plan.targetSatang),
    formattedSaved: formatBaht(plan.savedSatang),
    formattedMonthly: formatBaht(plan.monthlySaveSatang),
    percentComplete: plan.percentComplete,
    confidence: plan.confidence,
    dueMonth: thaiMonthYear(plan.targetDate),
    offTrack: plan.offTrack,
  }));
  return buildPlanCarousel(cards);
}

/**
 * การ์ด Flex ของคำสั่ง — คืน null ถ้าคำสั่งนั้นยังไม่มีการ์ด หรือไม่มีข้อมูลพอจะทำการ์ด
 * ผู้เรียกต้องถอยไปใช้ runCommand() ต่อเมื่อได้ null
 */
export async function runCommandCard(userId: string, command: CommandName) {
  switch (command) {
    case 'summary':
      return buildSummaryFlex(userId);
    case 'plans':
      return buildPlansFlex(userId);
    default:
      return null;
  }
}

/** ข้อความตอบกลับของคำสั่ง — ทุกตัวเลขมาจาก service ไม่มีการคำนวณที่นี่ (G1) */
export async function runCommand(userId: string, command: CommandName): Promise<string> {
  switch (command) {
    case 'summary':
      return buildSummary(userId);
    case 'remaining':
      return buildRemaining(userId);
    case 'plans':
      return buildPlans(userId);
    case 'budget':
      return buildBudget(userId);
    case 'help':
      return HELP_TEXT;
    case 'privacy':
      return PRIVACY_NOTICE;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// คำสั่งที่ต้องเขียนข้อมูล — แยกจาก runCommand เพราะต้องมีปุ่มให้กดต่อ
// ────────────────────────────────────────────────────────────────────────────

/** ย้อนได้เฉพาะรายการที่พิมพ์เองภายใน 24 ชม. (S1 ตาราง "คำสั่งในแชท") */
const UNDO_WINDOW_HOURS = 24;

export type UndoResult =
  | { ok: true; transactionId: string; text: string }
  | { ok: false; text: string };

/**
 * คำสั่ง `ยกเลิก` — ลบรายการล่าสุดที่ผู้ใช้พิมพ์เองภายใน 24 ชม.
 *
 * จำกัดเฉพาะ source='chat' โดยตั้งใจ: คำสั่งนี้มีไว้ถอนสิ่งที่พิมพ์ผิด
 * ไม่ใช่ลบรายการที่ธนาคารส่งมาหรือที่ระบบสร้างจากรายการประจำ ซึ่งผู้ใช้ไม่ได้ตั้งใจแตะ
 */
export async function runUndoLatest(userId: string): Promise<UndoResult> {
  const since = new Date(Date.now() - UNDO_WINDOW_HOURS * 3600_000).toISOString();
  const latest = await findLatestChatTransaction(userId, since);

  if (!latest) {
    return {
      ok: false,
      text: `ไม่พบรายการที่พิมพ์เองใน ${UNDO_WINDOW_HOURS} ชั่วโมงที่ผ่านมาครับ`,
    };
  }

  const removed = await softDeleteTransaction(latest.id, userId);
  if (!removed) {
    return { ok: false, text: 'รายการนี้ถูกยกเลิกไปแล้วครับ' };
  }

  const label = latest.note ?? 'รายการล่าสุด';
  return {
    ok: true,
    transactionId: latest.id,
    text: `ยกเลิก "${label}" ${formatBaht(toSatang(latest.amount))} แล้วครับ ↩️`,
  };
}

/** `ออม 2000` — จับด้วย regex ตาม SPEC §S1 (คำสั่งเดียวที่ไม่ต้องตรงทั้งข้อความ) */
const SAVE_PATTERN = /^ออม\s+(.+)$/;

export type SaveCommandResult =
  | { kind: 'no-plan'; text: string }
  | { kind: 'bad-amount'; text: string }
  | { kind: 'transferred'; text: string }
  | { kind: 'choose'; text: string; amountSatang: number; plans: { planId: string; title: string }[] };

/** ข้อความนี้เป็นคำสั่ง `ออม <จำนวน>` ไหม — คืนจำนวนสตางค์ หรือ null ถ้าไม่ใช่ */
export function matchSaveCommand(text: string): { amountSatang: number | null } | null {
  const matched = SAVE_PATTERN.exec(text.trim());
  if (!matched) return null;
  return { amountSatang: parseThaiNumber(matched[1]!) };
}

/**
 * คำสั่ง `ออม <จำนวน>`
 *   ไม่มีแผน active     → แนะนำให้สร้างแผนก่อน
 *   มีแผนเดียว          → โอนเข้าแผนนั้นเลย
 *   มีหลายแผน           → ให้ผู้เรียกทำ quick reply ให้เลือก (S1 ตาราง postback save_to_plan)
 */
export async function runSaveCommand(
  userId: string,
  amountSatang: number | null
): Promise<SaveCommandResult> {
  if (amountSatang === null || amountSatang <= 0) {
    return { kind: 'bad-amount', text: 'ใส่จำนวนเงินด้วยครับ เช่น "ออม 2000"' };
  }

  const active = (await listPlansWithProgress(userId)).filter(
    (plan) => plan.status === 'active'
  );

  if (active.length === 0) {
    return {
      kind: 'no-plan',
      text: 'ยังไม่มีแผนออมที่กำลังทำอยู่ครับ\n\nสร้างแผนใหม่ได้ที่หน้าวิเคราะห์ในเว็บ',
    };
  }

  if (active.length === 1) {
    const plan = active[0]!;
    const result = await transferToPlan(userId, plan.planId, amountSatang);
    return {
      kind: 'transferred',
      text: result.justCompleted
        ? `🎉 ครบเป้าแล้ว! "${plan.title}"\nออมครบ ${formatBaht(result.progress.targetSatang)} ตามที่ตั้งใจไว้`
        : [
            `โอนเข้าแผน "${plan.title}" ${formatBaht(amountSatang)} แล้วครับ`,
            `ตอนนี้ออมได้ ${formatBaht(result.progress.savedSatang)} / ${formatBaht(result.progress.targetSatang)} (${result.progress.percentComplete}%)`,
          ].join('\n'),
    };
  }

  return {
    kind: 'choose',
    text: `จะโอน ${formatBaht(amountSatang)} เข้าแผนไหนครับ?`,
    amountSatang,
    plans: active.map((plan) => ({ planId: plan.planId, title: plan.title })),
  };
}
