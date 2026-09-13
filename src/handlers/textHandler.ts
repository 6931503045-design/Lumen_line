import { getUserIdByLineUserId } from '../db/queries/users';
import { parseQuickExpenseText } from '../utils/regexParser';
import { createTransaction } from '../services/transaction.service';
import { formatBaht } from '../utils/money';
import { replyText } from '../line/reply';

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

  const userId = await getUserIdByLineUserId(lineUserId);
  if (!userId) {
    await replyText(replyToken, 'ยังไม่พบบัญชีผู้ใช้ครับ ลองแอดเพื่อนบอทใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  const parsed = parseQuickExpenseText(text);

  if (parsed.confidence !== 'high' || parsed.amount === undefined || !parsed.category) {
    await replyText(
      replyToken,
      'ตอนนี้บอทยังจดได้แค่รูปแบบ "ชื่อ จำนวนเงิน" เช่น "กาแฟ 80" หรือ "+เงินเดือน 35000" นะครับ'
    );
    return;
  }

  try {
    const tx = await createTransaction({
      userId,
      type: parsed.type ?? 'expense',
      amountBaht: parsed.amount,
      categoryName: parsed.category,
      source: 'chat',
      parsedBy: 'regex',
    });

    const label = tx.type === 'income' ? 'รายรับ' : 'รายจ่าย';
    await replyText(
      replyToken,
      `บันทึก${label} ${formatBaht(tx.amountSatang)} หมวด "${parsed.category}" แล้วครับ ✅`
    );
  } catch (err) {
    console.error('[textHandler] createTransaction error:', err);
    await replyText(replyToken, 'บันทึกไม่สำเร็จ ลองพิมพ์ใหม่อีกครั้งนะครับ 🙏');
  }
}
