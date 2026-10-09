// ไฟล์นี้ทำหน้าที่อะไร: สรุปรายรับ-รายจ่ายของวันนี้ แล้ว push ให้ผู้ใช้ที่เปิดรับไว้ (FR-17)
// ใครรับผิดชอบ: ② Database
// เขียนในสัปดาห์: W5
// อ้างอิง: SPEC.md §S7 ("dailySummary | 21:00 ไทย | 0 14 * * * UTC"), §S13 Push & Quota
// ⚖️ กฎเหล็ก G1, G3, G4, G7
//
// G1 — ไม่คำนวณเงินเอง ยอดคงเหลือของเดือนมาจาก getSafeToSpend ที่เดียวกับหน้าเว็บ
// G4 — ไม่มี AI ในเส้นทางนี้เลย ปิด AI_ENABLED แล้วยังส่งได้ปกติ
// G7 — transfer (โอนเข้าแผนออม) ไม่นับเป็นรายรับหรือรายจ่ายของวันนี้
//
// idempotent ด้วย dedup_key `daily:<วันที่>:<user_id>` ของ push_log (SPEC §S13)
// GitHub Actions ยิงซ้ำในวันเดียวกันจะได้ pushSkipped ไม่ใช่ข้อความซ้ำ
// โควตาเช็คใน sendPush ทุกครั้ง — สรุปรายวันมีลำดับต่ำสุด จึงถูกตัดก่อนเมื่อโควตาเหลือน้อย

import { add, formatBaht, toSatang } from '../utils/money';
import { addDaysIso, formatThaiDate, getTodayIso } from '../utils/thaiDate';
import { logger } from '../utils/logger';
import { listDailySummaryUserIds } from '../db/queries/users';
import { listTransactionRowsInRange, type SummaryRow } from '../db/queries/summary';
import { countUnparsedEmails } from '../db/queries/emails';
import { getSafeToSpend } from './summary.service';
import { sendPush } from '../line/push';

export type DailySummaryResult = {
  /** ผู้ใช้ที่เปิดรับไว้ทั้งหมด */
  usersChecked: number;
  /** ส่ง push สำเร็จกี่ข้อความ */
  pushed: number;
  /** ไม่ได้ส่งเพราะซ้ำ/โควตา/ผู้ใช้บล็อกบอท — ไม่ใช่ error */
  pushSkipped: number;
  /** ผู้ใช้ที่พังระหว่างทาง (ไม่ทำให้คนอื่นหยุด) */
  failed: number;
};

export type DailyFigures = {
  incomeSatang: number;
  expenseSatang: number;
  expenseCount: number;
  monthRemainingSatang: number;
  unparsedEmails: number;
};

function sumSatang(rows: SummaryRow[], type: 'income' | 'expense'): number {
  return add(...rows.filter((row) => row.type === type).map((row) => toSatang(row.amount)));
}

export function dailySummaryMessage(dateLabel: string, figures: DailyFigures): string {
  const lines = [`📊 สรุปวันนี้ ${dateLabel}`];

  if (figures.expenseCount === 0 && figures.incomeSatang === 0) {
    lines.push('วันนี้ยังไม่ได้จดรายการเลย พิมพ์ เช่น "ข้าว 50" ได้เลยครับ');
  } else {
    lines.push(`รายจ่าย ${formatBaht(figures.expenseSatang)} (${figures.expenseCount} รายการ)`);
    if (figures.incomeSatang > 0) lines.push(`รายรับ ${formatBaht(figures.incomeSatang)}`);
  }

  lines.push('');
  lines.push(
    figures.monthRemainingSatang >= 0
      ? `เดือนนี้เหลือใช้ได้อีก ${formatBaht(figures.monthRemainingSatang)}`
      : `⚠️ เดือนนี้ใช้เกินไปแล้ว ${formatBaht(-figures.monthRemainingSatang)}`
  );

  // SPEC §S8: อีเมลที่ parse ไม่ได้ต้องแจ้งผู้ใช้ทางนี้ ไม่งั้นรายการหายไปเงียบๆ
  if (figures.unparsedEmails > 0) {
    lines.push(`📧 มีอีเมลธนาคาร ${figures.unparsedEmails} ฉบับที่ระบบอ่านยอดไม่ออก`);
  }

  lines.push('', 'ปิดสรุปรายวันได้ที่หน้าเว็บ → ตั้งค่า');
  return lines.join('\n');
}

async function collectFigures(userId: string, todayIso: string): Promise<DailyFigures> {
  const [todayRows, safe, unparsedEmails] = await Promise.all([
    listTransactionRowsInRange(userId, todayIso, addDaysIso(todayIso, 1)),
    getSafeToSpend(userId, todayIso),
    countUnparsedEmails(userId),
  ]);

  return {
    incomeSatang: sumSatang(todayRows, 'income'),
    expenseSatang: sumSatang(todayRows, 'expense'),
    expenseCount: todayRows.filter((row) => row.type === 'expense').length,
    monthRemainingSatang: safe.monthRemainingSatang,
    unparsedEmails,
  };
}

/**
 * S7 — งาน dailySummary 21:00 ไทย
 * ผู้ใช้หนึ่งคนพังต้องไม่ทำให้คนที่เหลือหยุด เหมือน planCheck
 */
export async function sendDailySummaries(
  todayIso: string = getTodayIso(),
  now: Date = new Date()
): Promise<DailySummaryResult> {
  const result: DailySummaryResult = { usersChecked: 0, pushed: 0, pushSkipped: 0, failed: 0 };

  const userIds = await listDailySummaryUserIds();
  const dateLabel = formatThaiDate(now);

  for (const userId of userIds) {
    result.usersChecked += 1;
    try {
      const figures = await collectFigures(userId, todayIso);
      const sent = await sendPush(
        userId,
        'dailySummary',
        `daily:${todayIso}:${userId}`,
        dailySummaryMessage(dateLabel, figures)
      );
      if (sent.sent) {
        result.pushed += 1;
      } else {
        result.pushSkipped += 1;
        // โควตาเป็นของทั้งช่องทาง คนถัดไปก็จะโดนปฏิเสธเหมือนกัน ไม่ต้องดึงยอดของทุกคนต่อให้เปลือง
        if (sent.reason === 'quota') {
          result.pushSkipped += userIds.length - result.usersChecked;
          break;
        }
      }
    } catch (err) {
      result.failed += 1;
      logger.error(`[dailySummary] ผู้ใช้ ${userId} สรุปไม่สำเร็จ:`, err);
    }
  }

  logger.info('[dailySummary] รอบสรุปจบ:', result);
  return result;
}
