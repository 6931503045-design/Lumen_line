// ไฟล์นี้ทำหน้าที่อะไร: จัดการข้อความจาก LINE — W1 มีแค่ทางด่วน L1 (regex) เท่านั้น
// ใครรับผิดชอบ: ① Bot Core / ③ AI
// เขียนในสัปดาห์: W1
// ⚖️ กฎเหล็ก G1, G2, G3, G4
//
// 🆕 regexParser.ts เสียบ thaiNumber.ts เข้าไปแล้ว จึงคืน `amountSatang` (สตางค์) มาตรงๆ
// ไฟล์นี้ไม่ต้องเรียก money.toSatang() เองอีกต่อไป — จุดแปลงหน่วยยังอยู่ใน money.ts ที่เดียว
// (thaiNumber.ts เรียก toSatang ข้างในให้แล้ว) ตามกฎ G3
//
// ผลพลอยได้: ทางด่วน L1 รองรับ "กาแฟ ห้าสิบ" / "กาแฟ 80 บาท" / "ค่าเน็ต 1.2k" ได้แล้ว

import { getUserIdByLineUserId } from '../db/queries/users';
import { parseQuickExpenseText } from '../utils/regexParser';
import { createTransaction } from '../services/transaction.service';
import { formatBudgetAlert } from '../services/budget.service';
import { formatBaht } from '../utils/money';
import { replyFlex, replyText, replyTextWithQuickReply } from '../line/reply';
import {
  matchCommand,
  matchSaveCommand,
  runCommand,
  runSaveCommand,
  runUndoLatest,
} from '../services/command.service';
import { buildConfirmCard } from '../line/flex/confirmCard';

type LineTextMessageEvent = {
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

export async function handleText(event: LineTextMessageEvent): Promise<void> {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const text = event.message?.text;

  if (!replyToken || !lineUserId || !text) {
    console.error('[textHandler] event ไม่มี replyToken/userId/text ครบ');
    return;
  }

  // ⚖️ G6: user_id ที่แท้จริงต้อง query จาก line_user_id ของ event เท่านั้น ห้ามเดา/รับจากที่อื่น
  const userId = await getUserIdByLineUserId(lineUserId);
  if (!userId) {
    await replyText(replyToken, 'ยังไม่พบบัญชีผู้ใช้ครับ ลองแอดเพื่อนบอทใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  // ── คำสั่งตายตัวมาก่อนเสมอ (SPEC §S1) ────────────────────────────────────
  // ต้องเช็คก่อนทางด่วนบันทึกเงิน ไม่งั้น "สรุป" จะถูกมองว่าเป็นชื่อรายการที่ไม่มียอด
  try {
    if (await handleCommands(replyToken, userId, text)) return;
  } catch (err) {
    console.error('[textHandler] คำสั่งทำงานไม่สำเร็จ:', err);
    await replyText(replyToken, 'ดึงข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  const parsed = parseQuickExpenseText(text);

  // parsed.amountSatang = จำนวนที่ผู้ใช้พิมพ์ แปลงเป็นสตางค์แล้ว (G1: ดึงตรงๆ ไม่ประมาณ)
  if (parsed.confidence !== 'high' || parsed.amountSatang === undefined || !parsed.category) {
    await replyText(
      replyToken,
      'ตอนนี้บอทยังจดได้แค่รูปแบบ "ชื่อ จำนวนเงิน" เช่น "กาแฟ 80", "กาแฟ ห้าสิบ" หรือ "+เงินเดือน 35000" นะครับ'
    );
    return;
  }

  try {
    const tx = await createTransaction({
      userId,
      type: parsed.type ?? 'expense',
      amountSatang: parsed.amountSatang,
      categoryName: parsed.category,
      source: 'chat',
      parsedBy: 'regex',
    });

    const confirmCard = buildConfirmCard({
      transactionId: tx.id,
      type: tx.type === 'income' ? 'income' : 'expense',
      categoryName: parsed.category,
      formattedAmount: formatBaht(tx.amountSatang),
    });

    // S5.8: รายการนี้ทำให้ข้ามเกณฑ์งบพอดี — แนบไปกับ reply เดียวกัน
    // reply มี quota แยกจาก push และไม่จำกัดจำนวน จึงเตือนตรงนี้ได้ฟรี
    // ถ้าปล่อยไปเตือนทีหลังต้องใช้ push ซึ่งมีแค่ 280 ครั้งต่อเดือนทั้งระบบ
    await replyFlex(replyToken, confirmCard, tx.budgetAlert ? formatBudgetAlert(tx.budgetAlert) : undefined);
  } catch (err) {
    console.error('[textHandler] createTransaction error:', err);
    await replyText(replyToken, 'บันทึกไม่สำเร็จ ลองพิมพ์ใหม่อีกครั้งนะครับ 🙏');
  }
}
/**
 * จัดการคำสั่งตายตัว — คืน true ถ้าข้อความนี้เป็นคำสั่งและตอบไปแล้ว
 *
 * แยกออกมาเพื่อให้ handleText อ่านง่าย: "เป็นคำสั่งไหม ถ้าใช่จบตรงนี้
 * ถ้าไม่ใช่ค่อยลองอ่านเป็นการบันทึกเงิน"
 */
async function handleCommands(
  replyToken: string,
  userId: string,
  text: string
): Promise<boolean> {
  const trimmed = text.trim();

  // `ยกเลิก` เขียนข้อมูล จึงต้องมีปุ่มเอากลับคืนให้เสมอ (S1)
  if (trimmed === 'ยกเลิก') {
    const result = await runUndoLatest(userId);
    if (!result.ok) {
      await replyText(replyToken, result.text);
      return true;
    }
    await replyTextWithQuickReply(replyToken, result.text, [
      {
        type: 'action',
        action: {
          type: 'postback',
          label: 'เอากลับคืน',
          data: `action=restore&id=${result.transactionId}`,
          displayText: 'เอากลับคืน',
        },
      },
    ]);
    return true;
  }

  // `ออม <จำนวน>` — คำสั่งเดียวที่ไม่ต้องตรงทั้งข้อความ (SPEC §S1)
  const save = matchSaveCommand(trimmed);
  if (save) {
    const result = await runSaveCommand(userId, save.amountSatang);
    if (result.kind === 'choose') {
      // LINE จำกัด quick reply ที่ 13 ปุ่ม ส่วนแผน active มีได้สูงสุด 3 อยู่แล้ว
      await replyTextWithQuickReply(
        replyToken,
        result.text,
        result.plans.map((plan) => ({
          type: 'action' as const,
          action: {
            type: 'postback' as const,
            label: plan.title.slice(0, 20), // LINE จำกัด label ที่ 20 ตัวอักษร
            data: `action=save_to_plan&id=${plan.planId}&amt=${result.amountSatang}`,
            displayText: `ออมเข้า ${plan.title}`,
          },
        }))
      );
      return true;
    }
    await replyText(replyToken, result.text);
    return true;
  }

  const command = matchCommand(trimmed);
  if (!command) return false;

  await replyText(replyToken, await runCommand(userId, command));
  return true;
}
