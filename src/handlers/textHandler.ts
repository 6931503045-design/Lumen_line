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
import { replyFlex, replyText } from '../line/reply';
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